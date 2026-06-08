/* ═══ Money Brain — Financial Mode (Phase 3) ═══
 * PURE function. Suy ra "chế độ tài chính" hiện tại từ snapshot để CFO định hướng.
 * Không Date.now(), không API.
 */

import type { MoneySnapshotV1 } from './types';
import type { FinancialMode } from './cfoTypes';
import { getExpenseForPeriod, getSavingsRateForPeriod } from './financeMetrics';
import { getSafeToSpendBreakdown } from './safeToSpend';
import { getBillFundCoverageRate } from './billMetrics';
import { getOverBudgetCategories } from './budgetMetrics';
import { getAtRiskGoals } from './goalMetrics';

/**
 * Số tháng quỹ khẩn cấp trụ được = emergency / chi tiêu tháng.
 * Nếu chưa có chi tiêu: emergency > 0 → coi như runway rất dài (999), else 0.
 */
export function getEmergencyRunwayMonths(snapshot: MoneySnapshotV1): number {
  const monthlyExpense = getExpenseForPeriod(snapshot, 'this_month');
  const emergency = snapshot.wallets.emergency;
  if (monthlyExpense <= 0) return emergency > 0 ? 999 : 0;
  return emergency / monthlyExpense;
}

/**
 * Rules v1:
 *  - safeToSpend <= 0 hoặc billCoverage < 1            → stabilize
 *  - safeToSpend > 0 && savingsRate < 20              → build_cashflow
 *  - savingsRate >= 20 && runway >= 3:
 *      + thanh khoản mạnh (>= 6 tháng chi) + 0 overbudget + 0 goal at-risk → protect_capital
 *      + còn lại                                       → accelerate
 *  - mặc định                                          → build_cashflow
 */
export function deriveFinancialMode(snapshot: MoneySnapshotV1): FinancialMode {
  const sts = getSafeToSpendBreakdown(snapshot);
  const billCoverage = getBillFundCoverageRate(snapshot);

  if (sts.safeToSpend <= 0 || billCoverage < 1) return 'stabilize';

  const savingsRate = getSavingsRateForPeriod(snapshot, 'this_month');
  if (savingsRate < 20) return 'build_cashflow';

  const runway = getEmergencyRunwayMonths(snapshot);
  if (runway >= 3) {
    const overBudget = getOverBudgetCategories(snapshot);
    const atRisk = getAtRiskGoals(snapshot);
    const monthlyExpense = getExpenseForPeriod(snapshot, 'this_month');
    const totalLiquid =
      snapshot.wallets.main + snapshot.wallets.emergency + snapshot.wallets.billFund;
    const strongLiquidity = monthlyExpense <= 0 ? totalLiquid > 0 : totalLiquid >= 6 * monthlyExpense;

    if (strongLiquidity && overBudget.length === 0 && atRisk.length === 0) {
      return 'protect_capital';
    }
    return 'accelerate';
  }

  return 'build_cashflow';
}
