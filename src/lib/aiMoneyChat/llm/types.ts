/* ═══ AI Money Chat — LLM Adapter Types (Phase 3) ═══
 * Provider-agnostic. OpenAI (primary) + Groq (fallback) đều dùng API
 * /chat/completions tương thích nhau, nên một interface phục vụ cả hai.
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  /** Structured Outputs — bật khi cần ép JSON. CFO narration để mặc định text. */
  responseFormat?: 'text' | 'json_object';
  /** Override model nếu cần. */
  model?: string;
  /** Ngữ cảnh ghi sổ ai_usage_log (T2) — uid + loại lượt, để đối soát chi phí per-user. */
  usageContext?: { uid?: string; feature?: string };
}

export interface LLMResult {
  content: string;
  tokensUsed: number;
  /** Tách in/out từ usage (T2 — tính tiền chính xác). Thiếu → tính bảo thủ theo giá output. */
  tokensIn?: number;
  tokensOut?: number;
  /** Model THẬT đã gọi (sau env override) — để tra bảng giá. */
  model?: string;
}

/** Interface chung cho mọi provider. */
export interface LLMProvider {
  /** Tên định danh (telemetry / log). */
  readonly name: 'openai' | 'groq';
  /** True nếu đã có API key để gọi. */
  isConfigured(): boolean;
  generateResponse(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResult>;
}
