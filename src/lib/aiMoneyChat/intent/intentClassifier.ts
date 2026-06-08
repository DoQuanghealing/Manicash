/* ═══ AI Money Chat — Intent Classifier (Phase 1) ═══
 * Tier 1 (regex mustMatch) + Tier 2 (keyword scoring) — 0 token, chạy local.
 *
 * Công thức chấm điểm (chốt với Architect):
 *   keywordRatio  = hits / keywords.length
 *   mustMatchBoost = pattern.mustMatch ? 0.4 : 0
 *   score         = min(1, (keywordRatio + mustMatchBoost) * weight)
 *
 * Ánh xạ confidence:
 *   score >= 0.7 -> 'high' ; >= 0.4 -> 'medium' ; còn lại -> 'low'
 *
 * Classifier chỉ chọn intent (argmax theo score). Slot extraction nằm ở router.
 */

import {
  INTENT_PATTERNS,
  STOP_WORDS,
  getPatternPipeline,
  type IntentPattern,
} from './intentPatterns';
import type { ChatIntent, ChatIntentType, IntentConfidence } from './types';

/**
 * Chuẩn hóa câu chat về dạng so khớp:
 *  - lowercase
 *  - fold dấu tiếng Việt (NFD strip combining marks) + đ -> d
 *  - bỏ dấu câu thừa (. , ! ? ; : ( ) [ ] { } " ')
 *  - thu gọn whitespace + trim
 *
 * Fold dấu để khớp cả input có dấu lẫn không dấu — đồng bộ với parser.ts.
 */
export function normalize(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh + dấu mũ
    .replace(/đ/g, 'd') // đ -> d (NFD không tách đ)
    .replace(/[.,!?;:()[\]{}"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tách token theo whitespace và LOẠI stop-word.
 * Dùng để dựng chuỗi "cleaned" cho việc chấm điểm (giảm nhiễu hư từ).
 */
export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

/** Ánh xạ score thô -> nhãn confidence. */
function scoreToConfidence(score: number): IntentConfidence {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/** Chấm điểm một pattern trên chuỗi đã làm sạch. Trả null nếu pattern bị loại. */
function scorePattern(
  pattern: IntentPattern,
  cleaned: string,
): { score: number; hits: string[] } | null {
  // Tier 1 — mustMatch: tất cả regex phải khớp, nếu không thì loại pattern.
  if (pattern.mustMatch && pattern.mustMatch.length > 0) {
    const allMatch = pattern.mustMatch.every((re) => re.test(cleaned));
    if (!allMatch) return null;
  }

  // Tier 2 — keyword scoring.
  const hits = pattern.keywords.filter((kw) => cleaned.includes(kw));

  // Không có mustMatch và cũng không hit keyword nào -> không liên quan.
  if (hits.length === 0 && (!pattern.mustMatch || pattern.mustMatch.length === 0)) {
    return null;
  }

  const keywordRatio = pattern.keywords.length > 0 ? hits.length / pattern.keywords.length : 0;
  const mustMatchBoost = pattern.mustMatch && pattern.mustMatch.length > 0 ? 0.4 : 0;
  const score = Math.min(1, (keywordRatio + mustMatchBoost) * pattern.weight);

  return { score, hits };
}

/**
 * Phân loại ý định từ câu chat thô.
 * Luôn trả về ChatIntent (UNKNOWN nếu không pattern nào khớp), không bao giờ throw.
 */
export function classifyIntent(rawText: string): ChatIntent {
  const safeRaw = typeof rawText === 'string' ? rawText : '';
  const normalized = normalize(safeRaw);
  const cleaned = tokenize(normalized).join(' ');

  let best: {
    type: ChatIntentType;
    score: number;
    reason: string;
  } = {
    type: 'UNKNOWN',
    score: 0,
    reason: 'no pattern matched',
  };

  // Câu rỗng -> UNKNOWN ngay.
  if (cleaned.length > 0) {
    for (const pattern of INTENT_PATTERNS) {
      const result = scorePattern(pattern, cleaned);
      if (result && result.score > best.score) {
        best = {
          type: pattern.type,
          score: result.score,
          reason: `hits=[${result.hits.join(', ')}] mustMatch=${
            pattern.mustMatch ? 'pass' : 'none'
          }`,
        };
      }
    }
  }

  return {
    type: best.type,
    score: Number(best.score.toFixed(3)),
    confidence: scoreToConfidence(best.score),
    pipeline: getPatternPipeline(best.type),
    slots: {},
    normalizedText: normalized,
    rawText: safeRaw,
    reason: best.reason,
  };
}
