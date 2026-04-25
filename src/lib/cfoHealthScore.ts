/* ═══ CFO Health Score — Deterministic Formula ═══
 * Pure function — không side effect, không import store.
 * Tính điểm sức khỏe tài chính 0-100 dựa trên 5 sub-scores có trọng số cố định.
 * AI Groq chỉ dùng để viết summary/suggestions; KHÔNG tự quyết healthScore.
 */

/** Snapshot raw data đủ để tính healthScore. */
export interface HealthSnapshot {
  // Thu chi tháng hiện tại
  monthlyIncome: number;
  monthlyExpense: number;

  // Số dư an toàn (từ useSafeBalance hook)
  safeToSpend: number;

  // Quỹ khẩn cấp (useFinanceStore.emergencyBalance — 3-wallet source of truth)
  emergencyBalance: number;

  // Budget adherence — đếm categories của current month
  categoriesTotal: number;       // Tổng số categories đã set budget
  categoriesOverBudget: number;  // Số categories đã vượt monthlyLimit

  // Bills on time — chỉ trong tháng hiện tại
  // TODO(billPaymentHistory): khi có model lịch sử trả bill, upgrade sang cửa sổ 3 tháng
  billsDueByNow: number;   // Bills có dueDay <= ngày hiện tại
  billsPaidOfDue: number;  // Trong số đó, bills đã isPaid = true

  // Ngày trong tháng (1-31) — dùng để extrapolate avgMonthlyExpense khi đầu tháng
  dayOfMonth: number;
}

/** Breakdown chi tiết để debug & feed prompt cho AI. */
export interface HealthBreakdown {
  total: number; // 0-100, rounded

  // Sub-scores (mỗi cái 0-100, chưa nhân trọng số)
  savingsRateScore: number;
  budgetAdherenceScore: number;
  billsOnTimeScore: number;
  emergencyFundScore: number;
  safeToSpendScore: number;

  // Raw values dùng cho narrative AI
  savingsRate: number;               // tỷ lệ tiết kiệm thực (có thể âm)
  avgMonthlyExpenseEstimate: number; // ước tính chi cả tháng (đã extrapolate)
}

/** Trọng số từng thành phần — tổng = 1.0 */
export const HEALTH_WEIGHTS = {
  savingsRate: 0.30,
  budgetAdherence: 0.25,
  billsOnTime: 0.20,
  emergencyFund: 0.15,
  safeToSpend: 0.10,
} as const;

/**
 * Ước tính chi cả tháng từ chi hiện tại + ngày trong tháng.
 * Đầu tháng (day < 15): extrapolate × (30 / dayOfMonth) để tránh underestimate.
 * Giữa/cuối tháng (day >= 15): dùng thẳng expense đã đủ representative.
 *
 * TODO(monthlySnapshot): khi có MonthlySnapshot lưu lịch sử tháng trước,
 * dùng avg(last 3 months) thay cho extrapolation.
 */
export function estimateAvgMonthlyExpense(
  currentExpense: number,
  dayOfMonth: number,
): number {
  if (dayOfMonth <= 0) return currentExpense;
  if (dayOfMonth < 15) {
    return currentExpense * (30 / dayOfMonth);
  }
  return currentExpense;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Savings rate score — bucket theo ngưỡng phần trăm */
function scoreSavingsRate(savingsRate: number, income: number): number {
  if (income <= 0) return 0;
  if (savingsRate >= 0.20) return 100;
  if (savingsRate >= 0.10) return 70;
  if (savingsRate >= 0) return 40;
  return 0;
}

/** Budget adherence — % categories chưa vượt ngưỡng */
function scoreBudgetAdherence(total: number, over: number): number {
  // Chưa set budget nào → neutral 50 (không phạt cũng không thưởng)
  if (total <= 0) return 50;
  const notOver = Math.max(0, total - over);
  return (notOver / total) * 100;
}

/** Bills on time — % bills tới hạn đã được thanh toán */
function scoreBillsOnTime(dueByNow: number, paidOfDue: number): number {
  // Chưa có bill nào tới hạn → coi như 100 (không có gì sai)
  if (dueByNow <= 0) return 100;
  return clamp((paidOfDue / dueByNow) * 100, 0, 100);
}

/** Emergency fund — quỹ dự phòng / (3 × chi tháng trung bình), cap 100 */
function scoreEmergencyFund(emergency: number, avgMonthlyExpense: number): number {
  // Không có chi → không thể tính tỷ lệ → neutral 50
  if (avgMonthlyExpense <= 0) return 50;
  const ratio = emergency / (3 * avgMonthlyExpense);
  return clamp(ratio * 100, 0, 100);
}

/** Safe-to-spend — chỉ nhị phân: dương → 100, âm → 0 */
function scoreSafeToSpend(safeToSpend: number): number {
  return safeToSpend >= 0 ? 100 : 0;
}

/**
 * Tính healthScore tổng hợp từ snapshot.
 * Thứ tự: từng sub-score → nhân trọng số → round → clamp [0, 100].
 */
export function computeHealthScore(snapshot: HealthSnapshot): HealthBreakdown {
  const {
    monthlyIncome,
    monthlyExpense,
    safeToSpend,
    emergencyBalance,
    categoriesTotal,
    categoriesOverBudget,
    billsDueByNow,
    billsPaidOfDue,
    dayOfMonth,
  } = snapshot;

  // Savings rate (có thể âm nếu chi > thu)
  const savingsRate = monthlyIncome > 0
    ? (monthlyIncome - monthlyExpense) / monthlyIncome
    : 0;

  // Ước tính chi cả tháng (cho emergency fund ratio)
  const avgMonthlyExpenseEstimate = estimateAvgMonthlyExpense(monthlyExpense, dayOfMonth);

  // 5 sub-scores
  const savingsRateScore = scoreSavingsRate(savingsRate, monthlyIncome);
  const budgetAdherenceScore = scoreBudgetAdherence(categoriesTotal, categoriesOverBudget);
  const billsOnTimeScore = scoreBillsOnTime(billsDueByNow, billsPaidOfDue);
  const emergencyFundScore = scoreEmergencyFund(emergencyBalance, avgMonthlyExpenseEstimate);
  const safeToSpendScore = scoreSafeToSpend(safeToSpend);

  // Weighted sum → round → clamp
  const weighted =
    savingsRateScore * HEALTH_WEIGHTS.savingsRate +
    budgetAdherenceScore * HEALTH_WEIGHTS.budgetAdherence +
    billsOnTimeScore * HEALTH_WEIGHTS.billsOnTime +
    emergencyFundScore * HEALTH_WEIGHTS.emergencyFund +
    safeToSpendScore * HEALTH_WEIGHTS.safeToSpend;

  const total = clamp(Math.round(weighted), 0, 100);

  return {
    total,
    savingsRateScore: Math.round(savingsRateScore),
    budgetAdherenceScore: Math.round(budgetAdherenceScore),
    billsOnTimeScore: Math.round(billsOnTimeScore),
    emergencyFundScore: Math.round(emergencyFundScore),
    safeToSpendScore: Math.round(safeToSpendScore),
    savingsRate,
    avgMonthlyExpenseEstimate,
  };
}

/** Phân loại tier để fallback narrative chọn template phù hợp. */
export type HealthTier = 'poor' | 'fair' | 'good';

export function getHealthTier(total: number): HealthTier {
  if (total >= 70) return 'good';
  if (total >= 40) return 'fair';
  return 'poor';
}
