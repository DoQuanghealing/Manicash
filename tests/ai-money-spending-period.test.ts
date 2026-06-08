/* TDD — handleQuerySpending phải phân biệt "hôm nay" vs "tháng này".
 * Snapshot có giao dịch hôm nay + giao dịch ngày khác trong tháng. */
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import { handleQuerySpending } from '@/lib/aiMoneyChat/handlers/handleQuerySpending';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { getTodayKey, getMonthKey } from '@/lib/moneyBrain/dateRange';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
function inc(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) throw new Error(`Expected to include "${needle}".\n${haystack}`);
}
function notInc(haystack: string, needle: string): void {
  if (haystack.includes(needle)) throw new Error(`Expected NOT to include "${needle}".\n${haystack}`);
}

const UID = 'period-user';
const VN = 'Asia/Ho_Chi_Minh';
// clientNow cố định để test ổn định, không phụ thuộc giờ chạy test.
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 10:00 VN 08/06
const todayKey = getTodayKey(CLIENT_NOW, VN);     // 2026-06-08
const monthKey = getMonthKey(CLIENT_NOW, VN);     // 2026-06
const earlierKey = '2026-06-02';

const SNAP: ClientSnapshotInput = {
  version: 'money_snapshot_v1',
  clientNow: CLIENT_NOW,
  timezone: VN,
  monthKey,
  wallets: { main: 5_000_000, emergency: 1_000_000, billFund: 0 },
  transactions: [
    // Hôm nay: 600k quần áo + 60k ăn uống = 660k
    { id: 't1', type: 'expense', amount: 600_000, categoryId: 'shopping', date: `${todayKey}T02:00:00Z`, dateKey: todayKey, monthKey },
    { id: 't2', type: 'expense', amount: 60_000, categoryId: 'food', date: `${todayKey}T03:00:00Z`, dateKey: todayKey, monthKey },
    // Ngày khác trong tháng: 2.000.000 (KHÔNG được tính vào "hôm nay")
    { id: 't3', type: 'expense', amount: 2_000_000, categoryId: 'food', date: `${earlierKey}T03:00:00Z`, dateKey: earlierKey, monthKey },
  ],
  budgets: [
    { categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 },
    { categoryId: 'shopping', name: 'Mua sắm', limit: 1_500_000 },
  ],
};
const ctx = { clientSnapshot: SNAP };

async function main() {
  describe('handleQuerySpending — period today');
  await it('"hôm nay tôi chi bao nhiêu" -> 660.000, KHÔNG phải 2.660.000', async () => {
    const reply = await handleQuerySpending(UID, routeIntent('hôm nay tôi chi bao nhiêu'), ctx);
    inc(reply.message, '660.000');
    inc(reply.message, 'Hôm nay');
    notInc(reply.message, '2.660.000');
  });

  describe('handleQuerySpending — period this_month');
  await it('"tháng này tôi chi bao nhiêu" -> 2.660.000', async () => {
    const reply = await handleQuerySpending(UID, routeIntent('tháng này tôi chi bao nhiêu'), ctx);
    inc(reply.message, '2.660.000');
    inc(reply.message, 'Tháng này');
  });

  describe('handleQuerySpending — không có chi hôm nay');
  await it('snapshot không có giao dịch hôm nay -> báo chưa chi', async () => {
    const empty: ClientSnapshotInput = { ...SNAP, transactions: [SNAP.transactions![2]] };
    const reply = await handleQuerySpending(UID, routeIntent('hôm nay chi bao nhiêu'), { clientSnapshot: empty });
    inc(reply.message, 'Hôm nay');
    inc(reply.message, 'chưa');
  });

  describe('handleQuerySpending — last_month thiếu dữ liệu (không trả 0đ như sự thật)');
  await it('snapshot chỉ có tháng hiện tại -> "tháng trước" báo CHƯA CÓ DỮ LIỆU', async () => {
    const reply = await handleQuerySpending(UID, routeIntent('tháng trước tôi chi bao nhiêu'), ctx);
    inc(reply.message, 'chưa có dữ liệu');
    notInc(reply.message, 'chưa ghi nhận khoản chi nào');
  });
  await it('snapshot CÓ giao dịch tháng trước -> trả đúng tổng tháng trước', async () => {
    const withPrev: ClientSnapshotInput = {
      ...SNAP,
      transactions: [
        ...SNAP.transactions!,
        { id: 'p1', type: 'expense', amount: 1_234_000, categoryId: 'food', date: '2026-05-10T03:00:00Z', dateKey: '2026-05-10', monthKey: '2026-05' },
      ],
    };
    const reply = await handleQuerySpending(UID, routeIntent('tháng trước tôi chi bao nhiêu'), { clientSnapshot: withPrev });
    inc(reply.message, '1.234.000');
    inc(reply.message, 'Tháng trước');
    notInc(reply.message, 'chưa có dữ liệu');
  });

  console.log('\nSpending-by-period test complete.');
}

main();
