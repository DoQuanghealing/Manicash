/* ═══ Budget Store — Monthly Budget + Category Limits ═══ */
'use client';

import { create } from 'zustand';
import type { CategoryBudget } from '@/types/budget';

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

  // Computed
  getTotalCategoryLimits: () => number;
  getTotalSpent: () => number;
  getSafeToSpend: () => number;
  getCategoryRemaining: (catId: string) => number;
  getCategoryProgress: (catId: string) => number; // 0-100
  isOverBudget: (catId: string) => boolean;
  getOverBudgetCategories: () => CategoryBudget[];

  // Actions
  setCategoryBudget: (catId: string, limit: number) => void;
  addSpending: (catId: string, amount: number) => void;
  checkAndRollover: () => { rolled: boolean; carryOver: number };
  markRolloverNotified: () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  carryOver: 800_000, // Dư từ tháng trước (demo)
  currentMonth: getCurrentMonth(),
  categoryBudgets: SEED_BUDGETS,
  rolloverNotified: false,

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

  /** Auto-rollover: gọi khi mở app, kiểm tra tháng mới */
  checkAndRollover: () => {
    const state = get();
    const actualMonth = getCurrentMonth();

    if (state.currentMonth === actualMonth) {
      return { rolled: false, carryOver: state.carryOver };
    }

    // Tháng mới! Chốt số dư
    const oldSafe = state.getSafeToSpend();

    set({
      carryOver: oldSafe,
      currentMonth: actualMonth,
      rolloverNotified: false,
      categoryBudgets: state.categoryBudgets.map((b) => ({
        ...b,
        spent: 0,
        month: actualMonth,
      })),
    });

    return { rolled: true, carryOver: oldSafe };
  },

  markRolloverNotified: () => set({ rolloverNotified: true }),
}));
