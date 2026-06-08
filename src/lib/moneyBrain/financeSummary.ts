/* ═══ Money Brain — Finance Summary (Phase 0 → Phase 1 compat) ═══
 * Phase 0 đã export getIncomeForPeriod / getExpenseForPeriod từ file này.
 * Phase 1 chuyển logic sang financeMetrics.ts (đầy đủ hơn).
 * File này giữ nguyên để không phá các import hiện có; chỉ re-export.
 */

export { getIncomeForPeriod, getExpenseForPeriod } from './financeMetrics';
