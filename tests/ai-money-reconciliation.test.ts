import { createBalanceReconciliationReport } from '@/lib/aiMoneyChat/balanceReconciliation';

type TestFn = () => void;

function describe(name: string, fn: TestFn): void {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectContains(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected "${actual}" to include "${expected}"`);
  }
}

describe('AI Money Chat balance reconciliation', () => {
  it('marks all accounts matched within tolerance', () => {
    const report = createBalanceReconciliationReport([
      { id: 'income', label: 'Tai khoan thu nhap', appBalance: 10_000_000, bankBalance: 10_000_500 },
      { id: 'expense', label: 'Tai khoan chi tieu', appBalance: 5_000_000, bankBalance: 5_000_000 },
      { id: 'saving', label: 'Tai khoan tiet kiem', appBalance: 20_000_000, bankBalance: 20_000_000 },
    ]);

    expectEqual(report.status, 'matched');
    expectEqual(report.totalDifference, 500);
    expectContains(report.message, 'khop');
  });

  it('marks minor drift for small differences', () => {
    const report = createBalanceReconciliationReport([
      { id: 'income', label: 'Tai khoan thu nhap', appBalance: 10_000_000, bankBalance: 10_030_000 },
      { id: 'expense', label: 'Tai khoan chi tieu', appBalance: 5_000_000, bankBalance: 5_000_000 },
      { id: 'saving', label: 'Tai khoan tiet kiem', appBalance: 20_000_000, bankBalance: 20_000_000 },
    ]);

    expectEqual(report.status, 'minor-drift');
    expectEqual(report.accounts[0].status, 'minor-drift');
    expectContains(report.message, 'Lech nhe');
  });

  it('marks major drift when an account is meaningfully off', () => {
    const report = createBalanceReconciliationReport([
      { id: 'income', label: 'Tai khoan thu nhap', appBalance: 10_000_000, bankBalance: 9_000_000 },
      { id: 'expense', label: 'Tai khoan chi tieu', appBalance: 5_000_000, bankBalance: 5_000_000 },
      { id: 'saving', label: 'Tai khoan tiet kiem', appBalance: 20_000_000, bankBalance: 20_000_000 },
    ]);

    expectEqual(report.status, 'major-drift');
    expectEqual(report.totalDifference, -1_000_000);
    expectContains(report.message, 'dung tin bao cao ngay');
  });

  it('keeps the direction clear when bank is higher than ManiCash', () => {
    const report = createBalanceReconciliationReport([
      { id: 'income', label: 'Tai khoan thu nhap', appBalance: 10_000_000, bankBalance: 10_500_000 },
    ]);

    expectEqual(report.accounts[0].difference, 500_000);
    expectContains(report.accounts[0].message, 'ngan hang cao hon ManiCash');
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
