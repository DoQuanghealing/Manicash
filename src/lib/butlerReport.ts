/* ═══ Butler Monthly Report Generator ═══
 * Template-based — không gọi AI, chạy local + deterministic.
 * Tone: butler persona ("tôi" / "cậu chủ"), reuse style từ groqClient fallback.
 * Tier-based encouragement: getHealthTier từ cfoHealthScore.
 */

import { getHealthTier, type HealthTier } from './cfoHealthScore';
import type { ButlerReport } from '@/types/budget';

interface ReportInput {
  month: string;            // 'YYYY-MM' tháng cũ vừa kết thúc
  monthlyIncome: number;
  monthlyExpense: number;
  transactionCount: number;
  billsDueByNow: number;    // Tổng bill có due trong tháng
  billsPaidOfDue: number;
  categoriesTotal: number;
  categoriesOnTrack: number;
  emergencyBalance: number;
  safeToSpend: number;
  xpEarned: number;
  dayOfMonth: number;       // Ngày trong tháng — dùng cho healthScore (28+ ≈ end-of-month)
}

/** Format VND ngắn gọn cho narrative. */
function formatVND(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}tr`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${abs}đ`;
}

/** Tier-based summary với metrics — 2-3 câu, butler persona. */
function buildSummary(tier: HealthTier, input: ReportInput): string {
  const surplus = Math.max(0, input.monthlyIncome - input.monthlyExpense);
  const billsRate = input.billsDueByNow > 0
    ? Math.round((input.billsPaidOfDue / input.billsDueByNow) * 100)
    : 100;
  const budgetRate = input.categoriesTotal > 0
    ? Math.round((input.categoriesOnTrack / input.categoriesTotal) * 100)
    : 0;

  if (tier === 'good') {
    return (
      `Cậu chủ ơi, tháng vừa rồi đỉnh quá! 🏆 ${input.transactionCount} giao dịch ghi đầy đủ, ` +
      `${input.billsPaidOfDue}/${input.billsDueByNow} bill trả đúng hạn, ` +
      `${input.categoriesOnTrack}/${input.categoriesTotal} danh mục giữ trong ngưỡng. ` +
      (surplus > 0 ? `Dư ra ${formatVND(surplus)} — tôi đề nghị chuyển vào quỹ đầu tư ngay! 💎` : 'Giữ phong độ này tháng tới nhé! ✨')
    );
  }

  if (tier === 'fair') {
    return (
      `Tháng vừa rồi cậu chủ ổn — không xuất sắc nhưng không tệ. ${input.transactionCount} giao dịch, ` +
      `${billsRate}% bill đúng hạn, ${budgetRate}% ngân sách giữ vững. ` +
      `Tôi tin tháng tới chỉ cần chú ý hơn 1 chút là lên hạng TỐT thôi! 💪`
    );
  }

  // tier === 'poor'
  return (
    `Cậu chủ ơi, tháng vừa rồi hơi căng. ${input.transactionCount} giao dịch, ` +
    `${billsRate}% bill đúng hạn, ${budgetRate}% danh mục giữ ngưỡng. ` +
    `Không sao, tôi đồng hành tháng tới. Trước mắt: trả bill đúng hạn + cắt 3 mục chi lớn nhất 10%. 🤝`
  );
}

/** Generate butler report cuối tháng. */
export function generateButlerReport(input: ReportInput): ButlerReport {
  // Tính healthScore qua HealthSnapshot tương đương — nhưng để giữ độc lập với
  // computeHealthScore (tránh circular import + dữ liệu đầy đủ cuối tháng),
  // ở đây dùng tỷ lệ tổng hợp đơn giản để pick tier.
  const savingsRate = input.monthlyIncome > 0
    ? (input.monthlyIncome - input.monthlyExpense) / input.monthlyIncome
    : 0;
  const billsScore = input.billsDueByNow > 0
    ? (input.billsPaidOfDue / input.billsDueByNow) * 100
    : 100;
  const budgetScore = input.categoriesTotal > 0
    ? (input.categoriesOnTrack / input.categoriesTotal) * 100
    : 50;
  // Approximate combined score 0-100, cùng range với cfoHealthScore output.
  const approxScore = Math.round(
    Math.max(0, Math.min(100, savingsRate * 100)) * 0.4 +
    billsScore * 0.3 +
    budgetScore * 0.3
  );
  const tier = getHealthTier(approxScore);

  return {
    summary: buildSummary(tier, input),
    xpEarned: Math.max(0, input.xpEarned),
    tier,
    generatedAt: new Date().toISOString(),
    metrics: {
      transactionCount: input.transactionCount,
      billsPaidOnTime: input.billsPaidOfDue,
      billsTotal: input.billsDueByNow,
      categoriesOnTrack: input.categoriesOnTrack,
      categoriesTotal: input.categoriesTotal,
      surplus: Math.max(0, input.monthlyIncome - input.monthlyExpense),
    },
  };
}
