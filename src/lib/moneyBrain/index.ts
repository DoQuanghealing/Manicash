/* ═══ Money Brain — Public API (Phase 1) ═══
 * Re-export tất cả public functions để consumer import gọn:
 *   import { getSafeToSpendBreakdown, getFinancialHealthScore } from '@/lib/moneyBrain';
 */

export * from './types';
export * from './dateRange';
export * from './normalize';
export * from './snapshot';
export * from './financeMetrics';
export * from './budgetMetrics';
export * from './billMetrics';
export * from './goalMetrics';
export * from './taskMetrics';
export * from './safeToSpend';
export * from './healthScore';
