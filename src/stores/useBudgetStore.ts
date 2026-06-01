/* ═══ Budget Store — Monthly Budget + Category Limits ═══ */
'use client';

import { create } from 'zustand';
import type { CategoryBudget, MonthlySnapshot } from '@/types/budget';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { generateButlerReport } from '@/lib/butlerReport';

import { getCurrentMonthKey, getMonthKeyFromDate } from '@/lib/dateHelpers';

// Demo category budgets
const SEED_BUDGETS: CategoryBudget[] = [
  { categoryId: 'food',      monthlyLimit: 4_000_000, spent: 2_800_000, month: getCurrentMonthKey() },
  { categoryId: 'coffee',    monthlyLimit: 800_000,   spent: 650_000,   month: getCurrentMonthKey() },
  { categoryId: 'transport', monthlyLimit: 1_500_000, spent: 900_000,   month: getCurrentMonthKey() },
  { categoryId: 'shopping',  monthlyLimit: 2_000_000, spent: 1_200_000, month: getCurrentMonthKey() },
  { categoryId: 'entertain', monthlyLimit: 1_000_000, spent: 750_000,   month: getCurrentMonthKey() },
  { categoryId: 'health',    monthlyLimit: 500_000,   spent: 200_000,   month: getCurrentMonthKey() },
];

interface BudgetState {
  carryOver: number;            // Dư tháng trước
  currentMonth: string;
  categoryBudgets: CategoryBudget[];
  rolloverNotified: boolean;    // Đã thông báo rollover chưa

  /**
   * Danh sách categoryId user đã gắn cờ "chú ý chi quá tay".
   * AI CFO sẽ ưu tiên nhắc nhở các khoản này. Tồn tại độc lập với over-budget
   * detection — user có thể flag cả khi chưa vượt ngưỡng (chủ động phòng ngừa).
   */
  flaggedCategories: string[];

  /**
   * Danh sách transactionId user đã gắn cờ riêng từng giao dịch.
   * Ví dụ: "Ăn sushi cuối tuần 850k" — user flag để CFO nhắc giảm lần sau.
   * Khác `flaggedCategories` — flag ở MỨC GIAO DỊCH, granular hơn.
   */
  flaggedTransactionIds: string[];

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
  isCategoryFlagged: (catId: string) => boolean;
  isTransactionFlagged: (txnId: string) => boolean;
  /** Số tiền tiết kiệm được nếu cắt giảm `cutPercent` (0-1) ở category này tháng tới. */
  getSavingsPotential: (catId: string, cutPercent: number) => number;
  /** Lấy snapshot/report của tháng có unviewedReportMonth. */
  getUnviewedReport: () => MonthlySnapshot | null;

  // Actions
  setCategoryBudget: (catId: string, limit: number) => void;
  addSpending: (catId: string, amount: number) => void;
  toggleCategoryFlag: (catId: string) => void;
  toggleTransactionFlag: (txnId: string) => void;
  /** Flag/unflag nhiều transaction cùng lúc — dùng cho "Gắn cảnh báo cả N khoản". */
  setTransactionFlags: (txnIds: string[], flagged: boolean) => void;
  updateSnapshotTotals: (monthKey: string) => void;
  checkAndRollover: () => { rolled: boolean; carryOver: number };
  markRolloverNotified: () => void;
  /** User đã đọc/đóng modal báo cáo — ngừng show lại. */
  markReportViewed: () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  carryOver: 800_000, // Dư từ tháng trước (demo)
  currentMonth: getCurrentMonthKey(),
  categoryBudgets: SEED_BUDGETS,
  rolloverNotified: false,
  // Demo: 'entertain' đã được gắn cờ để user mới có sample trạng thái UI
  flaggedCategories: ['entertain'],
  flaggedTransactionIds: [],
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

  isCategoryFlagged: (catId) => get().flaggedCategories.includes(catId),

  isTransactionFlagged: (txnId) => get().flaggedTransactionIds.includes(txnId),

  /**
   * Savings potential = spent * cutPercent.
   * Dùng `spent` thay vì `limit` vì ý nghĩa là "nếu kỷ luật hơn, tiết kiệm bao nhiêu
   * SO VỚI mức chi thực tế tháng này" — sát thực tế hơn ngưỡng abstract.
   * cutPercent kẹp [0, 1] để chống misuse.
   */
  getSavingsPotential: (catId, cutPercent) => {
    const pct = Math.max(0, Math.min(1, cutPercent));
    const budget = get().categoryBudgets.find(
      (b) => b.categoryId === catId && b.month === get().currentMonth
    );
    if (!budget) return 0;
    return Math.round(budget.spent * pct);
  },

  toggleCategoryFlag: (catId) =>
    set((state) => ({
      flaggedCategories: state.flaggedCategories.includes(catId)
        ? state.flaggedCategories.filter((id) => id !== catId)
        : [...state.flaggedCategories, catId],
    })),

  toggleTransactionFlag: (txnId) =>
    set((state) => ({
      flaggedTransactionIds: state.flaggedTransactionIds.includes(txnId)
        ? state.flaggedTransactionIds.filter((id) => id !== txnId)
        : [...state.flaggedTransactionIds, txnId],
    })),

  setTransactionFlags: (txnIds, flagged) =>
    set((state) => {
      const set = new Set(state.flaggedTransactionIds);
      if (flagged) txnIds.forEach((id) => set.add(id));
      else txnIds.forEach((id) => set.delete(id));
      return { flaggedTransactionIds: Array.from(set) };
    }),

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
  updateSnapshotTotals: (monthKey: string) => {
    const state = get();
    const existing = state.monthlySnapshots.find((s) => s.month === monthKey);
    if (!existing) {
      console.warn(`[BudgetStore] Không tìm thấy snapshot cho tháng ${monthKey}. Bỏ qua cập nhật.`);
      return;
    }

    const { useFinanceStore } = require('@/stores/useFinanceStore');
    const allTxns = useFinanceStore.getState().transactions;
    const { getMonthKeyFromDate } = require('@/lib/dateHelpers');

    const txnsInMonth = allTxns.filter((t: any) => getMonthKeyFromDate(t.date) === monthKey);
    
    const incomeTotal = txnsInMonth
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
      
    const expenseTotal = txnsInMonth
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    set((s) => ({
      monthlySnapshots: s.monthlySnapshots.map((snap) =>
        snap.month === monthKey
          ? { ...snap, incomeTotal, expenseTotal }
          : snap
      ),
    }));
  },

  checkAndRollover: () => {
    const state = get();
    const actualMonth = getCurrentMonthKey();

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
    const oldMonthTxns = finance.transactions.filter((t) => getMonthKeyFromDate(t.date) === oldMonth);
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
    // Lazy-init: lần rollover ĐẦU TIÊN, xpAtMonthStart === 0 trong khi user đã có xp
    // sẵn (vd demo profile xp=2500). Skip delta cho tháng này để tránh report inflate;
    // các tháng sau hoạt động bình thường nhờ set xpAtMonthStart = xpNow ở cuối.
    const xpNow = useAuthStore.getState().user?.xp || 0;
    const isFirstMonth = state.xpAtMonthStart === 0 && xpNow > 0;
    const xpEarned = isFirstMonth ? 0 : xpNow - state.xpAtMonthStart;

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

    // === Reset bills: tháng mới → tất cả bill về "chưa đóng" ===
    useFinanceStore.getState().resetBillsPaid();

    return { rolled: true, carryOver: oldSafe };
  },

  markRolloverNotified: () => set({ rolloverNotified: true }),

  markReportViewed: () => set({ unviewedReportMonth: null }),
}));
