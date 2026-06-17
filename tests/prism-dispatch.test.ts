/* PRISM (Lõi Kim Cương) — P1: bộ điều phối offline phía client.
 * Kiểm: intent tra cứu -> trả lời tại client (deterministic, khớp số liệu);
 * intent khó (CFO/follow-up) + lệnh hành động -> trả null (escalate server). */
import { dispatchPrism } from '@/lib/aiMoneyChat/prism/prismDispatch';
import { __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';

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
function isNull(v: unknown, msg?: string): void {
  if (v !== null) throw new Error(`${msg ?? ''} expected null, got ${JSON.stringify(v)}`);
}
function notNull<T>(v: T | null, msg?: string): T {
  if (v === null) throw new Error(`${msg ?? ''} expected non-null`);
  return v;
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 10:00 VN ngày 08/06/2026
const MK = '2026-06';

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
  ],
  budgets: [{ categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 }],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 4, isPaid: true },
    { id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 10, isPaid: false },
  ],
  goals: [
    { id: 'g1', name: 'Mua nhà', targetAmount: 6_000_000_000, savedAmount: 120_000_000, deadline: '2035-12-31', monthlyContributionTarget: 5_000_000 },
  ],
  tasks: [
    { id: 't1', name: 'Freelance logo', expectedAmount: 3_000_000, startDate: '2026-06-01', endDate: '2026-06-30' },
  ],
  user: { rank: 'gold', xp: 5000, streak: 7, streakShields: 2 },
};

async function main() {
  __clearSnapshotCacheForTest();

  describe('PRISM — intent tra cứu trả lời OFFLINE tại client');

  await it('số dư -> non-null, deterministic, có số liệu', async () => {
    const r = notNull(await dispatchPrism('tôi còn bao nhiêu tiền', { uid: 'u1', clientSnapshot: SNAP }));
    eq(r.meta.source, 'deterministic', 'source');
    inc(r.message, '20.000.000'); // ví chính
  });

  await it('tháng này còn bao nhiêu để xài -> non-null', async () => {
    const r = notNull(await dispatchPrism('tháng này còn bao nhiêu để xài', { uid: 'u1', clientSnapshot: SNAP }));
    eq(r.meta.source, 'deterministic', 'source');
    inc(r.message, 'an toàn');
  });

  await it('bill điện đóng chưa -> non-null', async () => {
    const r = notNull(await dispatchPrism('tiền nhà đóng chưa', { uid: 'u1', clientSnapshot: SNAP }));
    eq(r.meta.intent, 'QUERY_BILL_STATUS', 'intent');
  });

  await it('khoác giọng Lord Diamond (lead-in có emoji nhận diện)', async () => {
    const r = notNull(await dispatchPrism('tôi còn bao nhiêu tiền', { uid: 'u1', clientSnapshot: SNAP }));
    if (!/💎|📒|✨|🤵|📊/u.test(r.message)) throw new Error(`thiếu lead-in quản gia:\n${r.message}`);
    inc(r.message, '20.000.000'); // số liệu vẫn nguyên vẹn sau khi khoác giọng
  });

  describe('PRISM — intent khó / hành động -> escalate (null)');

  await it('báo cáo CFO -> null (đẩy server/LLM)', async () => {
    isNull(await dispatchPrism('lên báo cáo CFO tháng này', { uid: 'u1', clientSnapshot: SNAP }), 'cfo');
  });

  await it('tư vấn cắt giảm -> null', async () => {
    isNull(await dispatchPrism('gợi ý cắt giảm chi tiêu giúp tôi', { uid: 'u1', clientSnapshot: SNAP }), 'advice');
  });

  await it('lệnh chuyển quỹ -> null (server validate + actionRequest)', async () => {
    isNull(await dispatchPrism('chuyển 2 triệu sang quỹ dự phòng', { uid: 'u1', clientSnapshot: SNAP }), 'action');
  });

  await it('câu rỗng -> null', async () => {
    isNull(await dispatchPrism('   ', { uid: 'u1', clientSnapshot: SNAP }), 'empty');
  });
}

main().then(() => { if (process.exitCode) process.exit(process.exitCode); });
