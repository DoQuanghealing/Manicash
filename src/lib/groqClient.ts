/* ═══ Groq Client — Llama 70B (Narrative Only) ═══
 * AI chỉ sinh summary + suggestions. HealthScore tính deterministic ở cfoHealthScore.ts.
 * Butler persona: xưng "tôi", gọi user "cậu chủ", tiếng Việt, 1-2 emoji/câu.
 */

import type { HealthBreakdown } from './cfoHealthScore';
import { getHealthTier, type HealthTier } from './cfoHealthScore';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Detail của 1 danh mục cần AI chú ý — đính kèm tên + số tiền thực tế để AI
 * gợi ý cụ thể theo danh mục (vd "giảm 30% Cà phê" thay vì gợi ý chung).
 */
export interface WatchedCategoryDetail {
  name: string;
  spent: number;
  limit: number;       // 0 nếu user chưa đặt ngưỡng
  overBy: number;      // 0 nếu chưa vượt
  percent: number;     // 0..∞ — spent/limit*100, 0 nếu limit=0
  isFlagged: boolean;  // User chủ động flag ⚑
  isOver: boolean;     // System detect vượt ngưỡng
  /** Tiết kiệm tháng nếu cắt 20% — preview cho AI. */
  savingsAt20pct: number;
}

/**
 * 1 giao dịch user đã flag ⚑ riêng (per-transaction level — granular hơn category).
 * AI sẽ dùng note + categoryName để gợi ý CỤ THỂ vào hành vi user (vd "ăn sushi
 * cuối tuần" thay vì cả "Ăn uống").
 */
export interface FlaggedTransactionDetail {
  /** Tên category — "Ăn uống", "Mua sắm khác", ... */
  categoryName: string;
  /** Note user nhập khi tạo txn — vd "Sushi cuối tuần". Có thể empty. */
  note: string;
  /** Số tiền (VND). */
  amount: number;
  /** Số ngày trước (0 = hôm nay). Giúp AI hiểu mức độ recent. */
  daysAgo: number;
}

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
  /**
   * Danh mục user đã flag ⚑ HOẶC system phát hiện vượt ngưỡng.
   * Cap ≤5 để giữ prompt gọn. Flagged ưu tiên trước over-budget.
   * Có thể empty array nếu không có gì cần chú ý.
   */
  watchedCategories: WatchedCategoryDetail[];
  /**
   * Top giao dịch user đã flag ⚑ riêng — sort desc by amount, cap ≤5.
   * Empty nếu user chưa flag txn nào.
   */
  topFlaggedTransactions: FlaggedTransactionDetail[];
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

/** Format dòng watched-category cho AI. */
function formatWatchedLine(w: WatchedCategoryDetail): string {
  const tags: string[] = [];
  if (w.isFlagged) tags.push('⚑ user-flag');
  if (w.isOver) tags.push(`vượt ${formatVND(w.overBy)}`);
  const tagStr = tags.length ? ` [${tags.join(', ')}]` : '';
  const limitStr = w.limit > 0 ? `/${formatVND(w.limit)}` : ' (chưa đặt ngưỡng)';
  return `  • ${w.name}: ${formatVND(w.spent)}${limitStr}${tagStr} → cắt 20% = tiết kiệm ${formatVND(w.savingsAt20pct)}/tháng`;
}

/** Format dòng flagged-transaction cho AI. */
function formatFlaggedTxnLine(t: FlaggedTransactionDetail): string {
  const note = t.note?.trim() || '(không note)';
  const when = t.daysAgo === 0 ? 'hôm nay' : t.daysAgo === 1 ? 'hôm qua' : `${t.daysAgo} ngày trước`;
  return `  • ${t.categoryName}: "${note}" ${formatVND(t.amount)} (${when})`;
}

