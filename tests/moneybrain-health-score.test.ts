/* TDD — healthScore.ts: deterministic 100pt score, no LLM */
import { getFinancialHealthScore } from '@/lib/moneyBrain/healthScore';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function between(a: number, lo: number, hi: number, msg?: string): void {
  if (a < lo || a > hi) throw new Error(`${msg ?? ''} expected ${a} in [${lo}, ${hi}]`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const MK = '2026-06';

function makeSnap(overrides: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 3_000_000 },
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    tasks: [],
    ...overrides,
  };
}

// ─── Full-score snapshot ───────────────────────────────────────────────────────
function makePerfectSnap(): MoneySnapshotV1 {
  return makeSnap({
    wallets: { main: 10_000_000, emergency: 15_000_000, billFund: 5_000_000 },
    transactions: [
      // Income: 10M
      { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      // Expense: 3M (net +7M → cashflow positive)
      { id: 'e1', type: 'expense', amount: 3_000_000, categoryId: 'food', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
    ],
    budgets: [
      { categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }, // 3M spent < 5M limit → no overbudget
    ],
    bills: [
      { id: 'b1', name: 'Paid Bill', amount: 2_000_000, dueDay: 5, isPaid: true }, // all paid → no unpaid bills
    ],
    goals: [
      { id: 'g1', name: 'Goal', targetAmount: 50_000_000, currentAmount: 10_000_000, monthlyContributionTarget: 2_000_000 },
    ],
    tasks: [
      {
        id: 't1', name: 'Active task', expectedAmount: 3_000_000,
        startDate: '2026-06-01', endDate: '2026-06-30',
      },
    ],
  });
}

async function main() {
  describe('healthScore — cấu trúc cơ bản');

  await it('total luôn trong [0, 100]', async () => {
    const snaps = [makeSnap(), makePerfectSnap()];
    for (const snap of snaps) {
      const hs = getFinancialHealthScore(snap);
      between(hs.total, 0, 100, 'total score');
    }
  });

  await it('các component không âm', async () => {
    const snap = makeSnap();
    const hs = getFinancialHealthScore(snap);
    between(hs.cashflow, 0, 25, 'cashflow');
    between(hs.billCoverage, 0, 20, 'billCoverage');
    between(hs.emergencyRunway, 0, 20, 'emergencyRunway');
    between(hs.budgetDiscipline, 0, 15, 'budgetDiscipline');
    between(hs.goalProgress, 0, 10, 'goalProgress');
    between(hs.incomePipeline, 0, 10, 'incomePipeline');
  });

  await it('components cộng = total', async () => {
    const snap = makePerfectSnap();
    const hs = getFinancialHealthScore(snap);
    const sum = hs.cashflow + hs.billCoverage + hs.emergencyRunway + hs.budgetDiscipline + hs.goalProgress + hs.incomePipeline;
    eq(hs.total, Math.min(100, Math.max(0, sum)), 'total = sum of components');
  });

  await it('deterministic: cùng snapshot → cùng score', async () => {
    const snap = makePerfectSnap();
    const hs1 = getFinancialHealthScore(snap);
    const hs2 = getFinancialHealthScore(snap);
    eq(hs1.total, hs2.total, 'same input → same output');
  });

  describe('healthScore — cashflow component (25 pts)');

  await it('net > 0 → cashflow = 25', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
        { id: 'e1', type: 'expense', amount: 5_000_000, date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    eq(getFinancialHealthScore(snap).cashflow, 25);
  });

  await it('net < 0 → cashflow = 0', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 5_000_000, date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    eq(getFinancialHealthScore(snap).cashflow, 0, 'negative net = 0 pts');
  });

  describe('healthScore — bill coverage (20 pts)');

  await it('không có bill chưa đóng → billCoverage = 20', async () => {
    const snap = makeSnap({
      bills: [{ id: 'b1', name: 'Paid', amount: 2_000_000, dueDay: 5, isPaid: true }],
    });
    eq(getFinancialHealthScore(snap).billCoverage, 20, 'no unpaid = full score');
  });

  await it('billFund >= unpaid → coverage = 20', async () => {
    const snap = makeSnap({
      wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 3_000_000 },
      bills: [{ id: 'u1', name: 'Unpaid', amount: 3_000_000, dueDay: 10, isPaid: false }],
    });
    eq(getFinancialHealthScore(snap).billCoverage, 20, 'fully funded');
  });

  await it('coverage < 0.5 → billCoverage = 0', async () => {
    const snap = makeSnap({
      wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 500_000 }, // fund < 50% of unpaid
      bills: [{ id: 'u1', name: 'Unpaid', amount: 3_000_000, dueDay: 10, isPaid: false }],
    });
    eq(getFinancialHealthScore(snap).billCoverage, 0, 'under-funded = 0 pts');
  });

  describe('healthScore — budget discipline (15 pts)');

  await it('no overbudget → 15', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 500_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      budgets: [{ categoryId: 'food', monthlyLimit: 2_000_000, monthKey: MK }],
    });
    eq(getFinancialHealthScore(snap).budgetDiscipline, 15, 'on budget = 15');
  });

  await it('1 overbudget → 8', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 3_000_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      budgets: [{ categoryId: 'food', monthlyLimit: 2_000_000, monthKey: MK }],
    });
    eq(getFinancialHealthScore(snap).budgetDiscipline, 8, '1 overbudget = 8');
  });

  await it('2+ overbudget → 0', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'e1', type: 'expense', amount: 3_000_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
        { id: 'e2', type: 'expense', amount: 2_000_000, categoryId: 'coffee', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
      ],
      budgets: [
        { categoryId: 'food', monthlyLimit: 1_000_000, monthKey: MK },
        { categoryId: 'coffee', monthlyLimit: 500_000, monthKey: MK },
      ],
    });
    eq(getFinancialHealthScore(snap).budgetDiscipline, 0, '2 overbudget = 0');
  });

  describe('healthScore — goal progress (10 pts)');

  await it('plannedGoalContributions > 0 → 10', async () => {
    const snap = makeSnap({
      goals: [{ id: 'g1', name: 'Goal', targetAmount: 50_000_000, currentAmount: 0, monthlyContributionTarget: 2_000_000 }],
    });
    eq(getFinancialHealthScore(snap).goalProgress, 10, 'has contributions = 10');
  });

  await it('no planned contributions, có saved → 5', async () => {
    const snap = makeSnap({
      goals: [{ id: 'g1', name: 'Goal', targetAmount: 50_000_000, currentAmount: 10_000_000 }], // no monthlyContributionTarget
    });
    eq(getFinancialHealthScore(snap).goalProgress, 5, 'has saved but no plan = 5');
  });

  await it('no goals at all → 0', async () => {
    const snap = makeSnap();
    eq(getFinancialHealthScore(snap).goalProgress, 0, 'no goals = 0');
  });

  describe('healthScore — income pipeline (10 pts)');

  await it('active tasks → incomePipeline = 10', async () => {
    const snap = makeSnap({
      tasks: [{ id: 't1', name: 'Active', expectedAmount: 1_000_000, startDate: '2026-06-01', endDate: '2026-06-30' }],
    });
    eq(getFinancialHealthScore(snap).incomePipeline, 10, 'has pipeline = 10');
  });

  await it('no active tasks → incomePipeline = 0', async () => {
    eq(getFinancialHealthScore(makeSnap()).incomePipeline, 0, 'no tasks = 0');
  });

  describe('perfect scenario');

  await it('perfect snapshot → full score (hoặc gần tối đa)', async () => {
    const snap = makePerfectSnap();
    const hs = getFinancialHealthScore(snap);
    // Perfect: cashflow(25) + billCoverage(20) + emergencyRunway(20) + budgetDiscipline(15) + goalProgress(10) + pipeline(10) = 100
    // emergencyRunway: emergency=15M, expense=3M → 5 months → 20 pts
    eq(hs.total, 100, 'perfect snapshot = 100');
  });

  console.log('\nhealthScore test complete.');
}

main();
