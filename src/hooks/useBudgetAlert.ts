/* ═══ useBudgetAlert — Category budget warnings ═══
 * Phase 1B: spent recomputed from transactions via Money Brain engine.
 * No longer reads categoryBudgets[].spent accumulator (was stale when txns edited).
 */
'use client';

import { useMemo } from 'react';
import { EXPENSE_CATEGORIES } from '@/data/categories';
import { useMoneySnapshotV1 } from './useMoneySnapshotV1';
import { getBudgetCategoryProgress } from '@/lib/moneyBrain/budgetMetrics';

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  icon: string;
  spent: number;
  limit: number;
  /** Raw %, not capped — can exceed 100 for "danger" display. */
  percent: number;
  level: 'warning' | 'danger';
}

/**
 * Trả về danh sách category đang vượt hoặc gần vượt ngưỡng budget.
 * - warning: ≥ 80 %
 * - danger: ≥ 100 %
 *
 * `spent` được recompute từ giao dịch tháng hiện tại — không đọc `budget.spent`.
 */
export function useBudgetAlert() {
  const snapshot = useMoneySnapshotV1();

  const alerts = useMemo<BudgetAlert[]>(() => {
    const progresses = getBudgetCategoryProgress(snapshot);
    const results: BudgetAlert[] = [];

    for (const b of progresses) {
      if (b.monthlyLimit === 0) continue;

      // Use raw percent (no cap) so the banner can show "120%" for danger.
      const rawPercent = Math.round((b.spent / b.monthlyLimit) * 100);
      if (rawPercent < 80) continue;

      const cat = EXPENSE_CATEGORIES.find((c) => c.id === b.categoryId);
      results.push({
        categoryId:   b.categoryId,
        categoryName: cat?.name || b.categoryId,
        icon:         cat?.icon || '📦',
        spent:        b.spent,
        limit:        b.monthlyLimit,
        percent:      rawPercent,
        level:        rawPercent >= 100 ? 'danger' : 'warning',
      });
    }

    return results.sort((a, b) => b.percent - a.percent);
  }, [snapshot]);

  return {
    alerts,
    hasWarning: alerts.some((a) => a.level === 'warning'),
    hasDanger:  alerts.some((a) => a.level === 'danger'),
    count:      alerts.length,
  };
}
