/* ═══ Money Brain — Safe-to-Spend v1.1 (Phase 1) ═══
 * PURE function. Công thức chốt:
 *   safeToSpend = monthlyIncome + carryOver
 *                 − plannedMonthlyBudget
 *                 − totalUnpaidBills          (KHÔNG phải total bills)
 *                 − plannedMonthlyGoalContributions  (KHÔNG phải goal.currentAmount)
 *
 * Status thresholds:
 *   safe    > 1.000.000 đ
 *   caution  > 0 && ≤ 1.000.000 đ
 *   danger  ≤ 0
 */

import type { MoneySnapshotV1 } from './types';
import { getIncomeForPeriod } from './financeMetrics';
import { getPlannedMonthlyBudget } from './budgetMetrics';
import { getTotalUnpaidBills } from './billMetrics';
import { getPlannedMonthlyGoalContributions } from './goalMetrics';
import { getTodayKey } from './dateRange';

export interface SafeToSpendBreakdown {
  monthlyIncome: number;
  carryOver: number;
  plannedMonthlyBudget: number;
  totalUnpaidBills: number;
  plannedMonthlyGoalContributions: number;
  safeToSpend: number;
  status: 'safe' | 'caution' | 'danger';
  daysLeftInMonth: number;
  safeToSpendPerDay: number;
}

function getDaysLeftInMonth(clientNow: string, timezone: string): number {
  const todayKey = getTodayKey(clientNow, timezone);
  const [y, m, d] = todayKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // UTC(y, m, 0) = last day of month m
  // +1 to include today itself
  return Math.max(1, lastDay - d + 1);
}

export function getSafeToSpendBreakdown(
  snapshot: MoneySnapshotV1,
): SafeToSpendBreakdown {
  const monthlyIncome = getIncomeForPeriod(snapshot, 'this_month');
  const carryOver = snapshot.carryOver ?? 0;
  const plannedMonthlyBudget = getPlannedMonthlyBudget(snapshot);
  const totalUnpaidBills = getTotalUnpaidBills(snapshot);
  const plannedMonthlyGoalContributions = getPlannedMonthlyGoalContributions(snapshot);

  const safeToSpend =
    monthlyIncome + carryOver - plannedMonthlyBudget - totalUnpaidBills - plannedMonthlyGoalContributions;

  const status: 'safe' | 'caution' | 'danger' =
    safeToSpend > 1_000_000 ? 'safe' : safeToSpend > 0 ? 'caution' : 'danger';

  const daysLeftInMonth = getDaysLeftInMonth(snapshot.clientNow, snapshot.timezone);
  const safeToSpendPerDay = safeToSpend / Math.max(1, daysLeftInMonth);

  return {
    monthlyIncome,
    carryOver,
    plannedMonthlyBudget,
    totalUnpaidBills,
    plannedMonthlyGoalContributions,
    safeToSpend,
    status,
    daysLeftInMonth,
    safeToSpendPerDay,
  };
}
