/* ═══ Money Brain — Budget Metrics (Phase 1) ═══
 * PURE functions. Budget spent được recompute từ transactions (KHÔNG tin budget.spent).
 * Dùng normalizeCategoryId để xử lý alias entertain → entertainment.
 */

import type { MoneySnapshotV1 } from './types';
import { normalizeCategoryId } from './normalize';
import { isTransactionInPeriod, getCurrentMonthKey } from './dateRange';

export interface BudgetCategoryProgress {
  categoryId: string;
  categoryName?: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  progress: number;      // 0..100
  isOverBudget: boolean;
}

// ─── Planned budget ───────────────────────────────────────────────────────────

/** Tổng ngưỡng chi tiêu đã thiết lập cho tháng hiện tại. */
export function getPlannedMonthlyBudget(snapshot: MoneySnapshotV1): number {
  const currentMK = getCurrentMonthKey(snapshot.clientNow, snapshot.timezone);
  return snapshot.budgets
    .filter((b) => b.monthKey === currentMK)
    .reduce((sum, b) => sum + b.monthlyLimit, 0);
}

// ─── Recompute spent từ transactions ─────────────────────────────────────────

/**
 * Tính spent PER category từ giao dịch tháng hiện tại.
 * KHÔNG đọc budget.spent — đọc transactions để luôn nhất quán khi sửa/xóa giao dịch.
 * Dùng normalizeCategoryId để alias map đúng.
 */
export function computeBudgetSpentByCategory(
  snapshot: MoneySnapshotV1,
): Record<string, number> {
  const ctx = { clientNow: snapshot.clientNow, timezone: snapshot.timezone };
  const result: Record<string, number> = {};
  for (const t of snapshot.transactions) {
    if (t.type !== 'expense') continue;
    if (!isTransactionInPeriod(t, 'this_month', ctx)) continue;
    const catId = normalizeCategoryId(t.categoryId) ?? 'other';
    result[catId] = (result[catId] ?? 0) + t.amount;
  }
  return result;
}

// ─── Category progress ────────────────────────────────────────────────────────

export function getBudgetCategoryProgress(
  snapshot: MoneySnapshotV1,
): BudgetCategoryProgress[] {
  const spentMap = computeBudgetSpentByCategory(snapshot);
  const currentMK = getCurrentMonthKey(snapshot.clientNow, snapshot.timezone);

  return snapshot.budgets
    .filter((b) => b.monthKey === currentMK)
    .map((b) => {
      const catId = normalizeCategoryId(b.categoryId) ?? b.categoryId;
      const spent = spentMap[catId] ?? 0;
      const remaining = Math.max(0, b.monthlyLimit - spent);
      const progress =
        b.monthlyLimit > 0 ? Math.min(100, (spent / b.monthlyLimit) * 100) : 0;
      return {
        categoryId: catId,
        categoryName: b.categoryName,
        monthlyLimit: b.monthlyLimit,
        spent,
        remaining,
        progress,
        isOverBudget: spent > b.monthlyLimit,
      };
    });
}

export function getBudgetProgressForCategory(
  snapshot: MoneySnapshotV1,
  categoryId: string,
): BudgetCategoryProgress | null {
  const normId = normalizeCategoryId(categoryId) ?? categoryId;
  return getBudgetCategoryProgress(snapshot).find((b) => b.categoryId === normId) ?? null;
}

export function getOverBudgetCategories(
  snapshot: MoneySnapshotV1,
): BudgetCategoryProgress[] {
  return getBudgetCategoryProgress(snapshot).filter((b) => b.isOverBudget);
}

export function getTotalBudgetSpent(snapshot: MoneySnapshotV1): number {
  return getBudgetCategoryProgress(snapshot).reduce((sum, b) => sum + b.spent, 0);
}

export function getTotalBudgetRemaining(snapshot: MoneySnapshotV1): number {
  return getBudgetCategoryProgress(snapshot).reduce((sum, b) => sum + b.remaining, 0);
}

/**
 * Số tiền tiết kiệm nếu cắt cutPercent của spending thực tế.
 * cutPercent kẹp [0, 1] — tránh misuse.
 */
export function getSavingsPotentialForCategory(
  snapshot: MoneySnapshotV1,
  categoryId: string,
  cutPercent: number,
): number {
  const progress = getBudgetProgressForCategory(snapshot, categoryId);
  if (!progress) return 0;
  const pct = Math.max(0, Math.min(1, cutPercent));
  return Math.round(progress.spent * pct);
}
