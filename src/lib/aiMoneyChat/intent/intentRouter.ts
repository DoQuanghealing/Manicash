/* ═══ AI Money Chat — Intent Router (Phase 1) ═══
 * Entry point của hệ thống chat. Dòng chảy:
 *   routeIntent(text) -> classifyIntent() -> slot extraction theo intent.
 *
 * Phase 1 chỉ wire slot cho LOG_TRANSACTION (proxy ngược parseMoneyText hiện có)
 * để KHÔNG làm gãy tính năng nhập liệu cũ. Các intent truy vấn/LLM sẽ được
 * bơm slot ở Phase 2-4.
 */

import { parseMoneyText } from '../parser';
import { classifyIntent } from './intentClassifier';
import type { ChatIntent, IntentConfidence, LogTransactionSlots } from './types';

/** Thứ hạng confidence để so sánh classifier vs parser. */
const CONFIDENCE_RANK: Record<IntentConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Từ khóa "truy vấn tiếp nối" (đã fold dấu ASCII, đồng bộ với classifier).
 * Loại 1 từ (so khớp NGUYÊN token để tránh dính nhầm: "do" không match "doan",
 * "no" không match "nong"); loại nhiều từ (so khớp cụm).
 */
const FOLLOW_UP_SINGLE_TOKENS = new Set(['do', 'no']);
const FOLLOW_UP_PHRASES = ['tai sao', 'vi sao', 'sao lai', 'bang cach nao', 'lam sao', 'cai nay'];

/** True nếu câu (đã normalize) mang tính hỏi tiếp nối. */
export function detectFollowUp(normalizedText: string): boolean {
  if (!normalizedText) return false;
  if (hasStrongFollowUpPhrase(normalizedText)) return true;
  const tokens = normalizedText.split(' ');
  return tokens.some((t) => FOLLOW_UP_SINGLE_TOKENS.has(t));
}

/**
 * Tín hiệu tiếp nối MẠNH: cụm nghi vấn WHY/HOW/deixis ("tai sao", "bang cach
 * nao", "cai nay"...). Khác token đơn ("do", "no") vốn dễ nhiễu.
 */
function hasStrongFollowUpPhrase(normalizedText: string): boolean {
  return FOLLOW_UP_PHRASES.some((p) => normalizedText.includes(p));
}

/** Lấy confidence cao hơn giữa hai nguồn. */
function maxConfidence(a: IntentConfidence, b: IntentConfidence): IntentConfidence {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}

/**
 * Trích xuất slot cho LOG_TRANSACTION bằng parser local đã có.
 * Bọc try/catch: nếu parser lỗi vẫn trả intent (slots rỗng) thay vì sập route.
 */
function extractLogTransactionSlots(intent: ChatIntent): void {
  try {
    const parsed = parseMoneyText(intent.rawText);
    const slots: LogTransactionSlots = {
      type: parsed.type,
      amount: parsed.amount?.value,
      categoryId: parsed.category?.categoryId,
      parserConfidence: parsed.confidence,
    };
    // LogTransactionSlots không có index signature -> cast sang shape của ChatIntent.slots.
    intent.slots = slots as Record<string, unknown>;

    // Parser hiểu giao dịch sâu hơn classifier (có amount + category) ->
    // nâng confidence của intent theo parser nếu parser tự tin hơn.
    intent.confidence = maxConfidence(intent.confidence, parsed.confidence);
  } catch (error) {
    // Không để lỗi parser làm gãy router — log để telemetry Phase 5 bắt được.
    console.error('[intentRouter] parseMoneyText failed:', error);
    intent.slots = {};
  }
}

/**
 * Phân loại + trích xuất slot cho một câu chat.
 * Luôn trả ChatIntent hợp lệ, không bao giờ throw.
 */
export function routeIntent(rawText: string): ChatIntent {
  const intent = classifyIntent(rawText);

  // Override follow-up:
  //  - UNKNOWN + bất kỳ tín hiệu tiếp nối nào (cụm hoặc token "do"/"no").
  //  - Cụm nghi vấn MẠNH ("tai sao", "bang cach nao"...) override cả intent
  //    confidence < high: câu WHY/HOW không trả lời được bằng handler
  //    deterministic (vd "tại sao mục mua sắm lại lố" dính mustMatch của
  //    QUERY_CATEGORY_SPENDING ở mức medium dù không có keyword "bao nhiêu").
  // Session check ở handler.
  if (
    (intent.type === 'UNKNOWN' && detectFollowUp(intent.normalizedText)) ||
    (intent.confidence !== 'high' && hasStrongFollowUpPhrase(intent.normalizedText))
  ) {
    intent.type = 'FOLLOW_UP';
    intent.confidence = 'high';
    intent.pipeline = 'llm';
    intent.reason = 'follow-up heuristic override';
  }

  switch (intent.type) {
    case 'LOG_TRANSACTION':
      extractLogTransactionSlots(intent);
      break;

    // Các intent dưới đây sẽ được bơm slot ở Phase 2-4.
    case 'QUERY_BALANCE':
    case 'QUERY_BILL_STATUS':
    case 'QUERY_SAVINGS':
    case 'QUERY_SAFE_TO_SPEND':
    case 'QUERY_TASKS_TODAY':
    case 'QUERY_GOAL_PROGRESS':
    case 'CFO_REPORT':
    case 'ANALYZE_FINANCE':
    case 'ADVICE_CUT_SPENDING':
    case 'FOLLOW_UP':
    case 'UNKNOWN':
    default:
      intent.slots = {};
      break;
  }

  return intent;
}
