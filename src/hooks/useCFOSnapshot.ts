/* ═══ useCFOSnapshot — Aggregate finance data for CFO analysis ═══
 * Gom data từ useFinanceStore + useBudgetStore + useSafeBalance → HealthSnapshot.
 * Tính sẵn healthScore (client-side) để:
 *   - HealthScoreGauge render ngay không chờ API
 *   - Cache key của useCFOReport đổi khi data đổi
 *   - API route vẫn tính lại độc lập (guard against client tampering)
 */
'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useSafeBalance } from './useSafeBalance';
import {
  computeHealthScore,
  type HealthSnapshot,
  type HealthBreakdown,
} from '@/lib/cfoHealthScore';
import type { CFOPayload } from '@/lib/groqClient';

export interface CFOSnapshotBundle {
  snapshot: HealthSnapshot;
  payload: CFOPayload;
  breakdown: HealthBreakdown;
  /** Stable key — đổi khi bất kỳ field business-relevant đổi. */
  cacheKey: string;
}

export function useCFOSnapshot(): CFOSnapshotBundle {
  // === Safe-to-spend derived values (wraps Finance + Budget + Dashboard) ===
  const { safeToSpend, monthlyIncome, totalSpent: monthlyExpense } = useSafeBalance();

  // === Direct finance store reads ===
  const emergencyBalance = useFinanceStore((s) => s.emergencyBalance);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const transactions = useFinanceStore((s) => s.transactions);

  // === Budget store reads ===
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentMonth = useBudgetStore((s) => s.currentMonth);

  return useMemo<CFOSnapshotBundle>(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const todayIso = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // === Budget counts — chỉ trong tháng hiện tại ===
    const monthCats = categoryBudgets.filter((b) => b.month === currentMonth);
    const categoriesTotal = monthCats.length;
    const categoriesOverBudget = monthCats.filter((b) => b.spent > b.monthlyLimit).length;

    // === Bill counts — TODO(billPaymentHistory): flag isPaid không reset khi sang tháng mới
    //     (bug trong useBudgetStore.checkAndRollover). Tạm chấp nhận — fix ở PR khác.
    const dueBills = fixedBills.filter((b) => b.dueDay <= dayOfMonth);
    const billsDueByNow = dueBills.length;
    const billsPaidOfDue = dueBills.filter((b) => b.isPaid).length;

    // === Transaction count — tháng hiện tại ===
    const transactionCount = transactions.filter((t) => {
      const d = new Date(t.date);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return m === currentMonth;
    }).length;

    const snapshot: HealthSnapshot = {
      monthlyIncome,
      monthlyExpense,
      safeToSpend,
      emergencyBalance,
      categoriesTotal,
      categoriesOverBudget,
      billsDueByNow,
      billsPaidOfDue,
      dayOfMonth,
    };

    const breakdown = computeHealthScore(snapshot);

    const payload: CFOPayload = {
      monthlyIncome,
      monthlyExpense,
      savingsRate: breakdown.savingsRate,
      safeToSpend,
      emergencyBalance,
      categoriesTotal,
      categoriesOverBudget,
      billsDueByNow,
      billsPaidOfDue,
      transactionCount,
    };

    // Cache key — per Q5 approved format
    const cacheKey =
      `${todayIso}_${monthlyIncome}_${monthlyExpense}_${transactionCount}` +
      `_${categoriesOverBudget}_${billsPaidOfDue}_${emergencyBalance}`;

    return { snapshot, payload, breakdown, cacheKey };
  }, [
    monthlyIncome,
    monthlyExpense,
    safeToSpend,
    emergencyBalance,
    fixedBills,
    categoryBudgets,
    currentMonth,
    transactions,
  ]);
}
