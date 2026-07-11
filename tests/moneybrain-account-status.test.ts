/* TDD — accountStatus.ts: 4 trạng thái tài khoản (xuatsac/tot/trungbinh/canhbao) */
import { computeAccountStatus } from '@/lib/moneyBrain/accountStatus';
import type { MoneySnapshotV1, MoneyTransactionSnapshot } from '@/lib/moneyBrain/types';

type TestFn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const MK = '2026-06';

function income(amount: number): MoneyTransactionSnapshot {
  return { id: 'inc', type: 'income', amount, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK };
}
function expenseFood(amount: number): MoneyTransactionSnapshot {
  return { id: 'exp', type: 'expense', amount, categoryId: 'food', date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: MK };
}
function makeSnap(o: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 10_000_000, emergency: 0, billFund: 0 },
    transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0, ...o,
  };
}
/** Task đã hoàn thành trong tháng → thu nhập tăng thêm thực tế. */
const EXTRA_TASK = {
  id: 't1', name: 'Freelance', expectedAmount: 3_000_000, actualAmount: 3_000_000,
  startDate: '2026-06-01T00:00:00Z', endDate: '2026-06-30T00:00:00Z', completedAt: '2026-06-05T03:00:00Z',
};

describe('4 trạng thái tài khoản');

it('xuất sắc: có thu thêm + đủ bill + trong ngưỡng + số dư dương', () => {
  const s = computeAccountStatus(makeSnap({
    transactions: [income(15_000_000), expenseFood(2_000_000)],
    budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    tasks: [EXTRA_TASK],
    bills: [{ id: 'b1', name: 'Điện', amount: 500_000, dueDay: 5, isPaid: true }],
  }));
  eq(s.level, 'xuatsac', 'level');
  ok(s.signals.hasExtraIncome, 'hasExtraIncome');
  ok(s.signals.withinLimits, 'withinLimits');
  ok(s.signals.billsAllPaid, 'billsAllPaid');
  ok(s.signals.safeToSpend > 0, 'safe>0');
});

it('tốt: giống xuất sắc nhưng còn bill chưa đóng → có action pay-bills', () => {
  const s = computeAccountStatus(makeSnap({
    transactions: [income(15_000_000), expenseFood(2_000_000)],
    budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    tasks: [EXTRA_TASK],
    bills: [{ id: 'b1', name: 'Điện', amount: 800_000, dueDay: 5, isPaid: false }],
  }));
  eq(s.level, 'tot', 'level');
  eq(s.signals.unpaidBillsCount, 1, 'unpaidCount');
  ok(s.actions.some((a) => a.kind === 'pay-bills'), 'has pay-bills action');
});

it('trung bình: KHÔNG có thu tăng thêm (dù mọi thứ khác ổn)', () => {
  const s = computeAccountStatus(makeSnap({
    transactions: [income(15_000_000), expenseFood(2_000_000)],
    budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    tasks: [], // không nhiệm vụ kiếm tiền
    bills: [],
  }));
  eq(s.level, 'trungbinh', 'level');
  ok(!s.signals.hasExtraIncome, 'no extra income');
  ok(s.actions.some((a) => a.kind === 'earn-more'), 'has earn-more action');
});

it('trung bình: có thu thêm nhưng chi VƯỢT ngưỡng (tính đúng số vượt)', () => {
  const s = computeAccountStatus(makeSnap({
    transactions: [income(15_000_000), expenseFood(3_000_000)], // limit 2M, spent 3M → vượt 1M
    budgets: [{ categoryId: 'food', monthlyLimit: 2_000_000, monthKey: MK }],
    tasks: [EXTRA_TASK],
    bills: [],
  }));
  eq(s.level, 'trungbinh', 'level');
  ok(!s.signals.withinLimits, 'over limit');
  eq(s.signals.overBudgetCount, 1, 'overCount');
  eq(s.signals.overBudgetAmount, 1_000_000, 'overAmount');
});

it('cảnh báo: thu < chi → số dư khả dụng âm', () => {
  const s = computeAccountStatus(makeSnap({
    transactions: [income(3_000_000)],
    budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    bills: [{ id: 'b1', name: 'Nhà', amount: 2_000_000, dueDay: 1, isPaid: false }],
    goals: [{ id: 'g1', name: 'G', targetAmount: 10_000_000, currentAmount: 0, monthlyContributionTarget: 1_000_000 }],
  }));
  eq(s.level, 'canhbao', 'level');
  ok(s.signals.safeToSpend < 0, 'safe<0');
});

if (process.exitCode) process.exit(process.exitCode);
