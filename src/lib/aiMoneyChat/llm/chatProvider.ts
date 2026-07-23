/* ═══ Chat LLM Provider — chọn qua ENV (Groq mặc định, Agnes/khác tùy chọn) ═══
 *
 * Các route AI money (cfo-narration, task-eval, dna-oracle) gọi CHUNG helper này
 * thay vì hard-code Groq. Đổi nhà cung cấp = đổi 3 biến môi trường, KHÔNG sửa code:
 *
 *   AI_LLM_BASE_URL   (vd https://apihub.agnes-ai.com/v1) — mặc định Groq
 *   AI_LLM_API_KEY    — mặc định GROQ_API_KEY (giữ Groq làm dự phòng)
 *   AI_LLM_MODEL      (vd agnes-2.0-flash)                — mặc định llama-3.3-70b-versatile
 *
 * Yêu cầu: endpoint PHẢI OpenAI-compatible (POST {base}/chat/completions, messages[],
 * response_format json_object). Agnes AI thỏa (docs apihub.agnes-ai.com/v1).
 *
 * Cả hệ thống có fallback deterministic 0đ → provider lỗi/không cấu hình vẫn an toàn.
 */

export interface ChatProvider {
  /** Base URL tới …/v1 (KHÔNG kèm /chat/completions). */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Nhãn cho ai_usage_log.provider (đối soát): 'groq' | 'agnes' | 'custom'. */
  label: string;
}

function labelFromUrl(baseUrl: string): string {
  if (baseUrl.includes('groq.com')) return 'groq';
  if (baseUrl.includes('agnes')) return 'agnes';
  return 'custom';
}

/** Đọc cấu hình provider từ ENV. Null nếu KHÔNG có key nào (route trả 'no-key'). */
export function resolveChatProvider(): ChatProvider | null {
  const baseUrl = (process.env.AI_LLM_BASE_URL?.trim() || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const apiKey = process.env.AI_LLM_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim() || '';
  const model =
    process.env.AI_LLM_MODEL?.trim() ||
    process.env.AI_MONEY_CHAT_GROQ_MODEL?.trim() ||
    'llama-3.3-70b-versatile';
  if (!apiKey) return null;
  return { baseUrl, apiKey, model, label: labelFromUrl(baseUrl) };
}

export interface ChatCompletionOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Bật response_format json_object (dna-oracle, task-eval cần JSON chặt). */
  jsonMode?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
}

/**
 * Gọi 1 lượt chat completion (OpenAI-compatible). Throw khi HTTP lỗi hoặc thiếu
 * content — caller (runTaskEval/runDnaOracle/cfo route) bắt để fallback 0đ.
 */
export async function callChatCompletion(
  provider: ChatProvider,
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.5,
    max_tokens: opts.maxTokens ?? 500,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${provider.label} API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`${provider.label} response missing content.`);

  return {
    content,
    model: provider.model,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    tokensTotal: data.usage?.total_tokens ?? 0,
  };
}
