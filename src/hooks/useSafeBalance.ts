/* ═══ useSafeBalance — Phase 1 refactor: engine-backed safe-to-spend ═══
 * Uses MoneySnapshotV1 + getSafeToSpendBreakdown (isomorphic formula v1.1).
 * Same numbers as the Chat engine — no more dual-source discrepancy.
 *
 * Semantic changes from old formula:
 *  - totalBills:   only UNPAID bills (was all fixed bills)
 *  - totalSavings: planned monthly goal contributions (was dashboard savings)
 *  - status 'caution' replaces old 'low' (isLow maps to caution)
 */
'use client';

import { useMoneySnapshotV1 } from './useMoneySnapshotV1';
import { getSafeToSpendBreakdown } from '@/lib/moneyBrain/safeToSpend';
import { getExpenseForPeriod } from '@/lib/moneyBrain/financeMetrics';

export function useSafeBalance() {
  const snapshot  = useMoneySnapshotV1();
  const breakdown = getSafeToSpendBreakdown(snapshot);
  const totalSpent = getExpenseForPeriod(snapshot, 'this_month');

  // spentPercent: % of planned budget already spent this month
  const spentPercent =
    breakdown.plannedMonthlyBudget > 0
      ? Math.min(100, Math.round((totalSpent / breakdown.plannedMonthlyBudget) * 100))
      : 0;

  return {
    // ── Core numbers ──────────────────────────────────────────────────────
    safeToSpend:        breakdown.safeToSpend,
    monthlyIncome:      breakdown.monthlyIncome,
    carryOver:          breakdown.carryOver,
    totalCategoryLimits: breakdown.plannedMonthlyBudget,
    /** Unpaid bills only (v1.1: was all fixed bills). */
    totalBills:         breakdown.totalUnpaidBills,
    /** Planned monthly goal contributions (v1.1: was dashboard savings). */
    totalSavings:       breakdown.plannedMonthlyGoalContributions,
    totalSpent,
    spentPercent,

    // ── Status helpers ────────────────────────────────────────────────────
    isHealthy:   breakdown.status === 'safe',
    /** true when safeToSpend in (0, 1_000_000] — mapped from engine 'caution'. */
    isLow:       breakdown.status === 'caution',
    isNegative:  breakdown.status === 'danger',
    warningType: breakdown.status,   // 'safe' | 'caution' | 'danger'

    // ── Backward-compat stub (no callers use this) ─────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accounts: undefined as any,
  };
}