/** Build user prompt từ snapshot + breakdown. */
function buildUserPrompt(payload: CFOPayload, breakdown: HealthBreakdown): string {
  const tier = getHealthTier(breakdown.total);
  const tierLabel = tier === 'good' ? 'TỐT' : tier === 'fair' ? 'TRUNG BÌNH' : 'YẾU';

  const watchedBlock = payload.watchedCategories.length > 0
    ? `\n\nDanh mục cậu chủ đang theo dõi / vượt ngưỡng:\n${payload.watchedCategories.map(formatWatchedLine).join('\n')}`
    : '';

  const flaggedTxnBlock = payload.topFlaggedTransactions.length > 0
    ? `\n\nGiao dịch cụ thể cậu chủ đã gắn cảnh báo ⚑ (CHI TIẾT TUYỆT VỜI để gợi ý cụ thể):\n${payload.topFlaggedTransactions.map(formatFlaggedTxnLine).join('\n')}`
    : '';

  const mentionRule = payload.topFlaggedTransactions.length > 0
    ? `\n\nQUAN TRỌNG: ít nhất 1 suggestion PHẢI nhắc đến 1 giao dịch cụ thể trong danh sách flagged ở trên (dùng đúng note + amount). Vd: "Khoản 'Sushi cuối tuần' 850k tuần trước — tuần này thử thay bằng cơm nhà 1-2 lần, tiết kiệm ~500k."`
    : payload.watchedCategories.length > 0
      ? `\n\nQUAN TRỌNG: ít nhất 1 suggestion PHẢI nhắc tên cụ thể của danh mục trong danh sách watched ở trên (ưu tiên dòng có "⚑ user-flag"), kèm con số tiết kiệm thực tế nếu cắt. Vd: "Giảm 30% chi Cà phê → tiết kiệm 195k/tháng".`
      : '';

  return `Data tài chính tháng này của cậu chủ:
- Thu nhập: ${formatVND(payload.monthlyIncome)}
- Chi tiêu: ${formatVND(payload.monthlyExpense)}
- Tỷ lệ tiết kiệm: ${(payload.savingsRate * 100).toFixed(1)}%
- Số dư an toàn: ${formatVND(payload.safeToSpend)}
- Quỹ khẩn cấp: ${formatVND(payload.emergencyBalance)}
- Danh mục vượt ngân sách: ${payload.categoriesOverBudget}/${payload.categoriesTotal}
- Bill đã trả đúng hạn: ${payload.billsPaidOfDue}/${payload.billsDueByNow}
- Số giao dịch: ${payload.transactionCount}${watchedBlock}${flaggedTxnBlock}${mentionRule}

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

/**
 * Sinh 1 suggestion cụ thể từ watched category đầu tiên — ưu tiên flagged,
 * fallback over-budget. Trả null nếu không có gì để nhắc.
 */
function watchedCategorySuggestion(
  watched: WatchedCategoryDetail[],
): string | null {
  if (watched.length === 0) return null;
  // Đã sort flagged-first ở useCFOSnapshot, lấy phần tử đầu tiên.
  const top = watched[0];
  if (top.isOver && top.overBy > 0) {
    return `Mục "${top.name}" đang vượt ngưỡng ${formatVND(top.overBy)} — cắt 20% tháng tới sẽ tiết kiệm ${formatVND(top.savingsAt20pct)}.`;
  }
  if (top.spent > 0) {
    return `Mục "${top.name}" cậu chủ đang theo dõi — giảm 20% sẽ tiết kiệm khoảng ${formatVND(top.savingsAt20pct)}/tháng.`;
  }
  return null;
}

/**
 * Sinh 1 suggestion từ flagged-transaction lớn nhất — granular hơn category.
 * Vd "Khoản 'Sushi cuối tuần' 850k cách đây 5 ngày — tuần này thử cơm nhà nhé."
 */
function flaggedTransactionSuggestion(
  txns: FlaggedTransactionDetail[],
): string | null {
  if (txns.length === 0) return null;
  // Đã sort desc by amount ở useCFOSnapshot.
  const top = txns[0];
  const note = top.note?.trim() || top.categoryName;
  const when = top.daysAgo === 0 ? 'hôm nay' : top.daysAgo === 1 ? 'hôm qua' : `${top.daysAgo} ngày trước`;
  const savings = Math.round(top.amount * 0.5); // giả định giảm 50% khoản này nếu skip 1 lần
  return `Khoản "${note}" ${formatVND(top.amount)} (${when}) — tuần này thử giảm 1 lần, tiết kiệm ~${formatVND(savings)}.`;
}

/** Fallback narrative theo tier — dùng khi thiếu GROQ_API_KEY hoặc Groq fail. */
export function getFallbackNarrative(
  breakdown: HealthBreakdown,
  watched: WatchedCategoryDetail[] = [],
  flaggedTxns: FlaggedTransactionDetail[] = [],
): { summary: string; suggestions: string[] } {
  const tier: HealthTier = getHealthTier(breakdown.total);
  const txnSugg = flaggedTransactionSuggestion(flaggedTxns);
  const watchedSugg = watchedCategorySuggestion(watched);

  /** Compose suggestions: txn-level đứng đầu (cụ thể nhất), category-level thứ 2,
   *  generic suggestions cuối. Dedupe khi cả 2 nói về cùng category. */
  const prepend: string[] = [];
  if (txnSugg) prepend.push(txnSugg);
  if (watchedSugg && (!txnSugg || flaggedTxns[0]?.categoryName !== watched[0]?.name)) {
    prepend.push(watchedSugg);
  }

  if (tier === 'good') {
    const generic = [
      'Cân nhắc tăng tỷ lệ tiết kiệm thêm 5% tháng tới để về đích mục tiêu sớm hơn.',
      'Phân bổ một phần quỹ khẩn cấp dư sang kênh đầu tư có lãi để tiền không "nằm yên".',
      'Xem lại các mục tiêu dài hạn (nhà/xe/học) — tháng này đủ khỏe để tăng mức góp hàng tháng 10-15%.',
    ];
    return {
      summary: `Tuyệt vời cậu chủ! Sức khỏe tài chính tháng này đạt ${breakdown.total}/100 — mức TỐT. 🏆 Tôi tin cậu chủ đang đi rất đúng hướng, giờ là lúc nghĩ xa hơn về đầu tư và mục tiêu dài hạn.`,
      suggestions: [...prepend, ...generic].slice(0, 3),
    };
  }

  if (tier === 'fair') {
    const weakest = findWeakestSubScore(breakdown);
    return {
      summary: `Tháng này cậu chủ đạt ${breakdown.total}/100 — mức TRUNG BÌNH. Tôi ghi nhận nỗ lực của cậu chủ, chỉ cần xử lý phần "${weakest.label}" là bước lên hạng TỐT ngay! 💪`,
      suggestions: [...prepend, ...weakest.suggestions].slice(0, 3),
    };
  }

  // tier === 'poor'
  const weakest = findWeakestSubScore(breakdown);
  return {
    summary: `Cậu chủ ơi, tháng này điểm sức khỏe là ${breakdown.total}/100 — hơi căng. Không sao, tôi sẽ đồng hành cùng cậu chủ. 🤝 Ưu tiên trước mắt là xử lý phần "${weakest.label}".`,
    suggestions: [...prepend, ...weakest.suggestions].slice(0, 3),
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
