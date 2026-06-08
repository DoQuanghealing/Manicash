import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import { __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { handleQuerySpending } from '@/lib/aiMoneyChat/handlers/handleQuerySpending';
import { handleQuerySavings } from '@/lib/aiMoneyChat/handlers/handleQuerySavings';
import { handleQuerySafeToSpend } from '@/lib/aiMoneyChat/handlers/handleQuerySafeToSpend';
import { handleQueryGoals } from '@/lib/aiMoneyChat/handlers/handleQueryGoals';
import { handleQueryBill } from '@/lib/aiMoneyChat/handlers/handleQueryBill';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void {
  console.log(`\n${name}`);
}
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try {
    await fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}
function expectIncludes(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) throw new Error(`Expected to include "${needle}".\n${haystack}`);
}
function expectTrue(v: boolean, label: string): void {
  if (!v) throw new Error(`Expected ${label} to be true`);
}

const UID = 'q-user';
const ctxOf = (clientSnapshot: ClientSnapshotInput) => ({ clientSnapshot });

const SNAP: ClientSnapshotInput = {
  wallets: { main: 4_500_000, emergency: 6_000_000, billFund: 1_200_000 },
  transactions: [
    { type: 'income', amount: 20_000_000, categoryId: 'salary' },
    { type: 'expense', amount: 2_400_000, categoryId: 'food' },
    { type: 'expense', amount: 1_800_000, categoryId: 'shopping' },
    { type: 'transfer', amount: 2_000_000, toWallet: 'emergency' },
  ],
  budgets: [
    { categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 },
    { categoryId: 'shopping', name: 'Mua sắm', limit: 1_500_000 },
  ],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: true },
    { id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 1, isPaid: false },
    { id: 'b3', name: 'Internet', amount: 250_000, dueDay: 31, isPaid: false },
  ],
  goals: [
    { id: 'g1', name: 'Mua xe máy', targetAmount: 50_000_000, savedAmount: 12_000_000, deadline: '2026-12-01', monthlyContribution: 500_000 },
  ],
};

async function main() {
  __clearSnapshotCacheForTest();

  describe('Bug fix — phân loại intent');
  await it('"còn bill nào chưa đóng tiền" -> QUERY_BILL_STATUS (chưa đóng đảo thứ tự)', () => {
    expectEqual(routeIntent('tôi còn bill nào chưa đóng tiền').type, 'QUERY_BILL_STATUS');
  });
  await it('"tổng 1 tháng bill cố định bao nhiêu" -> BILL (không nhầm LOG vì số 1)', () => {
    expectEqual(routeIntent('tổng 1 tháng bill cố định của tôi là bao nhiêu').type, 'QUERY_BILL_STATUS');
  });
  await it('"hôm nay tôi đã chi bao nhiêu tiền" -> QUERY_SPENDING', () => {
    expectEqual(routeIntent('hôm nay tôi đã chi bao nhiêu tiền').type, 'QUERY_SPENDING');
  });
  await it('"tôi còn bao nhiêu tiền" vẫn là QUERY_BALANCE (không nhầm BILL)', () => {
    expectEqual(routeIntent('tôi còn bao nhiêu tiền').type, 'QUERY_BALANCE');
  });

  describe('handleQueryBill — liệt kê bill chưa đóng + tổng');
  await it('câu chung -> liệt kê + tổng còn phải đóng', async () => {
    const reply = await handleQueryBill(UID, routeIntent('tôi còn bill nào chưa đóng tiền'), ctxOf(SNAP));
    expectIncludes(reply.message, 'Tiền nhà');
    expectIncludes(reply.message, 'Internet');
    // tổng chưa trả = 2.500.000 + 250.000 = 2.750.000
    expectIncludes(reply.message, '2.750.000');
  });

  describe('handleQuerySpending');
  await it('tổng chi + top danh mục', async () => {
    const reply = await handleQuerySpending(UID, routeIntent('hôm nay tôi đã chi bao nhiêu'), ctxOf(SNAP));
    expectIncludes(reply.message, '4.200.000'); // 2.4M + 1.8M
    expectIncludes(reply.message, 'Ăn uống');
  });

  describe('handleQuerySavings');
  await it('savings + tỷ lệ + quỹ', async () => {
    const reply = await handleQuerySavings(UID, routeIntent('tiết kiệm tháng này được bao nhiêu'), ctxOf(SNAP));
    expectIncludes(reply.message, '2.000.000'); // transfer to emergency
    expectIncludes(reply.message, '79%'); // (20M-4.2M)/20M
    expectIncludes(reply.message, '6.000.000'); // emergency
  });

  describe('handleQuerySafeToSpend');
  await it('safeToSpend + cảnh báo lố', async () => {
    const reply = await handleQuerySafeToSpend(UID, routeIntent('tháng này còn bao nhiêu để xài'), ctxOf(SNAP));
    // budget 3.5M - chi 4.2M - bill chưa trả 2.75M -> kẹp 0
    expectIncludes(reply.message, '0');
    expectIncludes(reply.message, 'vượt hạn mức');
  });

  describe('handleQueryGoals');
  await it('liệt kê mục tiêu + cảnh báo at-risk', async () => {
    const reply = await handleQueryGoals(UID, routeIntent('mục tiêu của tôi tới đâu rồi'), ctxOf(SNAP));
    expectIncludes(reply.message, 'Mua xe máy');
    expectIncludes(reply.message, '12.000.000');
    expectIncludes(reply.message, '24%'); // 12/50
    expectTrue(reply.message.includes('nguy cơ') || reply.message.includes('trễ hạn'), 'at-risk warning');
  });
  await it('lọc theo tên mục tiêu cụ thể', async () => {
    const reply = await handleQueryGoals(UID, routeIntent('mục tiêu mua xe tới đâu rồi'), ctxOf(SNAP));
    expectIncludes(reply.message, 'Mua xe máy');
  });
  await it('không có mục tiêu -> mời tạo', async () => {
    const reply = await handleQueryGoals(UID, routeIntent('mục tiêu tới đâu'), ctxOf({ wallets: { main: 1 } }));
    expectIncludes(reply.message, 'chưa đặt mục tiêu');
  });

  console.log('\nDeterministic queries v2 test complete.');
}

main();
