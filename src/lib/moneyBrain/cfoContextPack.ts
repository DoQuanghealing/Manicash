/* ═══ Money Brain — CFO Context Pack builder (Phase 3) ═══
 * PURE function. Đóng gói "báo cáo tài chính đã tính sẵn" cho AI CFO đọc.
 * MỌI con số do moneyBrain tính. LLM không được sửa.
 * Không React/Zustand/API/Date.now() — generatedAt lấy từ snapshot.clientNow.
 */

import type { MoneySnapshotV1 } from './types';
import type { CFOContextPackV1 } from './cfoTypes';
import { getCurrentMonthKey } from './dateRange';
import {
  getIncomeForPeriod,
  getExpenseForPeriod,
  getNetCashflowForPeriod,
  getSavingsRateForPeriod,
  getTopExpenseCategoriesForPeriod,
} from './financeMetrics';
import { getSafeToSpendBreakdown } from './safeToSpend';
import { getFinancialHealthScore } from './healthScore';
import {
  getTotalFixedBills,
  getTotalUnpaidBills,
  getUnpaidBills,
  getUpcomingBills,
  getBillFundCoverageRate,
  getBillFundGap,
  getRemainingMainBalanceAfterUnpaidBills,
} from './billMetrics';
import {
  getPlannedMonthlyBudget,
  getTotalBudgetSpent,
  getTotalBudgetRemaining,
  getOverBudgetCategories,
} from './budgetMetrics';
import {
  getLargestExpenses,
  getUnusualExpenses,
  getRepeatedSmallLeaks,
  getWeekendSpending,
} from './behaviorMetrics';
import {
  getTotalGoalSaved,
  getPlannedMonthlyGoalContributions,
  getGoalProgressList,
  getAtRiskGoals,
} from './goalMetrics';
import {
  getActiveTasks,
  getOverdueTasks,
  getCompletedTasks,
  getExpectedIncomePipeline,
  getActualTaskIncomeForPeriod,
  getHighestPriorityIncomeTasks,
  getTaskCompletionProgress,
  getTaskStatus,
} from './taskMetrics';
import { getAvailableMonthKeys, getMonthlyHistory, hasEnoughHistory } from './historyMetrics';
import { deriveFinancialMode } from './financialMode';

