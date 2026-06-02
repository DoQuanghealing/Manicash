/* ═══ Phase 13 — AI CFO Narration ═══
 * Local-first narration that reads like a personal CFO note. The local template
 * (buildLocalCfoNarration) is the Free-tier baseline AND the fallback whenever AI
 * is disabled, has no key, hits quota, or fails. Pro can request an AI-written
 * narration from aggregated summary data only — raw transactions never leave the
 * device, which keeps both privacy and token cost low.
 */

export type CfoNarrationTier = 'good' | 'fair' | 'poor';

/** Aggregated summary sent to the AI — never raw transactions. */
export interface CfoNarrationInput {
  monthLabel: string;
  tier: CfoNarrationTier;
  healthScore: number;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  topCategory: { name: string; amount: number } | null;
  topGoal: { name: string; progress: number; remaining: number } | null;
  budgetOnTrack: number;
  budgetTotal: number;
}

export type CfoNarrationSource =
  | 'ai'
  | 'local'
  | 'disabled'
  | 'no-key'
  | 'unauthorized'
  | 'quota-exceeded'
  | 'error';

export interface CfoNarrationResult {
  text: string;
  source: CfoNarrationSource;
  reason: string;
  /** True when text came from cache (client localStorage or server) — no credit charged. */
  cached: boolean;
}

const MAX_NARRATION_LENGTH = 900;

function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

/** Deterministic Vietnamese narration in the Lord Diamond butler voice. */
export function buildLocalCfoNarration(input: CfoNarrationInput): string {
  const opening = {
    good: `Cậu chủ, ${input.monthLabel} cậu quản lý tài chính rất vững — sức khỏe ${input.healthScore}/100.`,
    fair: `Cậu chủ, ${input.monthLabel} ở mức ổn nhưng còn dư địa cải thiện — sức khỏe ${input.healthScore}/100.`,
    poor: `Cậu chủ, ${input.monthLabel} chi tiêu đang vượt kế hoạch — sức khỏe ${input.healthScore}/100. Ta cần siết lại một chút.`,
  }[input.tier];

  const cashflow =
    input.savings >= 0
      ? `Cậu thu ${formatVnd(input.income)}, chi ${formatVnd(input.expense)}, để dành được ${formatVnd(input.savings)} (${input.savingsRate}%).`
      : `Cậu thu ${formatVnd(input.income)} nhưng chi tới ${formatVnd(input.expense)} — âm ${formatVnd(Math.abs(input.savings))} tháng này.`;

  const category = input.topCategory
    ? ` Khoản tốn nhất là "${input.topCategory.name}" với ${formatVnd(input.topCategory.amount)} — đáng để soi kỹ.`
    : '';

  const goal = input.topGoal
    ? ` Mục tiêu "${input.topGoal.name}" đã đạt ${input.topGoal.progress}%, còn ${formatVnd(input.topGoal.remaining)} nữa là cán đích.`
    : '';

  const closing = {
    good: ' Giữ phong độ này nhé, ta tin ở cậu. 💎',
    fair: ` Nếu nâng tỷ lệ tiết kiệm lên 20%, cậu sẽ thấy khác biệt rõ ngay tháng sau. 💪`,
    poor: ' Tháng tới ta cùng cắt bớt một khoản và bám ngân sách chặt hơn nhé. 🤝',
  }[input.tier];

  return `${opening} ${cashflow}${category}${goal}${closing}`.trim();
}

const SYSTEM_PROMPT = `Bạn là Lord Diamond — AI CFO butler của ManiCash cho người Việt.
QUY TẮC:
- Xưng "ta", gọi người dùng "cậu chủ".
- Viết 1 đoạn văn 3-5 câu, ấm áp, thông minh, như ghi chú của một CFO cá nhân.
- Dựa CHÍNH XÁC vào số liệu được cung cấp, không bịa số mới.
- Tối đa 1-2 emoji. Không markdown, không bullet, không tiêu đề.
- Tiếng Việt có dấu đầy đủ.`;

export function buildCfoNarrationPrompt(input: CfoNarrationInput): string {
  const lines = [
    `Tháng: ${input.monthLabel}`,
    `Sức khỏe tài chính: ${input.healthScore}/100 (${input.tier})`,
    `Thu nhập: ${input.income}`,
    `Chi tiêu: ${input.expense}`,
    `Tiết kiệm: ${input.savings} (${input.savingsRate}%)`,
    `Ngân sách giữ vững: ${input.budgetOnTrack}/${input.budgetTotal} danh mục`,
  ];
  if (input.topCategory) {
    lines.push(`Danh mục tốn nhất: ${input.topCategory.name} = ${input.topCategory.amount}`);
  }
  if (input.topGoal) {
    lines.push(`Mục tiêu gần nhất: ${input.topGoal.name}, đạt ${input.topGoal.progress}%, còn ${input.topGoal.remaining}`);
  }
  return `Viết nhận xét CFO cá nhân hóa từ số liệu sau:\n\n${lines.join('\n')}\n\nTrả về CHỈ đoạn văn, không kèm gì khác.`;
}

export { SYSTEM_PROMPT as CFO_NARRATION_SYSTEM_PROMPT };

/**
 * Deterministic FNV-1a hash → hex. Pure, dependency-free, stable across runs so it
 * can be the cache fingerprint for AI narration. Same aggregated input → same key.
 */
export function computeNarrationFingerprint(input: CfoNarrationInput): string {
  const canonical = [
    input.monthLabel,
    input.tier,
    input.healthScore,
    input.income,
    input.expense,
    input.savings,
    input.savingsRate,
    input.topCategory ? `${input.topCategory.name}:${input.topCategory.amount}` : '-',
    input.topGoal ? `${input.topGoal.name}:${input.topGoal.progress}:${input.topGoal.remaining}` : '-',
    input.budgetOnTrack,
    input.budgetTotal,
  ].join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Reject obviously broken AI output (empty, too long, JSON dump, markdown). */
export function validateNarration(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 20) return null;
  if (trimmed.length > MAX_NARRATION_LENGTH) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null;
  if (trimmed.includes('```')) return null;
  return trimmed;
}
