/* ═══ useBudgetAlert — Category budget warnings ═══ */
'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { EXPENSE_CATEGORIES } from '@/data/categories';

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  icon: string;
  spent: number;
  limit: number;
  percent: number;
  level: 'warning' | 'danger';
}

/**
 * Trả về danh sách category đang vượt hoặc gần vượt ngưỡng budget.
 * - warning: ≥ 80%
 * - danger: ≥ 100%
 */
export function useBudgetAlert() {
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentMonth = useBudgetStore((s) => s.currentMonth);

  const alerts = useMemo<BudgetAlert[]>(() => {
    const results: BudgetAlert[] = [];

    for (const budget of categoryBudgets) {
      if (budget.month !== currentMonth || budget.monthlyLimit === 0) continue;

      const percent = Math.round((budget.spent / budget.monthlyLimit) * 100);
      if (percent < 80) continue;

      const cat = EXPENSE_CATEGORIES.find((c) => c.id === budget.categoryId);
      results.push({
        categoryId: budget.categoryId,
        categoryName: cat?.name || budget.categoryId,
        icon: cat?.icon || '📦',
        spent: budget.spent,
        limit: budget.monthlyLimit,
        percent,
        level: percent >= 100 ? 'danger' : 'warning',
      });
    }

    return results.sort((a, b) => b.percent - a.percent);
  }, [categoryBudgets, currentMonth]);

  return {
    alerts,
    hasWarning: alerts.some((a) => a.level === 'warning'),
    hasDanger: alerts.some((a) => a.level === 'danger'),
    count: alerts.length,
  };
}
