/* Phase 2 — Deterministic handlers: balance/income/category/budget/bills/
 * safe-to-spend/goals/tasks-pipeline/health/streak. KHÔNG gọi LLM. */
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import { __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { handleQueryIncome } from '@/lib/aiMoneyChat/handlers/handleQueryIncome';
import { handleQueryBudget } from '@/lib/aiMoneyChat/handlers/handleQueryBudget';
import { handleQueryBill } from '@/lib/aiMoneyChat/handlers/handleQueryBill';
import { handleQuerySafeToSpend } from '@/lib/aiMoneyChat/handlers/handleQuerySafeToSpend';
import { handleQueryTasks } from '@/lib/aiMoneyChat/handlers/handleQueryTasks';
import { handleQueryHealth } from '@/lib/aiMoneyChat/handlers/handleQueryHealth';
import { handleQueryStreak } from '@/lib/aiMoneyChat/handlers/handleQueryStreak';

type AsyncFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function inc(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) throw new Error(`expected to include "${needle}".\n${haystack}`);
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${String(b)}, got ${String(a)}`);
}

const UID = 'det-user';
const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 10:00 VN ngày 08/06/2026
const MK = '2026-06';
const ctxOf = (s: ClientSnapshotInput) => ({ clientSnapshot: s });

const SNAP: ClientSnapshotInput = {
  version: 'money_snapshot_v1',
  clientNow: CLIENT_NOW,
  timezone: VN,
  monthKey: MK,
  carryOver: 0,
  wallets: { main: 20_000_000, emergency: 12_500_000, billFund: 1_200_000 },
  transactions: [
    { type: 'income', amount: 20_000_000, categoryId: 'salary', dateKey: '2026-06-01', monthKey: MK, weekKey: '2026-W23', date: '2026-06-01T03:00:00Z' },
    { type: 'expense', amount: 2_400_000, categoryId: 'food', categoryName: 'Ăn uống', dateKey: '2026-06-02', monthKey: MK, weekKey: '2026-W23', date: '2026-06-02T03:00:00Z' },
    { type: 'expense', amount: 1_800_000, categoryId: 'shopping', categoryName: 'Mua sắm', dateKey: '2026-06-03', monthKey: MK, weekKey: '2026-W23', date: '2026-06-03T03:00:00Z' },
  ],
  budgets: [
    { categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 },
    { categoryId: 'shopping', name: 'Mua sắm', limit: 1_500_000 },
  ],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 4, isPaid: true },
    { id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 10, isPaid: false },
    { id: 'b3', name: 'Internet', amount: 250_000, dueDay: 12, isPaid: false },
  ],
  goals: [
    { id: 'g1', name: 'Mua nhà', targetAmount: 6_000_000_000, savedAmount: 120_000_000, deadline: '2035-12-31', monthlyContributionTarget: 5_000_000 },
    { id: 'g2', name: 'Quỹ khẩn cấp', targetAmount: 50_000_000, savedAmount: 12_500_000, deadline: '2026-12-31', monthlyContributionTarget: 2_000_000 },
  ],
  tasks: [
    { id: 't1', name: 'Freelance logo', expectedAmount: 3_000_000, startDate: '2026-06-01', endDate: '2026-06-30' },
    { id: 't2', name: 'Dạy kèm', expectedAmount: 2_000_000, startDate: '2026-05-01', endDate: '2026-06-05' },
    { id: 't3', name: 'Viết blog', expectedAmount: 800_000, actualAmount: 800_000, startDate: '2026-06-01', endDate: '2026-06-10', completedAt: '2026-06-03T03:00:00Z' },
  ],
  user: { rank: 'gold', xp: 5000, streak: 7, streakShields: 2 },
};

async function main() {
  __clearSnapshotCacheForTest();

  describe('handleQueryIncome');
  await it('tháng này thu = 20.000.000 (deterministic)', async () => {
    const r = await handleQueryIncome(UID, routeIntent('tháng này tôi thu bao nhiêu'), ctxOf(SNAP));
    inc(r.message, '20.000.000');
    eq(r.meta.source, 'deterministic');
  });
  await it('hôm nay chưa có thu -> báo chưa ghi nhận', async () => {
    const r = await handleQueryIncome(UID, routeIntent('hôm nay tôi thu bao nhiêu'), ctxOf(SNAP));
    inc(r.message, 'chưa ghi nhận');
  });

  describe('handleQueryBudget — category spending');
  await it('ăn uống đã chi 2.4M / 2M -> vượt ngân sách', async () => {
    const r = await handleQueryBudget(UID, routeIntent('ăn uống tháng này xài bao nhiêu'), ctxOf(SNAP));
    inc(r.message, '2.400.000');
    inc(r.message, 'vượt ngân sách');
    eq(r.meta.source, 'deterministic');
  });

  describe('handleQueryBudget — budget status');
  await it('tổng ngân sách 3.5M + danh mục vượt', async () => {
    const r = await handleQueryBudget(UID, routeIntent('danh mục nào vượt ngân sách'), ctxOf(SNAP));
    inc(r.message, '3.500.000');
    inc(r.message, 'Ăn uống');
    inc(r.message, '(đã vượt)');
  });

  describe('handleQueryBill — coverage (thiếu)');
  await it('quỹ bill 1.2M < unpaid 2.75M -> thiếu 1.55M', async () => {
    const r = await handleQueryBill(UID, routeIntent('quỹ bill có đủ trả bill không'), ctxOf(SNAP));
    inc(r.message, '1.550.000');
    inc(r.message, 'thiếu');
    eq(r.meta.source, 'deterministic');
  });

  describe('handleQueryBill — upcoming 7 ngày');
  await it('7 ngày tới: Tiền nhà (10) + Internet (12), tổng 2.75M', async () => {
    const r = await handleQueryBill(UID, routeIntent('7 ngày tới có bill nào'), ctxOf(SNAP));
    inc(r.message, 'Tiền nhà');
    inc(r.message, 'Internet');
    inc(r.message, '2.750.000');
    inc(r.message, 'hạn ngày 10');
  });

  describe('handleQuerySafeToSpend — engine v1.1');
  await it('20M - 3.5M - 2.75M - 7M = 6.75M -> an toàn', async () => {
    const r = await handleQuerySafeToSpend(UID, routeIntent('tháng này còn bao nhiêu để xài'), ctxOf(SNAP));
    inc(r.message, '6.750.000');
    inc(r.message, 'an toàn');
    eq(r.meta.source, 'deterministic');
  });

  describe('handleQueryTasks — pipeline');
  await it('làm hết task -> +5M, đã hoàn thành 800k', async () => {
    const r = await handleQueryTasks(UID, routeIntent('nếu làm hết task thì có thêm bao nhiêu'), ctxOf(SNAP));
    inc(r.message, '5.000.000');
    inc(r.message, '800.000');
    eq(r.meta.source, 'deterministic');
  });

  describe('handleQueryHealth — deterministic 100pt');
  await it('có breakdown /100, không gọi LLM', async () => {
    const r = await handleQueryHealth(UID, routeIntent('điểm sức khỏe tài chính'), ctxOf(SNAP));
    inc(r.message, '/100');
    inc(r.message, 'Dòng tiền');
    eq(r.meta.source, 'deterministic');
  });
  await it('deterministic: 2 lần cùng kết quả', async () => {
    const a = await handleQueryHealth(UID, routeIntent('điểm sức khỏe tài chính'), ctxOf(SNAP));
    const b = await handleQueryHealth(UID, routeIntent('điểm sức khỏe tài chính'), ctxOf(SNAP));
    eq(a.message, b.message);
  });

  describe('handleQueryStreak');
  await it('streak 7 ngày + 2 khiên', async () => {
    const r = await handleQueryStreak(UID, routeIntent('streak của tôi bao nhiêu'), ctxOf(SNAP));
    inc(r.message, '7 ngày');
    inc(r.message, '2 khiên');
    eq(r.meta.source, 'deterministic');
  });
  await it('thiếu user -> báo thiếu dữ liệu, không bịa 0', async () => {
    const noUser: ClientSnapshotInput = { ...SNAP, user: undefined };
    const r = await handleQueryStreak(UID, routeIntent('streak của tôi bao nhiêu'), ctxOf(noUser));
    inc(r.message, 'chưa có dữ liệu streak');
  });

  describe('guard — last_month thiếu dữ liệu không trả 0 giả');
  await it('income tháng trước thiếu data -> báo thiếu', async () => {
    const r = await handleQueryIncome(UID, routeIntent('tháng trước tôi thu bao nhiêu'), ctxOf(SNAP));
    inc(r.message, 'chưa có dữ liệu');
  });

  console.log('\nDeterministic handlers test complete.');
}

main();
