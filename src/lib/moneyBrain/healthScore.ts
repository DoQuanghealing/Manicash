/* ═══ Money Brain — Health Score Deterministic (Phase 1) ═══
 * PURE function. Tổng 100 điểm — LLM KHÔNG được tự tính, chỉ narrate kết quả.
 *
 * Components:
 *   Cashflow          25
 *   Bill coverage     20
 *   Emergency runway  20
 *   Budget discipline 15
 *   Goal progress     10
 *   Income pipeline   10
 *
 * Nguyên tắc: Kết quả luôn deterministic, không gọi API, không Date.now().
 */

import type { MoneySnapshotV1 } from './types';
import { getNetCashflowForPeriod } from './financeMetrics';
import { getExpenseForPeriod } from './financeMetrics';
import { getOverBudgetCategories } from './budgetMetrics';
import { getBillFundCoverageRate, getTotalUnpaidBills } from './billMetrics';
import { getTotalGoalSaved, getPlannedMonthlyGoalContributions } from './goalMetrics';
import { getExpectedIncomePipeline } from './taskMetrics';

export interface HealthScoreBreakdown {
  total: number;
  cashflow: number;           // 0 | 12 | 25
  billCoverage: number;       // 0 | 10 | 20
  emergencyRunway: number;    // 0 | 10 | 20
  budgetDiscipline: number;   // 0 | 8 | 15
  goalProgress: number;       // 0 | 5 | 10
  incomePipeline: number;     // 0 | 10
}

// ─── Component scorers ────────────────────────────────────────────────────────

function scoreCashflow(snapshot: MoneySnapshotV1): number {
  const net = getNetCashflowForPeriod(snapshot, 'this_month');
  if (net > 0) return 25;
  if (net === 0) return 12;
  return 0;
}

function scoreBillCoverage(snapshot: MoneySnapshotV1): number {
  const unpaid = getTotalUnpaidBills(snapshot);
  if (unpaid <= 0) return 20; // Không có bill chưa đóng → full score
  const rate = getBillFundCoverageRate(snapshot);
  if (rate >= 1) return 20;
  if (rate >= 0.5) return 10;
  return 0;
}

function scoreEmergencyRunway(snapshot: MoneySnapshotV1): number {
  const monthlyExpense = getExpenseForPeriod(snapshot, 'this_month');
  const emergencyBalance = snapshot.wallets.emergency;
  if (monthlyExpense <= 0) {
    // Không có chi tiêu tháng này — nếu có quỹ khẩn cấp thì full
    return emergencyBalance > 0 ? 20 : 0;
  }
  const runwayMonths = emergencyBalance / monthlyExpense;
  if (runwayMonths >= 3) return 20;
  if (runwayMonths >= 1) return 10;
  return 0;
}

function scoreBudgetDiscipline(snapshot: MoneySnapshotV1): number {
  const overCount = getOverBudgetCategories(snapshot).length;
  if (overCount === 0) return 15;
  if (overCount === 1) return 8;
  return 0;
}

function scoreGoalProgress(snapshot: MoneySnapshotV1): number {
  const plannedContrib = getPlannedMonthlyGoalContributions(snapshot);
  if (plannedContrib > 0) return 10;
  const totalSaved = getTotalGoalSaved(snapshot);
  if (totalSaved > 0) return 5;
  return 0;
}

function scoreIncomePipeline(snapshot: MoneySnapshotV1): number {
  const pipeline = getExpectedIncomePipeline(snapshot);
  return pipeline > 0 ? 10 : 0;
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

export function getFinancialHealthScore(snapshot: MoneySnapshotV1): HealthScoreBreakdown {
  const cashflow = scoreCashflow(snapshot);
  const billCoverage = scoreBillCoverage(snapshot);
  const emergencyRunway = scoreEmergencyRunway(snapshot);
  const budgetDiscipline = scoreBudgetDiscipline(snapshot);
  const goalProgress = scoreGoalProgress(snapshot);
  const incomePipeline = scoreIncomePipeline(snapshot);

  const total = Math.min(
    100,
    Math.max(0, cashflow + billCoverage + emergencyRunway + budgetDiscipline + goalProgress + incomePipeline),
  );

  return {
    total,
    cashflow,
    billCoverage,
    emergencyRunway,
    budgetDiscipline,
    goalProgress,
    incomePipeline,
  };
}
