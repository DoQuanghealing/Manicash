/* TDD — safeToSpend.ts: formula v1.1, paid/unpaid bills, goal contribution */
import { getSafeToSpendBreakdown } from '@/lib/moneyBrain/safeToSpend';
import type { MoneySnapshotV1, MoneyBillSnapshot, MoneyGoalSnapshot } from '@/lib/moneyBrain/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const VN = 'Asia/Ho_Chi_Minh';
// 08 June 2026, 10:00 VN
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const MK = '2026-06';

function makeSnap(overrides: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 20_000_000, emergency: 5_000_000, billFund: 3_000_000 },
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    tasks: [],
    carryOver: 0,
    ...overrides,
  };
}

// Baseline: income 15M, carryOver 1M, budget 4M, unpaid bills 2M, goal contrib 1M
// → safeToSpend = 15 + 1 - 4 - 2 - 1 = 9M
const BASELINE_INCOME = 15_000_000;
const BASELINE_CARRY = 1_000_000;
const BASELINE_BUDGET = 4_000_000;
const BASELINE_UNPAID = 2_500_000;
const BASELINE_GOAL_CONTRIB = 1_500_000;

function makeBaselineSnap(): MoneySnapshotV1 {
  return makeSnap({
    carryOver: BASELINE_CARRY,
    transactions: [
      {
        id: 'inc1', type: 'income', amount: BASELINE_INCOME,
        date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK,
      },
    ],
    budgets: [
      { categoryId: 'food', monthlyLimit: BASELINE_BUDGET, monthKey: MK },
    ],
    bills: [
      { id: 'b1', name: 'Tiền nhà', amount: BASELINE_UNPAID, dueDay: 1, isPaid: false },
      { id: 'b2', name: 'Đã đóng', amount: 999_999, dueDay: 5, isPaid: true }, // paid: không trừ
    ],
    goals: [
      { id: 'g1', name: 'Goal', targetAmount: 50_000_000, currentAmount: 5_000_000, monthlyContributionTarget: BASELINE_GOAL_CONTRIB },
    ],
  });
}