export function buildCFOContextPack(snapshot: MoneySnapshotV1): CFOContextPackV1 {
  const monthKey = getCurrentMonthKey(snapshot.clientNow, snapshot.timezone);

  // ── Executive summary (số do engine tính) ──
  const totalIncome = getIncomeForPeriod(snapshot, 'this_month');
  const totalExpense = getExpenseForPeriod(snapshot, 'this_month');
  const netCashflow = getNetCashflowForPeriod(snapshot, 'this_month');
  const savingsRate = getSavingsRateForPeriod(snapshot, 'this_month');
  const sts = getSafeToSpendBreakdown(snapshot);
  const health = getFinancialHealthScore(snapshot);

  // ── Bills ──
  const unpaid = getUnpaidBills(snapshot);
  const upcoming = getUpcomingBills(snapshot, 7);

  // ── Budget ──
  const overBudget = getOverBudgetCategories(snapshot);
  const topCats = getTopExpenseCategoriesForPeriod(snapshot, 'this_month', 5);

  // ── Goals ──
  const goalList = getGoalProgressList(snapshot);
  const atRisk = getAtRiskGoals(snapshot);

  // ── Tasks ──
  const priorityTasks = getHighestPriorityIncomeTasks(snapshot, 5);

  return {
    version: 'cfo_context_v1',
    generatedAt: snapshot.clientNow,
    period: {
      monthKey,
      clientNow: snapshot.clientNow,
      timezone: snapshot.timezone,
    },

    financialMode: deriveFinancialMode(snapshot),

    executiveSummary: {
      totalIncome,
      totalExpense,
      netCashflow,
      savingsRate,
      safeToSpend: sts.safeToSpend,
      safeToSpendPerDay: sts.safeToSpendPerDay,
      healthScore: health.total,
    },

    healthScore: {
      total: health.total,
      cashflow: health.cashflow,
      billCoverage: health.billCoverage,
      emergencyRunway: health.emergencyRunway,
      budgetDiscipline: health.budgetDiscipline,
      goalProgress: health.goalProgress,
      incomePipeline: health.incomePipeline,
    },

    wallets: {
      mainBalance: snapshot.wallets.main,
      emergencyBalance: snapshot.wallets.emergency,
      billFundBalance: snapshot.wallets.billFund,
      totalLiquid: snapshot.wallets.main + snapshot.wallets.emergency + snapshot.wallets.billFund,
    },

    bills: {
      totalFixedBills: getTotalFixedBills(snapshot),
      totalUnpaidBills: getTotalUnpaidBills(snapshot),
      unpaidCount: unpaid.length,
      unpaidBills: unpaid.map((b) => ({ id: b.id, name: b.name, amount: b.amount, dueDay: b.dueDay })),
      upcomingBills7d: upcoming.map((b) => ({ id: b.id, name: b.name, amount: b.amount, dueDay: b.dueDay })),
      billFundCoverageRate: getBillFundCoverageRate(snapshot),
      billFundGap: getBillFundGap(snapshot),
      remainingMainBalanceAfterUnpaidBills: getRemainingMainBalanceAfterUnpaidBills(snapshot),
    },

    budget: {
      plannedMonthlyBudget: getPlannedMonthlyBudget(snapshot),
      totalBudgetSpent: getTotalBudgetSpent(snapshot),
      totalBudgetRemaining: getTotalBudgetRemaining(snapshot),
      overBudgetCategories: overBudget.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        monthlyLimit: c.monthlyLimit,
        spent: c.spent,
        progress: c.progress,
        overspentBy: Math.max(0, c.spent - c.monthlyLimit),
      })),
      topExpenseCategories: topCats.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        amount: c.amount,
        count: c.count,
        percentageOfExpense: c.percentageOfExpense,
      })),
      cutSimulation: {
        cut10: totalExpense * 0.1,
        cut20: totalExpense * 0.2,
        cut30: totalExpense * 0.3,
      },
    },

    behavior: {
      largestExpenses: getLargestExpenses(snapshot, 5).map((t) => ({
        id: t.id,
        amount: t.amount,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        note: t.note,
        dateKey: t.dateKey,
      })),
      unusualExpenses: getUnusualExpenses(snapshot, { limit: 5 }).map((t) => ({
        id: t.id,
        amount: t.amount,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        note: t.note,
        dateKey: t.dateKey,
        reason: t.reason,
      })),
      repeatedSmallLeaks: getRepeatedSmallLeaks(snapshot, { limit: 5 }),
      weekendSpending: getWeekendSpending(snapshot),
    },

    goals: {
      totalGoalSaved: getTotalGoalSaved(snapshot),
      plannedMonthlyGoalContributions: getPlannedMonthlyGoalContributions(snapshot),
      goals: goalList.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        gap: g.gap,
        progress: g.progress,
        monthlyContributionTarget: g.monthlyContributionTarget,
        requiredMonthlyContribution: g.requiredMonthlyContribution,
        isAtRisk: g.isAtRisk,
      })),
      atRiskGoals: atRisk.map((g) => ({
        id: g.id,
        name: g.name,
        gap: g.gap,
        monthlyContributionTarget: g.monthlyContributionTarget,
        requiredMonthlyContribution: g.requiredMonthlyContribution,
      })),
    },

    earningTasks: {
      activeCount: getActiveTasks(snapshot).length,
      overdueCount: getOverdueTasks(snapshot).length,
      completedCount: getCompletedTasks(snapshot).length,
      expectedIncomePipeline: getExpectedIncomePipeline(snapshot),
      actualTaskIncomeThisMonth: getActualTaskIncomeForPeriod(snapshot, 'this_month'),
      priorityTasks: priorityTasks.map((t) => ({
        id: t.id,
        name: t.name,
        expectedAmount: t.expectedAmount,
        endDate: t.endDate,
        status: getTaskStatus(t, snapshot),
        progress: getTaskCompletionProgress(t).progress,
      })),
    },

    history: {
      availableMonths: getAvailableMonthKeys(snapshot),
      last3Months: getMonthlyHistory(snapshot, 3),
      hasEnoughHistory: hasEnoughHistory(snapshot, 3),
    },

    constraints: {
      aiMustNotInventNumbers: true,
      aiMustUseProvidedMetrics: true,
      currency: 'VND',
      locale: 'vi-VN',
    },
  };
}
