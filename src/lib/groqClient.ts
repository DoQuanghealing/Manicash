/* ═══ Groq Client — Llama 70B (Narrative Only) ═══
 * AI chỉ sinh summary + suggestions. HealthScore tính deterministic ở cfoHealthScore.ts.
 * Butler persona: xưng "tôi", gọi user "cậu chủ", tiếng Việt, 1-2 emoji/câu.
 */

import type { HealthBreakdown } from './cfoHealthScore';
import { getHealthTier, type HealthTier } from './cfoHealthScore';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Snapshot data thô gửi cho AI (không kèm healthScore — AI không quyết score). */
export interface CFOPayload {
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;         // 0-1 (có thể âm)
  safeToSpend: number;
  emergencyBalance: number;
  categoriesTotal: number;
  categoriesOverBudget: number;
  billsDueByNow: number;
  billsPaidOfDue: number;
  transactionCount: number;
}

/** Response cuối cùng từ /api/cfo (healthScore inject từ backend, không phải AI). */
export interface CFOInsight {
  summary: string;
  suggestions: string[];
  healthScore: number; // 0-100 (từ computeHealthScore)
  // 'ai' = Groq narrative thật; 'quick' = fallback (thiếu key hoặc Groq fail).
  // Chi tiết "no-key" vs "error" chỉ ở server log — client không cần biết.
  source: 'ai' | 'quick';
}

const SYSTEM_PROMPT = `Bạn là AI CFO của ManiCash — một butler tài chính cá nhân cho người Việt.

QUY TẮC BẮT BUỘC:
1. Luôn trả lời bằng tiếng Việt.
2. Xưng "tôi", gọi người dùng là "cậu chủ".
3. Tone: trang trọng nhưng vui vẻ, khích lệ, không phán xét.
4. Dùng 1-2 emoji cho cả câu trả lời (không lạm dụng).
5. Điều chỉnh cảm xúc theo tier:
   - POOR (0-39): đồng cảm + hành động cụ thể, KHÔNG chê bai.
   - FAIR (40-69): ghi nhận tiến bộ + gợi ý bước tiếp theo.
   - GOOD (70-100): chúc mừng + thách thức level kế.

FORMAT BẮT BUỘC (JSON):
{
  "summary": "2-3 câu nhận xét ngắn về tình hình tháng này",
  "suggestions": ["Gợi ý 1 (1 câu, action-able)", "Gợi ý 2 (1 câu, action-able)"]
}

CẢNH BÁO:
- TUYỆT ĐỐI KHÔNG output field "healthScore". Nếu có, sẽ bị ignored.
- Mỗi suggestion phải là hành động CỤ THỂ cậu chủ làm được ngay tuần này (vd: "Giảm 30% chi cà phê" thay vì "Tiết kiệm nhiều hơn").
- summary tối đa 3 câu, mỗi suggestion tối đa 1 câu.`;

/** Format tiền VND gọn gàng cho prompt. */
function formatVND(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}tr`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${abs}đ`;
}

/** Build user prompt từ snapshot + breakdown. */
function buildUserPrompt(payload: CFOPayload, breakdown: HealthBreakdown): string {
  const tier = getHealthTier(breakdown.total);
  const tierLabel = tier === 'good' ? 'TỐT' : tier === 'fair' ? 'TRUNG BÌNH' : 'YẾU';

  return `Data tài chính tháng này của cậu chủ:
- Thu nhập: ${formatVND(payload.monthlyIncome)}
- Chi tiêu: ${formatVND(payload.monthlyExpense)}
- Tỷ lệ tiết kiệm: ${(payload.savingsRate * 100).toFixed(1)}%
- Số dư an toàn: ${formatVND(payload.safeToSpend)}
- Quỹ khẩn cấp: ${formatVND(payload.emergencyBalance)}
- Danh mục vượt ngân sách: ${payload.categoriesOverBudget}/${payload.categoriesTotal}
- Bill đã trả đúng hạn: ${payload.billsPaidOfDue}/${payload.billsDueByNow}
- Số giao dịch: ${payload.transactionCount}

ĐIỂM SỨC KHỎE (đã tính sẵn, KHÔNG thay đổi): ${breakdown.total}/100 — ${tierLabel}
Breakdown 5 thành phần:
- Tỷ lệ tiết kiệm: ${breakdown.savingsRateScore}/100
- Tuân thủ ngân sách: ${breakdown.budgetAdherenceScore}/100
- Trả bill đúng hạn: ${breakdown.billsOnTimeScore}/100
- Quỹ khẩn cấp: ${breakdown.emergencyFundScore}/100
- Số dư an toàn: ${breakdown.safeToSpendScore}/100

Nhiệm vụ: viết summary (2-3 câu) + 2 suggestions action-able, tập trung vào sub-score THẤP NHẤT.
NHỚ: KHÔNG output healthScore.`;
}

