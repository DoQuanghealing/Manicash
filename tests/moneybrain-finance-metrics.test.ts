/* TDD — financeMetrics.ts: income/expense/transfer, savingsRate, top categories */
import {
  getIncomeForPeriod, getExpenseForPeriod, getTransferForPeriod,
  getNetCashflowForPeriod, getSavingsRateForPeriod,
  getTopExpenseCategoriesForPeriod, getLargestExpenseTransactionsForPeriod,
  getTransactionsForPeriod,
} from '@/lib/moneyBrain/financeMetrics';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  const close = typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.0001;
  if (a !== b && !close) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function approx(a: number, b: number, msg?: string): void {
  if (Math.abs(a - b) > 0.01) throw new Error(`${msg ?? ''} expected ~${b}, got ${a}`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 10:00 VN 08/06

function makeSnap(overrides: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    tasks: [],
    ...overrides,
  };
}

async function main() {
  describe('getIncomeForPeriod / getExpenseForPeriod');

  await it('income tháng này: chỉ income transactions', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 't1', type: 'income', amount: 15_000_000, date: '2026-06-05T03:00:00Z', dateKey: '2026-06-05', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 't2', type: 'expense', amount: 2_000_000, date: '2026-06-06T03:00:00Z', dateKey: '2026-06-06', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    eq(getIncomeForPeriod(snap, 'this_month'), 15_000_000, 'income');
    eq(getExpenseForPeriod(snap, 'this_month'), 2_000_000, 'expense');
  });

  await it('hôm nay: chỉ tính giao dịch ngày 08/06', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 't1', type: 'expense', amount: 600_000, date: '2026-06-08T03:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 't2', type: 'expense', amount: 2_000_000, date: '2026-06-05T03:00:00Z', dateKey: '2026-06-05', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    eq(getExpenseForPeriod(snap, 'today'), 600_000, 'today only');
    eq(getExpenseForPeriod(snap, 'this_month'), 2_600_000, 'this_month includes all');
  });

  await it('transfer không tính là income hay expense', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 't1', type: 'transfer', amount: 5_000_000, date: '2026-06-08T03:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 't2', type: 'income', amount: 1_000_000, date: '2026-06-08T03:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    eq(getIncomeForPeriod(snap, 'this_month'), 1_000_000, 'income excludes transfer');
    eq(getExpenseForPeriod(snap, 'this_month'), 0, 'expense excludes transfer');
    eq(getTransferForPeriod(snap, 'this_month'), 5_000_000, 'transfer counted separately');
  });

  describe('getNetCashflowForPeriod');

  await it('net = income - expense', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e1', type: 'expense', amount: 3_000_000, date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    eq(getNetCashflowForPeriod(snap, 'this_month'), 7_000_000);
  });

  describe('getSavingsRateForPeriod edge cases');

  await it('income > 0: rate = (income - expense) / income * 100', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e1', type: 'expense', amount: 6_000_000, date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    approx(getSavingsRateForPeriod(snap, 'this_month'), 40, 'rate 40%');
  });

  await it('income = 0, expense = 0 → rate = 0', async () => {
    eq(getSavingsRateForPeriod(makeSnap(), 'this_month'), 0);
  });

  await it('income = 0, expense > 0 → rate = -100', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 1_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    eq(getSavingsRateForPeriod(snap, 'this_month'), -100);
  });

  describe('getTopExpenseCategoriesForPeriod');

  await it('top categories sorted by amount desc, normalized category', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 500_000, categoryId: 'entertain', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e2', type: 'expense', amount: 300_000, categoryId: 'entertainment', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e3', type: 'expense', amount: 800_000, categoryId: 'food', date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    const top = getTopExpenseCategoriesForPeriod(snap, 'this_month', 3);
    // entertain + entertainment alias to same 'entertainment' = 800k total, food = 800k
    // entertainment total = 500k + 300k = 800k; food = 800k → sort by amount desc
    if (top.length < 2) throw new Error('Expected >=2 categories');
    // Both should be 800k, entertainment should be merged
    const entCat = top.find((c) => c.categoryId === 'entertainment');
    if (!entCat) throw new Error('entertainment category expected');
    eq(entCat.amount, 800_000, 'entertain+entertainment merged via alias');
  });

  await it('income transactions không bị tính vào top categories', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 9_999_999, categoryId: 'salary', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e1', type: 'expense', amount: 100_000, categoryId: 'food', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: '2026-06' },
      ],
    });
    const top = getTopExpenseCategoriesForPeriod(snap, 'this_month', 5);
    if (top.some((c) => c.categoryId === 'salary')) throw new Error('salary income should not appear');
    eq(top.length, 1, 'only food');
    eq(top[0].categoryId, 'food');
  });

  describe('getLargestExpenseTransactionsForPeriod');

  await it('sort desc by amount, correct period', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 200_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e2', type: 'expense', amount: 1_000_000, date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: '2026-06' },
        { id: 'e3', type: 'expense', amount: 500_000, date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: '2026-06' },
        // Tháng trước — không tính
        { id: 'e4', type: 'expense', amount: 9_000_000, date: '2026-05-01T03:00:00Z', dateKey: '2026-05-01', weekKey: '2026-W18', monthKey: '2026-05' },
      ],
    });
    const largest = getLargestExpenseTransactionsForPeriod(snap, 'this_month', 2);
    eq(largest.length, 2);
    eq(largest[0].id, 'e2', 'largest first');
    eq(largest[1].id, 'e3', 'second largest');
  });

  console.log('\nfinanceMetrics test complete.');
}

main();
