import { createDailyCheckIn } from '@/lib/aiMoneyChat/dailyCheckin';
import { getDateKey } from '@/lib/dateHelpers';
import type { Transaction } from '@/stores/useFinanceStore';

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

function makeTxn(
  id: string,
  type: 'income' | 'expense',
  amount: number,
  date: Date,
  categoryId = type === 'income' ? 'salary' : 'food',
): Transaction {
  return {
    id,
    type,
    amount,
    categoryId,
    note: id,
    wallet: 'main',
    date: date.toISOString(),
    time: '12:00',
    dateLabel: 'Hom nay',
    dateKey: getDateKey(date),
  };
}

describe('AI Money Chat daily check-ins', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const yesterday = new Date('2026-06-14T12:00:00Z');
  const transactions: Transaction[] = [
    makeTxn('salary', 'income', 20_000_000, now),
    makeTxn('lunch', 'expense', 120_000, now),
    makeTxn('market', 'expense', 880_000, yesterday, 'groceries'),
  ];

  it('creates a midday report with today and month metrics', () => {
    const report = createDailyCheckIn({
      slot: 'midday',
      now,
      transactions,
      monthlySpendingLimit: 8_000_000,
      fixedBillsTotal: 2_000_000,
      billFundBalance: 2_500_000,
    });

    expectEqual(report.title, 'Báo cáo 12h');
    expectEqual(report.metrics.todayIncome, 20_000_000);
    expectEqual(report.metrics.todayExpense, 120_000);
    expectEqual(report.metrics.monthlyExpense, 1_000_000);
    expectEqual(report.metrics.monthlySpendingRemaining, 7_000_000);
    expectContains(report.message, 'Gợi ý 12h');
  });

  it('creates an evening report that asks for bank balance reconciliation', () => {
    const report = createDailyCheckIn({
      slot: 'evening',
      now,
      transactions,
      monthlySpendingLimit: 8_000_000,
    });

    expectEqual(report.title, 'Báo cáo 21h');
    expectContains(report.message, 'đối chiếu số dư ngân hàng');
  });

  it('warns when monthly spending limit is exhausted', () => {
    const report = createDailyCheckIn({
      slot: 'evening',
      now,
      transactions,
      monthlySpendingLimit: 900_000,
    });

    expectEqual(report.status, 'overspent');
    expectEqual(report.metrics.monthlySpendingRemaining, 0);
  });

  it('shows fixed bill shortage when bill fund is not enough', () => {
    const report = createDailyCheckIn({
      slot: 'midday',
      now,
      transactions,
      monthlySpendingLimit: 8_000_000,
      fixedBillsTotal: 3_000_000,
      billFundBalance: 1_000_000,
    });

    expectEqual(report.metrics.fixedBillsShortage, 2_000_000);
    expectContains(report.message, 'Quỹ bill còn thiếu 2.000.000 VND');
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
