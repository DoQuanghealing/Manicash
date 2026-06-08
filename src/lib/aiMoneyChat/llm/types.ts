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
}

export interface LLMResult {
  content: string;
  tokensUsed: number;
}

/** Interface chung cho mọi provider. */
export interface LLMProvider {
  /** Tên định danh (telemetry / log). */
  readonly name: 'openai' | 'groq';
  /** True nếu đã có API key để gọi. */
  isConfigured(): boolean;
  generateResponse(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResult>;
}
