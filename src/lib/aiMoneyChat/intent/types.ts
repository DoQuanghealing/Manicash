/* ═══ AI Money Chat — Intent System Types (Phase 1) ═══
 * Contract dùng chung cho toàn bộ pipeline chat hybrid:
 *   routeIntent() -> ChatIntent -> handler -> ChatReply.
 *
 * Lưu ý kiến trúc:
 *  - 12 ChatIntentType: 10 intent "classifiable" (có pattern ở intentPatterns.ts)
 *    + FOLLOW_UP (detect bằng heuristic ở /api/chat route — Phase 4)
 *    + UNKNOWN (fallback khi không pattern nào đạt ngưỡng).
 *  - "pipeline" của mỗi intent (deterministic vs llm) sống trong IntentPattern,
 *    KHÔNG nhúng vào type — vì cùng một intent vẫn có thể đổi pipeline runtime
 *    (vd confidence thấp -> đẩy LLM ở phase sau).
 */

import type { TxnType } from '@/stores/useFinanceStore';

/** Toàn bộ ý định mà hệ thống chat hiểu được. */
export type ChatIntentType =
  // ── Deterministic (0 token) ────────────────────────────────
  | 'LOG_TRANSACTION' // "mua trứng 30k", "nhận lương 20tr"
  | 'QUERY_BALANCE' // "tôi còn bao nhiêu tiền" / "ví chính còn bao nhiêu"
  | 'QUERY_INCOME' // "tháng này tôi thu bao nhiêu" (Phase 2)
  | 'QUERY_BILL_STATUS' // "tiền điện đóng chưa"
  | 'QUERY_UPCOMING_BILLS' // "7 ngày tới có bill nào" (Phase 2)
  | 'QUERY_BILL_COVERAGE' // "quỹ bill có đủ trả bill không" (Phase 2)
  | 'QUERY_BUDGET_STATUS' // "danh mục nào vượt ngân sách" (Phase 2)
  | 'QUERY_CATEGORY_SPENDING' // "ăn uống tháng này xài bao nhiêu" (Phase 2)
  | 'QUERY_SAVINGS' // "tiết kiệm tháng này được bao nhiêu"
  | 'QUERY_SAFE_TO_SPEND' // "tháng này còn bao nhiêu để xài"
  | 'QUERY_SPENDING' // "hôm nay/tháng này tôi đã chi bao nhiêu"
  | 'QUERY_TASKS_TODAY' // "hôm nay tôi có việc gì" (alias of QUERY_TASKS)
  | 'QUERY_EARNING_PIPELINE' // "nếu làm hết task thì có thêm bao nhiêu" (Phase 2)
  | 'QUERY_GOAL_PROGRESS' // "mục tiêu mua xe tới đâu rồi"
  | 'QUERY_HEALTH_SCORE' // "điểm sức khỏe tài chính" (Phase 2)
  | 'QUERY_STREAK' // "streak của tôi bao nhiêu" (Phase 2)
  // ── Stochastic (LLM) ───────────────────────────────────────
  | 'CFO_REPORT' // "lên báo cáo CFO tháng"
  | 'ANALYZE_FINANCE' // "phân tích năng lực tài chính"
  | 'ADVICE_CUT_SPENDING' // "gợi ý cắt giảm chi tiêu"
  // ── Đặc biệt ───────────────────────────────────────────────
  | 'FOLLOW_UP' // tiếp nối báo cáo trước (detect heuristic, Phase 4)
  | 'UNKNOWN'; // không xác định được

/** Mức độ tự tin của classifier — quyết định có cần fallback LLM hay không. */
export type IntentConfidence = 'high' | 'medium' | 'low';

/** Loại pipeline xử lý — quyết định handler có gọi LLM hay không. */
export type IntentPipeline = 'deterministic' | 'llm';

/** Nguồn sinh ra câu trả lời — dùng cho telemetry. */
export type ChatReplySource = 'deterministic' | 'llm' | 'llm-cached';

/** Loại UI mà client cần render kèm câu trả lời. */
export type ChatReplyUiKind =
  | 'confirm-transaction' // card xác nhận giao dịch trước khi ghi
  | 'cfo-card' // thẻ tóm tắt sức khỏe tài chính
  | 'follow-up-buttons' // gợi ý câu hỏi tiếp theo
  | 'none';

/**
 * Kết quả phân loại + trích xuất slot từ một câu chat.
 * Đây là "đơn hàng" mà router chuyển cho handler.
 */
export interface ChatIntent {
  /** Loại ý định đã phân loại. */
  type: ChatIntentType;
  /** Mức tự tin (đã ánh xạ từ score). */
  confidence: IntentConfidence;
  /** Score thô 0..1 — giữ lại để debug & quyết định ngưỡng fallback. */
  score: number;
  /** Pipeline khuyến nghị (lấy từ pattern khớp; UNKNOWN -> deterministic). */
  pipeline: IntentPipeline;
  /** Slot đã trích xuất — shape phụ thuộc từng intent (xem intentRouter). */
  slots: Record<string, unknown>;
  /** Câu gốc sau khi normalize (đã fold dấu, bỏ stop-word). */
  normalizedText: string;
  /** Câu gốc nguyên bản người dùng nhập. */
  rawText: string;
  /** Lý do classifier chọn intent này — debug only. */
  reason?: string;
}

/** Slot cho intent LOG_TRANSACTION — bridge sang ParsedMoneyIntent của parser cũ. */
export interface LogTransactionSlots {
  type?: TxnType;
  amount?: number;
  categoryId?: string;
  /** confidence của parser local (khác với confidence của classifier). */
  parserConfidence?: IntentConfidence;
}

/**
 * Câu trả lời hoàn chỉnh trả về client.
 * `message` luôn là markdown đã render sẵn.
 */
export interface ChatReply {
  /** Nội dung markdown hiển thị cho user. */
  message: string;
  /** Tín hiệu UI bổ sung (card, nút...). */
  ui: {
    kind: ChatReplyUiKind;
    payload?: unknown;
  };
  /** Telemetry — đo sức khỏe hệ thống. */
  meta: {
    intent: ChatIntentType;
    source: ChatReplySource;
    latencyMs: number;
    /** Chỉ có khi đi qua LLM. */
    tokensUsed?: number;
  };
}
