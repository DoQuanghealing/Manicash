/* TDD — budgetMetrics.ts: recompute spent từ transactions, alias, overbudget */
import {
  computeBudgetSpentByCategory, getBudgetCategoryProgress, getPlannedMonthlyBudget,
  getOverBudgetCategories, getTotalBudgetSpent, getTotalBudgetRemaining,
  getSavingsPotentialForCategory,
} from '@/lib/moneyBrain/budgetMetrics';
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
function gt(a: number, b: number, msg?: string): void {
  if (a <= b) throw new Error(`${msg ?? ''} expected ${a} > ${b}`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z'; // 10:00 VN 08/06
const MK = '2026-06';

function makeSnap(overrides: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    tasks: [],
    ...overrides,
  };
}

async function main() {
  describe('computeBudgetSpentByCategory — recompute từ transactions');

  await it('tính spent từ transactions, không tin budget.spent field', async () => {
    const snap = makeSnap({
      budgets: [
        { categoryId: 'food', categoryName: 'Ăn uống', monthlyLimit: 4_000_000, monthKey: MK },
      ],
      transactions: [
        { id: 't1', type: 'expense', amount: 1_500_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
        { id: 't2', type: 'expense', amount: 800_000, categoryId: 'food', date: '2026-06-05T03:00:00Z', dateKey: '2026-06-05', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    const spentMap = computeBudgetSpentByCategory(snap);
    eq(spentMap['food'], 2_300_000, 'food spent recomputed correctly');
  });

  await it('entertain alias → entertainment', async () => {
    const snap = makeSnap({
      budgets: [
        { categoryId: 'entertainment', categoryName: 'Giải trí', monthlyLimit: 1_000_000, monthKey: MK },
      ],
      transactions: [
        { id: 't1', type: 'expense', amount: 600_000, categoryId: 'entertain', date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: MK },
        { id: 't2', type: 'expense', amount: 200_000, categoryId: 'entertainment', date: '2026-06-04T03:00:00Z', dateKey: '2026-06-04', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    const spentMap = computeBudgetSpentByCategory(snap);
    // entertain → entertainment alias: both should map to 'entertainment'
    eq(spentMap['entertainment'], 800_000, 'alias merged into entertainment');
    eq(spentMap['entertain'], undefined, 'entertain key should not exist');

    // Progress should see 800k spent against 1M limit
    const progress = getBudgetCategoryProgress(snap);
    const entCat = progress.find((b) => b.categoryId === 'entertainment');
    if (!entCat) throw new Error('entertainment category not found in progress');
    eq(entCat.spent, 800_000, 'spent matches alias-merged amount');
    eq(entCat.isOverBudget, false, 'not over budget');
  });

  await it('sửa/xóa transaction → spent thay đổi theo snapshot', async () => {
    // Snapshot 1: 3 transactions
    const snap1 = makeSnap({
      budgets: [{ categoryId: 'food', monthlyLimit: 2_000_000, monthKey: MK }],
      transactions: [
        { id: 't1', type: 'expense', amount: 500_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
        { id: 't2', type: 'expense', amount: 500_000, categoryId: 'food', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
        { id: 't3', type: 'expense', amount: 500_000, categoryId: 'food', date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    // Snapshot 2: t3 bị "xóa" (không còn trong array)
    const snap2 = makeSnap({
      budgets: snap1.budgets,
      transactions: snap1.transactions.slice(0, 2),
    });
    eq(computeBudgetSpentByCategory(snap1)['food'], 1_500_000, 'snap1: 3 txns');
    eq(computeBudgetSpentByCategory(snap2)['food'], 1_000_000, 'snap2: 2 txns after delete');
  });

  describe('getBudgetCategoryProgress');

  await it('progress, remaining, isOverBudget đúng', async () => {
    const snap = makeSnap({
      budgets: [
        { categoryId: 'food', monthlyLimit: 2_000_000, monthKey: MK },
        { categoryId: 'coffee', monthlyLimit: 500_000, monthKey: MK },
      ],
      transactions: [
        { id: 't1', type: 'expense', amount: 2_500_000, categoryId: 'food', date: '2026-06-05T03:00:00Z', dateKey: '2026-06-05', weekKey: '2026-W23', monthKey: MK },
        { id: 't2', type: 'expense', amount: 200_000, categoryId: 'coffee', date: '2026-06-06T03:00:00Z', dateKey: '2026-06-06', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    const progress = getBudgetCategoryProgress(snap);
    const food = progress.find((b) => b.categoryId === 'food')!;
    const coffee = progress.find((b) => b.categoryId === 'coffee')!;

    eq(food.spent, 2_500_000);
    eq(food.remaining, 0, 'remaining capped at 0 when over');
    eq(food.isOverBudget, true);

    eq(coffee.spent, 200_000);
    eq(coffee.remaining, 300_000, 'coffee: 500k - 200k');
    eq(coffee.isOverBudget, false);
  });

  describe('getOverBudgetCategories');

  await it('chỉ trả về categories vượt ngưỡng', async () => {
    const snap = makeSnap({
      budgets: [
        { categoryId: 'food', monthlyLimit: 1_000_000, monthKey: MK },
        { categoryId: 'coffee', monthlyLimit: 500_000, monthKey: MK },
      ],
      transactions: [
        { id: 't1', type: 'expense', amount: 1_200_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
        { id: 't2', type: 'expense', amount: 200_000, categoryId: 'coffee', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    const over = getOverBudgetCategories(snap);
    eq(over.length, 1, '1 over-budget category');
    eq(over[0].categoryId, 'food');
  });

  describe('getTotalBudgetSpent / getTotalBudgetRemaining');

  await it('tổng spent và remaining đúng', async () => {
    const snap = makeSnap({
      budgets: [
        { categoryId: 'food', monthlyLimit: 3_000_000, monthKey: MK },
        { categoryId: 'coffee', monthlyLimit: 1_000_000, monthKey: MK },
      ],
      transactions: [
        { id: 't1', type: 'expense', amount: 1_000_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
        { id: 't2', type: 'expense', amount: 400_000, categoryId: 'coffee', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    eq(getTotalBudgetSpent(snap), 1_400_000, 'total spent');
    eq(getTotalBudgetRemaining(snap), 2_600_000, 'total remaining = (3M-1M) + (1M-0.4M)');
  });

  describe('getPlannedMonthlyBudget');

  await it('chỉ tính budget tháng hiện tại', async () => {
    const snap = makeSnap({
      budgets: [
        { categoryId: 'food', monthlyLimit: 4_000_000, monthKey: MK },
        { categoryId: 'coffee', monthlyLimit: 800_000, monthKey: MK },
        { categoryId: 'old', monthlyLimit: 9_999_999, monthKey: '2026-05' }, // tháng cũ
      ],
    });
    eq(getPlannedMonthlyBudget(snap), 4_800_000, 'sum current month limits only');
  });

  describe('getSavingsPotentialForCategory');

  await it('savingsPotential = spent * cutPercent', async () => {
    const snap = makeSnap({
      budgets: [{ categoryId: 'food', monthlyLimit: 3_000_000, monthKey: MK }],
      transactions: [
        { id: 't1', type: 'expense', amount: 2_000_000, categoryId: 'food', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
      ],
    });
    eq(getSavingsPotentialForCategory(snap, 'food', 0.2), 400_000, '20% of 2M');
    eq(getSavingsPotentialForCategory(snap, 'food', 0), 0, '0%');
    eq(getSavingsPotentialForCategory(snap, 'food', 1), 2_000_000, '100%');
    eq(getSavingsPotentialForCategory(snap, 'nonexistent', 0.5), 0, 'missing category');
  });

  console.log('\nbudgetMetrics test complete.');
}

main();
