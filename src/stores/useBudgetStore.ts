/* ═══ Budget Store — Monthly Budget + Category Limits ═══ */
'use client';

import { create } from 'zustand';
import type { CategoryBudget, MonthlySnapshot } from '@/types/budget';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { generateButlerReport } from '@/lib/butlerReport';

/** Lấy tháng hiện tại dạng 'YYYY-MM' */
function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Demo category budgets
const SEED_BUDGETS: CategoryBudget[] = [
  { categoryId: 'food',      monthlyLimit: 4_000_000, spent: 2_800_000, month: getCurrentMonth() },
  { categoryId: 'coffee',    monthlyLimit: 800_000,   spent: 650_000,   month: getCurrentMonth() },
  { categoryId: 'transport', monthlyLimit: 1_500_000, spent: 900_000,   month: getCurrentMonth() },
  { categoryId: 'shopping',  monthlyLimit: 2_000_000, spent: 1_200_000, month: getCurrentMonth() },
  { categoryId: 'entertain', monthlyLimit: 1_000_000, spent: 750_000,   month: getCurrentMonth() },
  { categoryId: 'health',    monthlyLimit: 500_000,   spent: 200_000,   month: getCurrentMonth() },
];

interface BudgetState {
  carryOver: number;            // Dư tháng trước
  currentMonth: string;
  categoryBudgets: CategoryBudget[];
  rolloverNotified: boolean;    // Đã thông báo rollover chưa

  // === Monthly butler report state ===
  /** Snapshot tháng cũ kèm butler report — append qua mỗi rollover. */
  monthlySnapshots: MonthlySnapshot[];
  /** Tháng có report mới chưa xem (null nếu đã xem hết). */
  unviewedReportMonth: string | null;
  /** XP của user tại đầu tháng — để compute delta khi rollover. */
  xpAtMonthStart: number;

  // Computed
  getTotalCategoryLimits: () => number;
  getTotalSpent: () => number;
  getSafeToSpend: () => number;
  getCategoryRemaining: (catId: string) => number;
  getCategoryProgress: (catId: string) => number; // 0-100
  isOverBudget: (catId: string) => boolean;
  getOverBudgetCategories: () => CategoryBudget[];
  /** Lấy snapshot/report của tháng có unviewedReportMonth. */
  getUnviewedReport: () => MonthlySnapshot | null;

  // Actions
  setCategoryBudget: (catId: string, limit: number) => void;
  addSpending: (catId: string, amount: number) => void;
  checkAndRollover: () => { rolled: boolean; carryOver: number };
  markRolloverNotified: () => void;
  /** User đã đọc/đóng modal báo cáo — ngừng show lại. */
  markReportViewed: () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  carryOver: 800_000, // Dư từ tháng trước (demo)
  currentMonth: getCurrentMonth(),
  categoryBudgets: SEED_BUDGETS,
  rolloverNotified: false,
  monthlySnapshots: [],
  unviewedReportMonth: null,
  xpAtMonthStart: 0,

  /** Tổng ngưỡng chi tiêu đã thiết lập */
  getTotalCategoryLimits: () => {
    const { categoryBudgets, currentMonth } = get();
    return categoryBudgets
      .filter((b) => b.month === currentMonth)
      .reduce((sum, b) => sum + b.monthlyLimit, 0);
  },

  /** Tổng đã chi tiêu trong tháng */
  getTotalSpent: () => {
    const { categoryBudgets, currentMonth } = get();
    return categoryBudgets
      .filter((b) => b.month === currentMonth)
      .reduce((sum, b) => sum + b.spent, 0);
  },

  /**
   * Số dư an toàn chi tiêu = Thu nhập tháng + Dư tháng trước
   *                         − Ngưỡng chi tiêu − Bill cố định − Tiết kiệm tháng
   * NOTE: Tính ở useSafeBalance hook (truy xuất 3 store).
   * Hàm này giữ lại cho backward compat nhưng dùng công thức đơn giản.
   */
  getSafeToSpend: () => {
    const { carryOver } = get();
    const totalLimits = get().getTotalCategoryLimits();
    const totalSpent = get().getTotalSpent();
    // Đơn giản: ngưỡng − đã chi + dư tháng trước
    return (totalLimits + carryOver) - totalSpent;
  },

  getCategoryRemaining: (catId) => {
    const budget = get().categoryBudgets.find(
      (b) => b.categoryId === catId && b.month === get().currentMonth
    );
    if (!budget) return 0;
    return Math.max(0, budget.monthlyLimit - budget.spent);
  },

  getCategoryProgress: (catId) => {
    const budget = get().categoryBudgets.find(
      (b) => b.categoryId === catId && b.month === get().currentMonth
    );
    if (!budget || budget.monthlyLimit === 0) return 0;
    return Math.min(100, Math.round((budget.spent / budget.monthlyLimit) * 100));
  },

  isOverBudget: (catId) => {
    const budget = get().categoryBudgets.find(
      (b) => b.categoryId === catId && b.month === get().currentMonth
    );
    if (!budget) return false;
    return budget.spent > budget.monthlyLimit;
  },

