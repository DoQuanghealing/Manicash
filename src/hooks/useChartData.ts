/* ═══ useChartData — Compute chart data from finance store ═══ */
'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';

export interface WeekBarData {
  label: string;
  income: number;
  expense: number;
}

export interface SavingsPoint {
  label: string;
  amount: number;
}

export function useChartData() {
  const transactions = useFinanceStore((s) => s.transactions);
  const totalIncome = useFinanceStore((s) => s.getTotalIncome());
  const totalExpense = useFinanceStore((s) => s.getTotalExpense());
  const safeToSpend = useBudgetStore((s) => s.getSafeToSpend());
  const monthlyLimit = useBudgetStore((s) => s.getTotalCategoryLimits());

  // Weekly income vs expense (last 4 weeks)
  const weeklyComparison = useMemo<WeekBarData[]>(() => {
    const weeks: WeekBarData[] = [];
    const now = new Date();

    for (let w = 3; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (w + 1) * 7);
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);

      const weekTxns = transactions.filter((t) => {
        const d = new Date(t.dateKey);
        return d >= start && d < end;
      });

      const income = weekTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = weekTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      weeks.push({
        label: `T${4 - w}`,
        income,
        expense,
      });
    }

    // If no real data, use demo
    if (weeks.every((w) => w.income === 0 && w.expense === 0)) {
      return [
        { label: 'T1', income: 8_000_000, expense: 5_500_000 },
        { label: 'T2', income: 4_000_000, expense: 6_200_000 },
        { label: 'T3', income: 12_000_000, expense: 4_800_000 },
        { label: 'T4', income: 3_000_000, expense: 3_500_000 },
      ];
    }

    return weeks;
  }, [transactions]);

  // Monthly savings growth (last 6 months)
  const savingsGrowth = useMemo<SavingsPoint[]>(() => {
    // Demo data — in real app, from monthly snapshots
    return [
      { label: 'T11', amount: 8_000_000 },
      { label: 'T12', amount: 12_500_000 },
      { label: 'T1', amount: 15_000_000 },
      { label: 'T2', amount: 18_200_000 },
      { label: 'T3', amount: 22_000_000 },
      { label: 'T4', amount: 25_500_000 },
    ];
  }, []);

  // Health score: 0-100
  const healthScore = useMemo(() => {
    if (monthlyLimit === 0) return 50;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const safeRatio = (safeToSpend / monthlyLimit) * 100;
    return Math.min(100, Math.max(0, Math.round(savingsRate * 0.6 + safeRatio * 0.4)));
  }, [totalIncome, totalExpense, safeToSpend, monthlyLimit]);

  return { weeklyComparison, savingsGrowth, healthScore };
}
