/* ═══ Money Brain — CFO Context Pack types (Phase 3) ═══
 * PURE TYPES — không import React / Zustand / API.
 * Hợp đồng dữ liệu giữa Money Brain (tính số) và AI CFO (diễn giải).
 *
 * Nguyên tắc: mọi CON SỐ trong pack do moneyBrain tính. LLM chỉ đọc, không sửa.
 */

export type FinancialMode =
  | 'stabilize'
  | 'build_cashflow'
  | 'accelerate'
  | 'protect_capital';

export type CFOContextPackVersion = 'cfo_context_v1';

export interface CFOContextPackV1 {
  version: CFOContextPackVersion;
  generatedAt: string;
  period: {
    monthKey: string;
    clientNow: string;
    timezone: string;
  };

  financialMode: FinancialMode;

  executiveSummary: {
    totalIncome: number;
    totalExpense: number;
    netCashflow: number;
    savingsRate: number;
    safeToSpend: number;
    safeToSpendPerDay: number;
    healthScore: number;
  };

  healthScore: {
    total: number;
    cashflow: number;
    billCoverage: number;
    emergencyRunway: number;
    budgetDiscipline: number;
    goalProgress: number;
    incomePipeline: number;
  };

  wallets: {
    mainBalance: number;
    emergencyBalance: number;
    billFundBalance: number;
    totalLiquid: number;
  };

  bills: {
    totalFixedBills: number;
    totalUnpaidBills: number;
    unpaidCount: number;
    unpaidBills: Array<{
      id: string;
      name: string;
      amount: number;
      dueDay: number;
    }>;
    upcomingBills7d: Array<{
      id: string;
      name: string;
      amount: number;
      dueDay: number;
    }>;
    billFundCoverageRate: number;
    billFundGap: number;
    remainingMainBalanceAfterUnpaidBills: number;
  };

  budget: {
    plannedMonthlyBudget: number;
    totalBudgetSpent: number;
    totalBudgetRemaining: number;
    overBudgetCategories: Array<{
      categoryId: string;
      categoryName?: string;
      monthlyLimit: number;
      spent: number;
      progress: number;
      overspentBy: number;
    }>;
    topExpenseCategories: Array<{
      categoryId: string;
      categoryName?: string;
      amount: number;
      count: number;
      percentageOfExpense: number;
    }>;
    cutSimulation: {
      cut10: number;
      cut20: number;
      cut30: number;
    };
  };

  behavior: {
    largestExpenses: Array<{
      id: string;
      amount: number;
      categoryId?: string;
      categoryName?: string;
      note?: string;
      dateKey: string;
    }>;
    unusualExpenses: Array<{
      id: string;
      amount: number;
      categoryId?: string;
      categoryName?: string;
      note?: string;
      dateKey: string;
      reason: string;
    }>;
    repeatedSmallLeaks: Array<{
      categoryId: string;
      categoryName?: string;
      count: number;
      totalAmount: number;
      avgAmount: number;
    }>;
    weekendSpending?: {
      totalAmount: number;
      count: number;
      percentageOfExpense: number;
    };
  };

  goals: {
    totalGoalSaved: number;
    plannedMonthlyGoalContributions: number;
    goals: Array<{
      id: string;
      name: string;
      targetAmount: number;
      currentAmount: number;
      gap: number;
      progress: number;
      monthlyContributionTarget: number;
      requiredMonthlyContribution?: number;
      isAtRisk?: boolean;
    }>;
    atRiskGoals: Array<{
      id: string;
      name: string;
      gap: number;
      monthlyContributionTarget: number;
      requiredMonthlyContribution?: number;
    }>;
  };

  earningTasks: {
    activeCount: number;
    overdueCount: number;
    completedCount: number;
    expectedIncomePipeline: number;
    actualTaskIncomeThisMonth: number;
    priorityTasks: Array<{
      id: string;
      name: string;
      expectedAmount: number;
      endDate: string;
      status: 'active' | 'overdue' | 'completed' | 'deleted';
      progress: number;
    }>;
  };

  history: {
    availableMonths: string[];
    last3Months: Array<{
      monthKey: string;
      income: number;
      expense: number;
      netCashflow: number;
      savingsRate: number;
    }>;
    hasEnoughHistory: boolean;
  };

  constraints: {
    aiMustNotInventNumbers: true;
    aiMustUseProvidedMetrics: true;
    currency: 'VND';
    locale: 'vi-VN';
  };
}
