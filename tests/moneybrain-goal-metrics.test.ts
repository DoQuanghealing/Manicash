/* TDD — goalMetrics.ts: progress, gap, monthlyContributionTarget, at-risk */
import {
  getTotalGoalSaved, getPlannedMonthlyGoalContributions,
  getGoalProgressList, getGoalProgressById, getGoalGap, getAtRiskGoals,
} from '@/lib/moneyBrain/goalMetrics';
import type { MoneySnapshotV1, MoneyGoalSnapshot } from '@/lib/moneyBrain/types';

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

function makeSnap(goals: MoneyGoalSnapshot[]): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
    transactions: [],
    budgets: [],
    bills: [],
    goals,
    tasks: [],
  };
}

const GOALS: MoneyGoalSnapshot[] = [
  {
    id: 'g1', name: 'Mua nhà', targetAmount: 1_000_000_000, currentAmount: 100_000_000,
    deadline: '2027-06-30', monthlyContributionTarget: 5_000_000,
  },
  {
    id: 'g2', name: 'Quỹ khẩn cấp', targetAmount: 50_000_000, currentAmount: 25_000_000,
    deadline: '2026-12-31', monthlyContributionTarget: 2_000_000,
  },
  {
    id: 'g3', name: 'Không có deadline', targetAmount: 200_000_000, currentAmount: 10_000_000,
    monthlyContributionTarget: 1_500_000,
  },
];

async function main() {
  describe('getTotalGoalSaved');

  await it('tổng currentAmount của tất cả goals', async () => {
    const snap = makeSnap(GOALS);
    eq(getTotalGoalSaved(snap), 100_000_000 + 25_000_000 + 10_000_000);
  });

  describe('getPlannedMonthlyGoalContributions — KHÔNG dùng currentAmount');

  await it('sum monthlyContributionTarget', async () => {
    const snap = makeSnap(GOALS);
    eq(getPlannedMonthlyGoalContributions(snap), 5_000_000 + 2_000_000 + 1_500_000, 'sum contributions');
  });

  await it('goal thiếu monthlyContributionTarget → contribute 0', async () => {
    const snap = makeSnap([
      { id: 'g1', name: 'Mua nhà', targetAmount: 1_000_000_000, currentAmount: 100_000_000 },
      { id: 'g2', name: 'Quỹ', targetAmount: 50_000_000, currentAmount: 25_000_000, monthlyContributionTarget: 2_000_000 },
    ]);
    eq(getPlannedMonthlyGoalContributions(snap), 2_000_000, 'missing target = 0 contribution');
  });

  await it('KHÔNG dùng currentAmount làm monthly contribution', async () => {
    // Nếu AI hay code nhầm dùng currentAmount → số sẽ rất lớn (100M vs 5M).
    // Test này đảm bảo hàm chỉ dùng monthlyContributionTarget.
    const snap = makeSnap([
      {
        id: 'g1', name: 'Test',
        targetAmount: 1_000_000_000,
        currentAmount: 50_000_000, // 50M (không phải monthly target)
        monthlyContributionTarget: 3_000_000, // đúng là 3M/tháng
      },
    ]);
    eq(getPlannedMonthlyGoalContributions(snap), 3_000_000, 'must use monthlyContributionTarget, not currentAmount');
    if (getPlannedMonthlyGoalContributions(snap) === 50_000_000) {
      throw new Error('CRITICAL: using currentAmount as monthly contribution!');
    }
  });

  describe('getGoalProgressList');

  await it('progress, gap tính đúng', async () => {
    const snap = makeSnap(GOALS);
    const list = getGoalProgressList(snap);
    const g1 = list.find((g) => g.id === 'g1')!;
    const g2 = list.find((g) => g.id === 'g2')!;

    eq(g1.progress, 10, 'g1: 100M/1B = 10%');
    eq(g1.gap, 900_000_000, 'g1 gap');
    eq(g2.progress, 50, 'g2: 25M/50M = 50%');
    eq(g2.gap, 25_000_000, 'g2 gap');
  });

  await it('no deadline → requiredMonthlyContribution undefined', async () => {
    const snap = makeSnap([GOALS[2]]); // g3 has no deadline
    const list = getGoalProgressList(snap);
    eq(list[0].requiredMonthlyContribution, undefined, 'no deadline = no required contribution');
    eq(list[0].isAtRisk, undefined, 'no deadline = no at-risk');
  });

  await it('requiredMonthlyContribution = gap / monthsRemaining', async () => {
    // g2: gap = 25M, deadline 2026-12, clientNow 2026-06 → 6 months remaining
    const snap = makeSnap([GOALS[1]]);
    const list = getGoalProgressList(snap);
    const g2 = list[0];
    // 6 months remaining, gap = 25M
    approx(g2.requiredMonthlyContribution!, 25_000_000 / 6, 'required = gap/months');
  });

  describe('getAtRiskGoals');

  await it('isAtRisk khi requiredMonthly > monthlyContributionTarget', async () => {
    const snap = makeSnap([
      {
        id: 'risky', name: 'Risky Goal',
        targetAmount: 100_000_000,
        currentAmount: 0, // gap = 100M
        deadline: '2026-09-30', // 3 months from June 2026
        monthlyContributionTarget: 1_000_000, // cần 33M/tháng mà chỉ đặt 1M → at risk
      },
      {
        id: 'safe', name: 'Safe Goal',
        targetAmount: 10_000_000,
        currentAmount: 9_000_000, // gap = 1M
        deadline: '2026-12-31', // 6 months
        monthlyContributionTarget: 2_000_000, // need ~167k/month, has 2M → OK
      },
    ]);
    const atRisk = getAtRiskGoals(snap);
    if (atRisk.length !== 1) throw new Error(`Expected 1 at-risk goal, got ${atRisk.length}`);
    eq(atRisk[0].id, 'risky');
  });

  await it('getGoalGap đúng', async () => {
    const snap = makeSnap(GOALS);
    eq(getGoalGap(snap, 'g2'), 25_000_000, 'g2 gap = 50M - 25M');
    eq(getGoalGap(snap, 'nonexistent'), null, 'missing goal = null');
  });

  await it('progress capped 100 khi đã hoàn thành', async () => {
    const snap = makeSnap([
      { id: 'done', name: 'Done', targetAmount: 10_000_000, currentAmount: 12_000_000 },
    ]);
    const list = getGoalProgressList(snap);
    eq(list[0].progress, 100, 'progress capped at 100');
    eq(list[0].gap, 0, 'gap = 0 when completed');
  });

  console.log('\ngoalMetrics test complete.');
}

main();