/**
 * Gọi Groq để sinh narrative. Throw nếu API fail → caller fallback.
 */
export async function getCFONarrative(
  apiKey: string,
  payload: CFOPayload,
  breakdown: HealthBreakdown,
): Promise<{ summary: string; suggestions: string[] }> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(payload, breakdown) },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    // Ép narrative — bỏ hoàn toàn field healthScore nếu AI vô tình output
    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Tôi chưa phân tích xong tháng này, cậu chủ quay lại sau nhé! 🙏',
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 3)
        : [],
    };
  } catch {
    return {
      summary: typeof content === 'string' ? content.slice(0, 300) : 'Không phân tích được dữ liệu.',
      suggestions: [],
    };
  }
}

/** Fallback narrative theo tier — dùng khi thiếu GROQ_API_KEY hoặc Groq fail. */
export function getFallbackNarrative(
  breakdown: HealthBreakdown,
): { summary: string; suggestions: string[] } {
  const tier: HealthTier = getHealthTier(breakdown.total);

  if (tier === 'good') {
    return {
      summary: `Tuyệt vời cậu chủ! Sức khỏe tài chính tháng này đạt ${breakdown.total}/100 — mức TỐT. 🏆 Tôi tin cậu chủ đang đi rất đúng hướng, giờ là lúc nghĩ xa hơn về đầu tư và mục tiêu dài hạn.`,
      suggestions: [
        'Cân nhắc tăng tỷ lệ tiết kiệm thêm 5% tháng tới để về đích mục tiêu sớm hơn.',
        'Phân bổ một phần quỹ khẩn cấp dư sang kênh đầu tư có lãi để tiền không "nằm yên".',
        'Xem lại các mục tiêu dài hạn (nhà/xe/học) — tháng này đủ khỏe để tăng mức góp hàng tháng 10-15%.',
      ],
    };
  }

  if (tier === 'fair') {
    const weakest = findWeakestSubScore(breakdown);
    return {
      summary: `Tháng này cậu chủ đạt ${breakdown.total}/100 — mức TRUNG BÌNH. Tôi ghi nhận nỗ lực của cậu chủ, chỉ cần xử lý phần "${weakest.label}" là bước lên hạng TỐT ngay! 💪`,
      suggestions: weakest.suggestions,
    };
  }

  // tier === 'poor'
  const weakest = findWeakestSubScore(breakdown);
  return {
    summary: `Cậu chủ ơi, tháng này điểm sức khỏe là ${breakdown.total}/100 — hơi căng. Không sao, tôi sẽ đồng hành cùng cậu chủ. 🤝 Ưu tiên trước mắt là xử lý phần "${weakest.label}".`,
    suggestions: weakest.suggestions,
  };
}

/** Tìm sub-score thấp nhất để narrative tập trung vào đó. */
function findWeakestSubScore(
  b: HealthBreakdown,
): { label: string; suggestions: string[] } {
  const items: { label: string; score: number; suggestions: string[] }[] = [
    {
      label: 'tỷ lệ tiết kiệm',
      score: b.savingsRateScore,
      suggestions: [
        'Đặt lệnh chuyển 20% lương tự động sang quỹ tiết kiệm ngay khi nhận lương.',
        'Rà soát 3 mục chi lớn nhất tháng này và cắt giảm 10% mỗi mục.',
      ],
    },
    {
      label: 'tuân thủ ngân sách',
      score: b.budgetAdherenceScore,
      suggestions: [
        'Mở tab Sổ sách, xem danh mục nào vượt ngưỡng và điều chỉnh ngưỡng cho sát thực tế hơn.',
        'Bật cảnh báo 80% ngân sách để chặn chi vượt trước khi quá muộn.',
      ],
    },
    {
      label: 'trả bill đúng hạn',
      score: b.billsOnTimeScore,
      suggestions: [
        'Vào tab Tổng quan, trả ngay các bill đã quá hạn để tránh phí phạt.',
        'Đặt nhắc lịch trả bill trước ngày đến hạn 3 ngày cho từng bill cố định.',
      ],
    },
    {
      label: 'quỹ khẩn cấp',
      score: b.emergencyFundScore,
      suggestions: [
        'Bỏ 500k/tháng vào quỹ khẩn cấp cho đến khi đạt 3 tháng chi tiêu.',
        'Chuyển một phần tiền nhàn rỗi ở ví chính sang ví Khẩn cấp ngay hôm nay.',
      ],
    },
    {
      label: 'số dư an toàn',
      score: b.safeToSpendScore,
      suggestions: [
        'Số dư an toàn đang âm — tạm ngưng mọi chi không thiết yếu trong 7 ngày tới.',
        'Xem lại tổng ngưỡng chi tiêu + bill cố định, có thể đang đặt quá cao so với thu nhập.',
      ],
    },
  ];
  items.sort((a, b) => a.score - b.score);
  return { label: items[0].label, suggestions: items[0].suggestions };
}