async function main() {
  describe('formula v1.1 cơ bản');

  await it('formula: income + carryOver - budget - unpaid bills - goal contrib', async () => {
    const snap = makeBaselineSnap();
    const bd = getSafeToSpendBreakdown(snap);
    const expected = BASELINE_INCOME + BASELINE_CARRY - BASELINE_BUDGET - BASELINE_UNPAID - BASELINE_GOAL_CONTRIB;
    eq(bd.safeToSpend, expected, 'safeToSpend formula');
    eq(bd.monthlyIncome, BASELINE_INCOME, 'monthlyIncome');
    eq(bd.carryOver, BASELINE_CARRY, 'carryOver');
    eq(bd.plannedMonthlyBudget, BASELINE_BUDGET, 'plannedMonthlyBudget');
    eq(bd.totalUnpaidBills, BASELINE_UNPAID, 'totalUnpaidBills (only unpaid)');
    eq(bd.plannedMonthlyGoalContributions, BASELINE_GOAL_CONTRIB, 'goal contributions');
  });

  await it('bill đã đóng KHÔNG bị trừ', async () => {
    const snapWithAllPaid = makeSnap({
      carryOver: 1_000_000,
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      bills: [
        { id: 'paid', name: 'All Paid', amount: 9_999_999, dueDay: 5, isPaid: true }, // đã đóng
      ],
    });
    const bd = getSafeToSpendBreakdown(snapWithAllPaid);
    eq(bd.totalUnpaidBills, 0, 'paid bill not counted');
    // safeToSpend = 10M + 1M - 0 - 0 - 0 = 11M
    eq(bd.safeToSpend, 11_000_000, 'paid bill not deducted');
  });

  await it('bill chưa đóng bị trừ', async () => {
    const unpaidBills: MoneyBillSnapshot[] = [
      { id: 'u1', name: 'Unpaid', amount: 2_000_000, dueDay: 10, isPaid: false },
    ];
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      bills: unpaidBills,
    });
    const bd = getSafeToSpendBreakdown(snap);
    eq(bd.totalUnpaidBills, 2_000_000, 'unpaid bill counted');
    eq(bd.safeToSpend, 10_000_000 - 2_000_000, 'unpaid bill deducted');
  });

  await it('goal monthlyContributionTarget bị trừ', async () => {
    const goals: MoneyGoalSnapshot[] = [
      { id: 'g1', name: 'Goal', targetAmount: 100_000_000, currentAmount: 0, monthlyContributionTarget: 3_000_000 },
    ];
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      goals,
    });
    const bd = getSafeToSpendBreakdown(snap);
    eq(bd.plannedMonthlyGoalContributions, 3_000_000, 'goal contribution counted');
    eq(bd.safeToSpend, 10_000_000 - 3_000_000, 'goal contribution deducted');
  });

  await it('goal currentAmount KHÔNG bị trừ', async () => {
    const goals: MoneyGoalSnapshot[] = [
      {
        id: 'g1', name: 'Goal',
        targetAmount: 100_000_000,
        currentAmount: 50_000_000, // 50M đã tích lũy — không được trừ
        monthlyContributionTarget: 2_000_000, // chỉ 2M/tháng mới trừ
      },
    ];
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      goals,
    });
    const bd = getSafeToSpendBreakdown(snap);
    eq(bd.plannedMonthlyGoalContributions, 2_000_000, 'only monthly contribution, not current amount');
    if (bd.safeToSpend === 10_000_000 - 50_000_000) {
      throw new Error('CRITICAL: currentAmount was used instead of monthlyContributionTarget!');
    }
    eq(bd.safeToSpend, 10_000_000 - 2_000_000, 'currentAmount not deducted');
  });

  describe('status thresholds');

  await it('safe nếu > 1.000.000', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 10_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    const bd = getSafeToSpendBreakdown(snap);
    eq(bd.status, 'safe', 'safeToSpend 10M → safe');
  });

  await it('caution nếu > 0 && <= 1.000.000', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 5_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      budgets: [{ categoryId: 'food', monthlyLimit: 4_500_000, monthKey: MK }],
    });
    const bd = getSafeToSpendBreakdown(snap);
    // safeToSpend = 5M - 4.5M = 500k → caution
    eq(bd.status, 'caution', '500k → caution');
  });

  await it('danger nếu <= 0', async () => {
    const snap = makeSnap({
      transactions: [
        { id: 'i1', type: 'income', amount: 3_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
      budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    });
    const bd = getSafeToSpendBreakdown(snap);
    // safeToSpend = 3M - 5M = -2M → danger
    eq(bd.status, 'danger', '-2M → danger');
  });

  describe('daysLeft và safeToSpendPerDay');

  await it('daysLeftInMonth > 0 (không bao giờ = 0)', async () => {
    const snap = makeBaselineSnap();
    const bd = getSafeToSpendBreakdown(snap);
    if (bd.daysLeftInMonth <= 0) throw new Error('daysLeftInMonth must be > 0');
    // 2026-06-08: last day = 30, daysLeft = 30 - 8 + 1 = 23
    eq(bd.daysLeftInMonth, 23, 'days left in June from day 8');
  });

  await it('safeToSpendPerDay = safeToSpend / daysLeft', async () => {
    const snap = makeBaselineSnap();
    const bd = getSafeToSpendBreakdown(snap);
    const expected = bd.safeToSpend / bd.daysLeftInMonth;
    if (Math.abs(bd.safeToSpendPerDay - expected) > 1) {
      throw new Error(`safeToSpendPerDay expected ~${expected}, got ${bd.safeToSpendPerDay}`);
    }
  });

  console.log('\nsafeToSpend test complete.');
}

main();
