import {
  getFinanceSnapshot,
  validateClientSnapshot,
  invalidateSnapshotCache,
  __clearSnapshotCacheForTest,
} from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import { handleQueryBalance } from '@/lib/aiMoneyChat/handlers/handleQueryBalance';
import { handleQueryBill } from '@/lib/aiMoneyChat/handlers/handleQueryBill';
import { handleQueryTasks } from '@/lib/aiMoneyChat/handlers/handleQueryTasks';
import { handleLogTransaction } from '@/lib/aiMoneyChat/handlers/handleLogTransaction';

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
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectIncludes(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected message to include "${needle}".\n--- message ---\n${haystack}`);
  }
}

function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`Expected ${label} to be true`);
}

const UID = 'test-user';
const ctxOf = (clientSnapshot: ClientSnapshotInput) => ({ clientSnapshot });

// Số tiền tròn dễ kiểm tra qua nhóm ngàn vi-VN.
const SNAPSHOT: ClientSnapshotInput = {
  wallets: { main: 4_500_000, emergency: 6_000_000, billFund: 1_200_000 },
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: true },
    { id: 'b2', name: 'Internet', amount: 250_000, dueDay: 31, isPaid: false },
  ],
  tasks: [
    {
      id: 't1',
      name: 'Viết bài thuê',
      expectedAmount: 1_500_000,
      startDate: '2020-01-01',
      subTasks: [{ isCompleted: true }, { isCompleted: false }],
    },
  ],
};

async function main() {
  __clearSnapshotCacheForTest();

  describe('validateClientSnapshot()');
  await it('chấp nhận snapshot có wallets', () => {
    const v = validateClientSnapshot(SNAPSHOT);
    expectTrue(v !== null, 'validated');
    expectEqual(v!.wallets!.main, 4_500_000);
  });
  await it('loại bỏ rác (null / số / object rỗng)', () => {
    expectEqual(validateClientSnapshot(null), null);
    expectEqual(validateClientSnapshot(42), null);
    expectEqual(validateClientSnapshot({}), null);
  });
  await it('coerce số âm về 0', () => {
    const v = validateClientSnapshot({ wallets: { main: -999, emergency: 'x', billFund: 100 } });
    expectEqual(v!.wallets!.main, 0);
    expectEqual(v!.wallets!.emergency, 0);
    expectEqual(v!.wallets!.billFund, 100);
  });

  describe('getFinanceSnapshot() — hybrid client path');
  await it('build từ client: tổng ví đúng, source=client', async () => {
    __clearSnapshotCacheForTest();
    const snap = await getFinanceSnapshot(UID, ctxOf(SNAPSHOT));
    expectEqual(snap.meta.source, 'client');
    expectEqual(snap.wallets.total, 11_700_000);
    expectEqual(snap.bills.items.length, 2);
  });
  await it('bill status: đã trả -> paid, chưa trả -> due/overdue', async () => {
    const snap = await getFinanceSnapshot(UID, ctxOf(SNAPSHOT));
    const dien = snap.bills.items.find((b) => b.name === 'Tiền điện')!;
    const net = snap.bills.items.find((b) => b.name === 'Internet')!;
    expectEqual(dien.status, 'paid');
    expectTrue(net.status === 'due' || net.status === 'overdue', 'internet unpaid');
    expectEqual(snap.bills.totalPaid, 350_000);
    expectEqual(snap.bills.totalDue, 250_000);
  });
  await it('cache: lượt sau không gửi client vẫn trả cached (source=client)', async () => {
    __clearSnapshotCacheForTest();
    await getFinanceSnapshot(UID, ctxOf(SNAPSHOT)); // nạp cache
    const again = await getFinanceSnapshot(UID, {}); // không client, không forceRefresh
    expectEqual(again.meta.source, 'client');
    expectEqual(again.wallets.total, 11_700_000);
  });
  await it('invalidateSnapshotCache xóa đúng uid', async () => {
    __clearSnapshotCacheForTest();
    await getFinanceSnapshot(UID, ctxOf(SNAPSHOT));
    invalidateSnapshotCache(UID);
    // sau khi xóa, không client -> rơi xuống Firestore fallback (không env -> empty).
    const after = await getFinanceSnapshot(UID, {});
    expectTrue(after.meta.source !== 'client', 'cache cleared');
  });

  describe('handleQueryBalance()');
  await it('trả Markdown số dư 3 ví + tổng', async () => {
    const intent = routeIntent('tôi còn bao nhiêu tiền');
    const reply = await handleQueryBalance(UID, intent, ctxOf(SNAPSHOT));
    expectIncludes(reply.message, '4.500.000');
    expectIncludes(reply.message, '6.000.000');
    expectIncludes(reply.message, '1.200.000');
    expectIncludes(reply.message, '11.700.000');
    expectEqual(reply.ui.kind, 'none');
    expectEqual(reply.meta.source, 'deterministic');
  });

  describe('handleQueryBill()');
  await it('hỏi cụ thể "tiền điện đóng chưa" -> ĐÃ ĐÓNG + số tiền', async () => {
    const intent = routeIntent('tiền điện đóng chưa');
    expectEqual(intent.type, 'QUERY_BILL_STATUS');
    const reply = await handleQueryBill(UID, intent, ctxOf(SNAPSHOT));
    expectIncludes(reply.message, 'Tiền điện');
    expectIncludes(reply.message, 'ĐÃ ĐÓNG');
    expectIncludes(reply.message, '350.000');
  });
  await it('hỏi "internet trả chưa" -> chưa đóng', async () => {
    const intent = routeIntent('internet trả chưa');
    const reply = await handleQueryBill(UID, intent, ctxOf(SNAPSHOT));
    expectIncludes(reply.message, 'Internet');
    expectTrue(
      reply.message.includes('CHƯA ĐÓNG') || reply.message.includes('QUÁ HẠN'),
      'internet unpaid wording',
    );
  });
  await it('không có bill -> báo chưa thiết lập', async () => {
    const intent = routeIntent('tiền nước đóng chưa');
    const reply = await handleQueryBill(UID, intent, ctxOf({ wallets: { main: 1 } }));
    expectIncludes(reply.message, 'chưa');
  });

  describe('handleQueryTasks()');
  await it('liệt kê nhiệm vụ active + thu nhập dự kiến', async () => {
    const intent = routeIntent('hôm nay tôi có việc gì');
    expectEqual(intent.type, 'QUERY_TASKS_TODAY');
    const reply = await handleQueryTasks(UID, intent, ctxOf(SNAPSHOT));
    expectIncludes(reply.message, 'Viết bài thuê');
    expectIncludes(reply.message, '1/2');
    expectIncludes(reply.message, '1.500.000');
  });

  describe('handleLogTransaction()');
  await it('confirm-transaction card với số tiền parse được', async () => {
    const intent = routeIntent('mua trứng 30k');
    expectEqual(intent.type, 'LOG_TRANSACTION');
    const reply = await handleLogTransaction(intent);
    expectEqual(reply.ui.kind, 'confirm-transaction');
    expectIncludes(reply.message, '30.000');
    const payload = reply.ui.payload as { amount: number; type: string };
    expectEqual(payload.amount, 30_000);
    expectEqual(payload.type, 'expense');
  });

  console.log('\nPhase 2 handler test suite complete.');
}

main();
