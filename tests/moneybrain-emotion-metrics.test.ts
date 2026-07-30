/* TDD — emotionMetrics.ts: breakdown theo tag + goal delay từ chi tiêu impulsive */
import {
  getEmotionSpendingBreakdown, getGoalDelayFromEmotionSpending, IMPULSIVE_EMOTION_TAGS,
} from '@/lib/moneyBrain/emotionMetrics';
import type { MoneySnapshotV1, MoneyTransactionSnapshot, MoneyGoalSnapshot } from '@/lib/moneyBrain/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function approx(a: number, b: number, msg?: string): void {
  if (Math.abs(a - b) > 1) throw new Error(`${msg ?? ''} expected ~${b}, got ${a}`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 2026-06

function txn(partial: Partial<MoneyTransactionSnapshot>): MoneyTransactionSnapshot {
  return {
    id: partial.id ?? `t-${Math.random()}`,
    type: 'expense',
    amount: 0,
    date: '2026-06-05',
    dateKey: '2026-06-05',
    weekKey: '2026-W23',
    monthKey: '2026-06',
    ...partial,
  };
}

function makeSnap(transactions: MoneyTransactionSnapshot[], goals: MoneyGoalSnapshot[] = []): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
    transactions,
    budgets: [],
    bills: [],
    goals,
    tasks: [],
  };
}

async function main() {
  describe('getEmotionSpendingBreakdown');

  await it('gom chi theo tag, bỏ qua giao dịch tháng khác/income', async () => {
    const snap = makeSnap([
      txn({ amount: 100_000, emotionTag: 'stress' }),
      txn({ amount: 200_000, emotionTag: 'preference' }),
      txn({ amount: 50_000 }), // untagged — vẫn tính vào totalExpense
      txn({ amount: 999_999, monthKey: '2026-05' }), // tháng trước — bỏ qua
      txn({ amount: 500_000, type: 'income', monthKey: '2026-06' }), // income — bỏ qua
    ]);
    const b = getEmotionSpendingBreakdown(snap);
    eq(b.totalExpense, 350_000, 'total = 100k+200k+50k');
    eq(b.taggedTotal, 300_000, 'tagged = 100k+200k');
    eq(b.byTag.stress, 100_000);
    eq(b.byTag.preference, 200_000);
    eq(b.impulsiveTotal, 100_000, 'chỉ stress thuộc nhóm impulsive');
  });

  await it('self_reward/preference/excited KHÔNG tính vào impulsive', async () => {
    for (const tag of ['self_reward', 'preference', 'excited'] as const) {
      if (IMPULSIVE_EMOTION_TAGS.includes(tag)) throw new Error(`${tag} không được nằm trong IMPULSIVE_EMOTION_TAGS`);
    }
    for (const tag of ['stress', 'sad', 'anger', 'jealousy'] as const) {
      if (!IMPULSIVE_EMOTION_TAGS.includes(tag)) throw new Error(`${tag} phải nằm trong IMPULSIVE_EMOTION_TAGS`);
    }
  });

  await it('totalExpense = 0 → ratio = 0, không chia cho 0', async () => {
    const snap = makeSnap([]);
    const b = getEmotionSpendingBreakdown(snap);
    eq(b.totalExpense, 0);
    eq(b.impulsiveRatioOfExpense, 0);
  });

  describe('getGoalDelayFromEmotionSpending');

  await it('không có impulsiveTotal → trả []', async () => {
    const snap = makeSnap([], [
      { id: 'g1', name: 'Mua nhà', targetAmount: 100_000_000, currentAmount: 0, monthlyContributionTarget: 5_000_000 },
    ]);
    eq(getGoalDelayFromEmotionSpending(snap, 0).length, 0);
  });

  await it('không có goal nào có kế hoạch tiết kiệm → trả []', async () => {
    const snap = makeSnap([], [
      { id: 'g1', name: 'Không kế hoạch', targetAmount: 100_000_000, currentAmount: 0 },
    ]);
    eq(getGoalDelayFromEmotionSpending(snap, 1_000_000).length, 0);
  });

  await it('phân bổ impulsive theo tỷ trọng contribution, tính delayPercent', async () => {
    // g1: target 5M/thang, gap 100M -> baseline 20 thang
    // g2: target 2M/thang, gap 20M -> baseline 10 thang
    // impulsiveTotal 700k -> share g1 = 5/7, g2 = 2/7 -> hit g1=500k, g2=200k
    const snap = makeSnap([], [
      { id: 'g1', name: 'Mua nhà', targetAmount: 100_000_000, currentAmount: 0, monthlyContributionTarget: 5_000_000 },
      { id: 'g2', name: 'Quỹ khẩn cấp', targetAmount: 20_000_000, currentAmount: 0, monthlyContributionTarget: 2_000_000 },
    ]);
    const delays = getGoalDelayFromEmotionSpending(snap, 700_000);
    eq(delays.length, 2);
    const g1 = delays.find((d) => d.id === 'g1')!;
    const g2 = delays.find((d) => d.id === 'g2')!;
    eq(g1.baselineMonths, 20);
    // reduced = 5M - 500k = 4.5M -> projected = 100M/4.5M ≈ 22.22
    approx(g1.projectedMonths!, 22.22, 'g1 projected');
    approx(g1.delayPercent!, 11, 'g1 delay % ~11');
    eq(g2.baselineMonths, 10);
    // reduced = 2M - 200k = 1.8M -> projected = 20M/1.8M ≈ 11.11
    approx(g2.projectedMonths!, 11.11, 'g2 projected');
    approx(g2.delayPercent!, 11, 'g2 delay % ~11');
  });

  await it('impulsive ăn hết contribution → projectedMonths null (mục tiêu đứng im)', async () => {
    const snap = makeSnap([], [
      { id: 'g1', name: 'Risky', targetAmount: 100_000_000, currentAmount: 0, monthlyContributionTarget: 1_000_000 },
    ]);
    const delays = getGoalDelayFromEmotionSpending(snap, 2_000_000); // hit = full 2M > target 1M
    eq(delays[0].projectedMonths, null, 'contribution âm/0 -> null, không chia cho số âm');
    eq(delays[0].delayPercent, null);
  });

  await it('goal đã xong (gap=0) hoặc không target → loại khỏi tính toán', async () => {
    const snap = makeSnap([], [
      { id: 'done', name: 'Done', targetAmount: 10_000_000, currentAmount: 10_000_000, monthlyContributionTarget: 1_000_000 },
      { id: 'no-target', name: 'No target', targetAmount: 10_000_000, currentAmount: 0 },
    ]);
    eq(getGoalDelayFromEmotionSpending(snap, 500_000).length, 0);
  });

  console.log('\nemotionMetrics test complete.');
}

main();