  getOverBudgetCategories: () => {
    const { categoryBudgets, currentMonth } = get();
    return categoryBudgets.filter(
      (b) => b.month === currentMonth && b.spent > b.monthlyLimit
    );
  },

  setCategoryBudget: (catId, limit) =>
    set((state) => {
      const month = state.currentMonth;
      const existing = state.categoryBudgets.find(
        (b) => b.categoryId === catId && b.month === month
      );
      if (existing) {
        return {
          categoryBudgets: state.categoryBudgets.map((b) =>
            b.categoryId === catId && b.month === month
              ? { ...b, monthlyLimit: limit }
              : b
          ),
        };
      }
      return {
        categoryBudgets: [
          ...state.categoryBudgets,
          { categoryId: catId, monthlyLimit: limit, spent: 0, month },
        ],
      };
    }),

  addSpending: (catId, amount) =>
    set((state) => ({
      categoryBudgets: state.categoryBudgets.map((b) =>
        b.categoryId === catId && b.month === state.currentMonth
          ? { ...b, spent: b.spent + amount }
          : b
      ),
    })),

  getUnviewedReport: () => {
    const { unviewedReportMonth, monthlySnapshots } = get();
    if (!unviewedReportMonth) return null;
    return monthlySnapshots.find((s) => s.month === unviewedReportMonth) || null;
  },

  /**
   * Auto-rollover: gọi khi mở app, kiểm tra tháng mới.
   * Idempotent — guard `currentMonth === actualMonth` ngăn re-grant XP + re-generate report.
   *
   * Side effects khi tháng mới:
   *   1. BUDGET_ON_TRACK +20 XP cho mỗi category đã on-track tháng cũ.
   *   2. Generate butler report cho tháng cũ (Phần 5).
   *   3. Append MonthlySnapshot, set unviewedReportMonth → modal sẽ hiện.
   *   4. Update xpAtMonthStart = current xp để delta tháng tới chính xác.
   */
  checkAndRollover: () => {
    const state = get();
    const actualMonth = getCurrentMonth();

    if (state.currentMonth === actualMonth) {
      return { rolled: false, carryOver: state.carryOver };
    }

    const oldMonth = state.currentMonth;
    const oldMonthBudgets = state.categoryBudgets.filter((b) => b.month === oldMonth);

    // === Phần 2: BUDGET_ON_TRACK XP — grant cho mỗi category đã đạt mục tiêu ===
    // "On-track" = đã set ngưỡng (limit > 0) AND chi tiêu ≤ ngưỡng.
    const award = useAuthStore.getState().awardXP;
    for (const b of oldMonthBudgets) {
      if (b.monthlyLimit > 0 && b.spent <= b.monthlyLimit) {
        award({ type: 'BUDGET_ON_TRACK' });
      }
    }

    // === Phần 5: Aggregate metrics tháng cũ → generate report ===
    const finance = useFinanceStore.getState();
    const [oldYear, oldMonthNum] = oldMonth.split('-').map(Number);

    const oldMonthTxns = finance.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === oldYear && d.getMonth() + 1 === oldMonthNum;
    });
    const monthlyIncome = oldMonthTxns
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const monthlyExpense = oldMonthTxns
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const billsTotal = finance.fixedBills.length;
    const billsPaid = finance.fixedBills.filter((b) => b.isPaid).length;

    const categoriesTotal = oldMonthBudgets.length;
    const categoriesOnTrack = oldMonthBudgets.filter(
      (b) => b.monthlyLimit > 0 && b.spent <= b.monthlyLimit,
    ).length;

    // XP delta — sau khi BUDGET_ON_TRACK đã grant ở trên, current xp = end-of-month total.
    const xpNow = useAuthStore.getState().user?.xp || 0;
    const xpEarned = xpNow - state.xpAtMonthStart;

    const oldSafe = state.getSafeToSpend();

    const report = generateButlerReport({
      month: oldMonth,
      monthlyIncome,
      monthlyExpense,
      transactionCount: oldMonthTxns.length,
      billsDueByNow: billsTotal,
      billsPaidOfDue: billsPaid,
      categoriesTotal,
      categoriesOnTrack,
      emergencyBalance: finance.emergencyBalance,
      safeToSpend: oldSafe,
      xpEarned,
      dayOfMonth: 31,
    });

    const snapshot: MonthlySnapshot = {
      month: oldMonth,
      incomeTotal: monthlyIncome,
      expenseTotal: monthlyExpense,
      savingTotal: 0, // Demo — track explicit savings ở dashboardStore
      carryOver: state.carryOver,
      budgetLimits: oldMonthBudgets,
      butlerReport: report,
    };

    set({
      carryOver: oldSafe,
      currentMonth: actualMonth,
      rolloverNotified: false,
      categoryBudgets: state.categoryBudgets.map((b) => ({
        ...b,
        spent: 0,
        month: actualMonth,
      })),
      monthlySnapshots: [...state.monthlySnapshots, snapshot],
      unviewedReportMonth: oldMonth,
      xpAtMonthStart: xpNow,
    });

    return { rolled: true, carryOver: oldSafe };
  },

  markRolloverNotified: () => set({ rolloverNotified: true }),

  markReportViewed: () => set({ unviewedReportMonth: null }),
}));
