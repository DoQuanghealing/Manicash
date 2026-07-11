/* TDD — balanceBreakdown.ts: drill-down từng mục cho "Cách tính số dư khả dụng" */
import { getBalanceBreakdownDetail } from '@/lib/moneyBrain/balanceBreakdown';
import { getSafeToSpendBreakdown } from '@/lib/moneyBrain/safeToSpend';
import type { MoneySnapshotV1, MoneyTransactionSnapshot } from '@/lib/moneyBrain/types';

function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // VN 10:00 → hôm nay ngày 8
const MK = '2026-06';

function tx(o: Partial<MoneyTransactionSnapshot> & { type: 'income' | 'expense'; amount: number }): MoneyTransactionSnapshot {
  return { id: Math.random().toString(36).slice(2), date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: MK, ...o };
}
function snap(): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 10_000_000, emergency: 0, billFund: 0 },
    transactions: [
      tx({ type: 'income', amount: 15_000_000, categoryName: 'Lương' }),
      tx({ type: 'income', amount: 3_000_000, categoryName: 'Freelance' }),
      tx({ type: 'expense', amount: 2_000_000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 3_000_000, categoryId: 'shopping' }),
    ],
    budgets: [
      { categoryId: 'food', categoryName: 'Ăn uống', monthlyLimit: 5_000_000, monthKey: MK },
      { categoryId: 'shopping', categoryName: 'Mua sắm', monthlyLimit: 2_000_000, monthKey: MK },
    ],
    bills: [
      { id: 'b1', name: 'Điện', amount: 800_000, dueDay: 1, isPaid: false },
      { id: 'b2', name: 'Nước', amount: 500_000, dueDay: 10, isPaid: false },
      { id: 'b3', name: 'Net (đã đóng)', amount: 300_000, dueDay: 3, isPaid: true },
    ],
    goals: [{ id: 'g1', name: 'Quỹ xe', targetAmount: 50_000_000, currentAmount: 0, monthlyContributionTarget: 1_000_000 }],
    tasks: [], carryOver: 0,
  };
}

describe('balanceBreakdown — drill-down');

it('thu nhập gom theo danh mục, sắp giảm dần', () => {
  const d = getBalanceBreakdownDetail(snap());
  eq(d.incomes[0].label, 'Lương');
  eq(d.incomes[0].amount, 15_000_000);
  eq(d.incomes[1].label, 'Freelance');
  eq(d.incomes[1].amount, 3_000_000);
});

it('ngưỡng chi tiêu: danh mục vượt có ghi chú số vượt', () => {
  const d = getBalanceBreakdownDetail(snap());
  const shopping = d.budgets.find((b) => b.label === 'Mua sắm');
  eq(shopping?.note, 'vượt 1.000.000đ');
  const food = d.budgets.find((b) => b.label === 'Ăn uống');
  eq(food?.note, undefined, 'food trong ngưỡng → không note');
});

it('bill chưa đóng: sắp theo hạn + ghi chú trễ/còn (bỏ bill đã đóng)', () => {
  const d = getBalanceBreakdownDetail(snap());
  eq(d.unpaidBills.length, 2, 'chỉ 2 bill chưa đóng');
  eq(d.unpaidBills[0].label, 'Điện');   // dueDay 1 trước
  eq(d.unpaidBills[0].note, 'trễ 7 ngày'); // hôm nay ngày 8
  eq(d.unpaidBills[1].label, 'Nước');
  eq(d.unpaidBills[1].note, 'còn 2 ngày');
});

it('tiết kiệm/tháng: liệt kê mục tiêu có khoản đều', () => {
  const d = getBalanceBreakdownDetail(snap());
  eq(d.goalContributions[0].label, 'Quỹ xe');
  eq(d.goalContributions[0].amount, 1_000_000);
});

it('tổng khớp getSafeToSpendBreakdown (single source)', () => {
  const s = snap();
  eq(getBalanceBreakdownDetail(s).safeToSpend, getSafeToSpendBreakdown(s).safeToSpend);
});

if (process.exitCode) process.exit(process.exitCode);
