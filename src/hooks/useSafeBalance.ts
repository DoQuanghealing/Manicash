/* ═══ useSafeBalance — engine-backed safe-to-spend + trạng thái tài khoản ═══
 * Nguồn số DUY NHẤT (MoneySnapshotV1) cho card Tổng quan lẫn CFO snapshot.
 *  - breakdown số: safe-to-spend v1.1 (chỉ bill CHƯA đóng, goal contribution/tháng).
 *  - accountStatus: 4 mức (xuatsac/tot/trungbinh/canhbao) — xem accountStatus.ts.
 *  - detail: danh sách từng mục cho drill-down "Cách tính số này".
 */
'use client';

import { useMoneySnapshotV1 } from './useMoneySnapshotV1';
import { getSafeToSpendBreakdown } from '@/lib/moneyBrain/safeToSpend';
import { getBalanceBreakdownDetail } from '@/lib/moneyBrain/balanceBreakdown';
import { computeAccountStatus } from '@/lib/moneyBrain/accountStatus';
import { getExpenseForPeriod } from '@/lib/moneyBrain/financeMetrics';

export function useSafeBalance() {
  const snapshot = useMoneySnapshotV1();
  const breakdown = getSafeToSpendBreakdown(snapshot);
  const detail = getBalanceBreakdownDetail(snapshot);
  const accountStatus = computeAccountStatus(snapshot);
  const totalSpent = getExpenseForPeriod(snapshot, 'this_month');

  const spentPercent =
    breakdown.plannedMonthlyBudget > 0
      ? Math.min(100, Math.round((totalSpent / breakdown.plannedMonthlyBudget) * 100))
      : 0;

  return {
    // ── Core numbers ──
    safeToSpend: breakdown.safeToSpend,
    monthlyIncome: breakdown.monthlyIncome,
    carryOver: breakdown.carryOver,
    totalCategoryLimits: breakdown.plannedMonthlyBudget,
    /** Unpaid bills only. */
    totalBills: breakdown.totalUnpaidBills,
    /** Planned monthly goal contributions. */
    totalSavings: breakdown.plannedMonthlyGoalContributions,
    totalSpent,
    spentPercent,

    // ── Trạng thái + chi tiết drill-down ──
    accountStatus,
    detail,
  };
}
