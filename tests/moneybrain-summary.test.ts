/* TDD — moneyBrain/snapshot.ts (adapter) + financeSummary.ts (period sums) */
import { toMoneySnapshotV1 } from '@/lib/moneyBrain/snapshot';
import { getIncomeForPeriod, getExpenseForPeriod } from '@/lib/moneyBrain/financeSummary';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

type TestFn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
function eq<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}
function ok(v: boolean, label: string): void { if (!v) throw new Error(`Expected ${label} true`); }

const VN = 'Asia/Ho_Chi_Minh';

describe('toMoneySnapshotV1 — adapter từ ClientSnapshotInput');
it('điền version/clientNow/timezone, normalize category, fill date keys', () => {
  const input: ClientSnapshotInput = {
    clientNow: '2026-06-08T03:00:00Z',
    timezone: VN,
    wallets: { main: 1_000_000, emergency: 2_000_000, billFund: 500_000 },
    transactions: [
      { id: 't1', type: 'expense', amount: 500_000, categoryId: 'entertain', date: '2026-06-08T02:00:00Z' },
    ],
    budgets: [{ categoryId: 'entertain', name: 'Giải trí', limit: 1_000_000 }],
    goals: [{ id: 'g1', name: 'Xe', targetAmount: 50_000_000, savedAmount: 5_000_000, monthlyContribution: 500_000 }],
  };
  const m = toMoneySnapshotV1(input);
  eq(m.version, 'money_snapshot_v1');
  eq(m.clientNow, '2026-06-08T03:00:00Z');
  eq(m.timezone, VN);
  // category normalized entertain -> entertainment
  eq(m.transactions[0].categoryId, 'entertainment');
  eq(m.budgets[0].categoryId, 'entertainment');
  // date keys derived
  eq(m.transactions[0].dateKey, '2026-06-08');
  eq(m.transactions[0].monthKey, '2026-06');
  ok(m.transactions[0].weekKey.startsWith('2026-W'), 'weekKey set');
  // goal contribution target fallback từ monthlyContribution
  eq(m.goals[0].monthlyContributionTarget, 500_000);
});

it('default timezone Asia/Ho_Chi_Minh khi thiếu', () => {
  const m = toMoneySnapshotV1({ clientNow: '2026-06-08T03:00:00Z', transactions: [] });
  eq(m.timezone, 'Asia/Ho_Chi_Minh');
});

describe('getExpenseForPeriod / getIncomeForPeriod — today vs this_month');
const snap: MoneySnapshotV1 = {
  version: 'money_snapshot_v1',
  clientNow: '2026-06-08T03:00:00Z', // 10:00 VN 08/06
  timezone: VN,
  wallets: { main: 0, emergency: 0, billFund: 0 },
  transactions: [
    { id: 'a', type: 'expense', amount: 500_000, categoryId: 'food', date: '2026-06-08T01:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W24', monthKey: '2026-06' },
    { id: 'b', type: 'expense', amount: 2_000_000, categoryId: 'shopping', date: '2026-06-02T01:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: '2026-06' },
    { id: 'c', type: 'income', amount: 20_000_000, categoryId: 'salary', date: '2026-06-08T01:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W24', monthKey: '2026-06' },
    { id: 'd', type: 'expense', amount: 999_000, categoryId: 'food', date: '2026-05-20T01:00:00Z', dateKey: '2026-05-20', weekKey: '2026-W21', monthKey: '2026-05' },
  ],
  budgets: [], bills: [], goals: [], tasks: [],
};

it('expense today = chỉ giao dịch hôm nay (500k), KHÔNG gồm 2M ngày khác', () => {
  eq(getExpenseForPeriod(snap, 'today'), 500_000);
});
it('expense this_month = 500k + 2M (loại 999k tháng trước)', () => {
  eq(getExpenseForPeriod(snap, 'this_month'), 2_500_000);
});
it('expense last_month = 999k', () => {
  eq(getExpenseForPeriod(snap, 'last_month'), 999_000);
});
it('income today = 20M', () => {
  eq(getIncomeForPeriod(snap, 'today'), 20_000_000);
});
it('income this_month = 20M', () => {
  eq(getIncomeForPeriod(snap, 'this_month'), 20_000_000);
});

console.log('\nmoneyBrain summary/adapter test complete.');
