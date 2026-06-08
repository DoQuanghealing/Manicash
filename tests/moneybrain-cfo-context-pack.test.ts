/* Phase 3 — cfoContextPack: assembled from engine, no fabricated numbers */
import { buildCFOContextPack } from '@/lib/moneyBrain/cfoContextPack';
import { getFinancialHealthScore } from '@/lib/moneyBrain/healthScore';
import { getSafeToSpendBreakdown } from '@/lib/moneyBrain/safeToSpend';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg: string): void { if (!v) throw new Error(msg); }

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const MK = '2026-06';

const SNAP: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
  wallets: { main: 20_000_000, emergency: 12_500_000, billFund: 1_200_000 },
  transactions: [
    { id: 'i1', type: 'income', amount: 20_000_000, categoryId: 'salary', date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: MK },
    { id: 'e1', type: 'expense', amount: 2_400_000, categoryId: 'food', categoryName: 'Ăn uống', date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK },
    { id: 'e2', type: 'expense', amount: 1_800_000, categoryId: 'shopping', categoryName: 'Mua sắm', date: '2026-06-03T03:00:00Z', dateKey: '2026-06-03', weekKey: '2026-W23', monthKey: MK },
  ],
  budgets: [
    { categoryId: 'food', categoryName: 'Ăn uống', monthlyLimit: 2_000_000, monthKey: MK },
    { categoryId: 'shopping', categoryName: 'Mua sắm', monthlyLimit: 1_500_000, monthKey: MK },
  ],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 4, isPaid: true },
    { id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 10, isPaid: false },
  ],
  goals: [
    { id: 'g1', name: 'Quỹ khẩn cấp', targetAmount: 50_000_000, currentAmount: 12_500_000, deadline: '2026-12-31', monthlyContributionTarget: 2_000_000 },
  ],
  tasks: [
    { id: 't1', name: 'Freelance', expectedAmount: 3_000_000, startDate: '2026-06-01', endDate: '2026-06-30' },
  ],
  carryOver: 0,
};

function main() {
  console.log('\ncfoContextPack');
  const pack = buildCFOContextPack(SNAP);

  it('version = cfo_context_v1', () => eq(pack.version, 'cfo_context_v1'));

  it('healthScore == engine healthScore (KHÔNG bịa)', () => {
    eq(pack.healthScore.total, getFinancialHealthScore(SNAP).total);
    eq(pack.executiveSummary.healthScore, getFinancialHealthScore(SNAP).total);
  });

  it('safeToSpend == engine safeToSpend', () => {
    eq(pack.executiveSummary.safeToSpend, getSafeToSpendBreakdown(SNAP).safeToSpend);
  });

  it('executiveSummary số khớp engine', () => {
    eq(pack.executiveSummary.totalIncome, 20_000_000);
    eq(pack.executiveSummary.totalExpense, 4_200_000);
    eq(pack.executiveSummary.netCashflow, 15_800_000);
  });

  it('overBudget categories included (food + shopping vượt)', () => {
    eq(pack.budget.overBudgetCategories.length, 2);
    ok(pack.budget.overBudgetCategories.some((c) => c.categoryId === 'food'), 'food over');
  });

  it('atRisk goals included (quỹ khẩn cấp)', () => {
    ok(pack.goals.atRiskGoals.length >= 1, 'has at-risk goal');
    eq(pack.goals.atRiskGoals[0].id, 'g1');
  });

  it('priority tasks included', () => {
    ok(pack.earningTasks.priorityTasks.some((t) => t.id === 't1'), 't1 in priority');
    eq(pack.earningTasks.expectedIncomePipeline, 3_000_000);
  });

  it('bills: unpaid + coverage gap', () => {
    eq(pack.bills.unpaidCount, 1);
    eq(pack.bills.totalUnpaidBills, 2_500_000);
    ok(pack.bills.billFundGap > 0, 'gap > 0');
  });

  it('history KHÔNG fabricate: chỉ tháng hiện tại -> hasEnoughHistory false', () => {
    eq(pack.history.hasEnoughHistory, false);
    eq(pack.history.availableMonths.join(','), MK);
  });

  it('constraints true', () => {
    eq(pack.constraints.aiMustNotInventNumbers, true);
    eq(pack.constraints.aiMustUseProvidedMetrics, true);
    eq(pack.constraints.currency, 'VND');
    eq(pack.constraints.locale, 'vi-VN');
  });

  it('generatedAt = clientNow (deterministic, không Date.now)', () => {
    eq(pack.generatedAt, CLIENT_NOW);
  });

  console.log('\ncfoContextPack test complete.');
}

main();
