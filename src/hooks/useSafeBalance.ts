/* useSafeBalance - derived from the canonical 3-account overview snapshot */
'use client';

import { useAccountOverviewSnapshot } from '@/stores/useAccountOverviewStore';

/**
 * Formula lives in useAccountOverviewStore.buildAccountOverviewSnapshot().
 * Keep this hook as the backward-compatible API for existing components.
 */
export function useSafeBalance() {
  const { safeToSpend: safe, accounts } = useAccountOverviewSnapshot();

  const safeToSpend = safe.amount;
  const monthlyIncome = safe.monthlyIncome;
  const carryOver = safe.carryOver;
  const totalCategoryLimits = safe.spendingLimit;
  const totalBills = safe.fixedBills;
  const totalSavings = safe.monthlySavings;
  const totalSpent = safe.monthlyExpense;
  const spentPercent = safe.spentPercent;

  const isNegative = safe.status === 'danger';
  const isLow = safe.status === 'low';
  const isHealthy = safe.status === 'safe';
  const warningType = safe.status;

  return {
    accounts,
    safeToSpend,
    monthlyIncome,
    carryOver,
    totalCategoryLimits,
    totalBills,
    totalSavings,
    totalSpent,
    spentPercent,
    isHealthy,
    isLow,
    isNegative,
    warningType,
  };
}
