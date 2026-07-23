/* ═══ Chat LLM Provider POOL — nhiều nhà cung cấp free, tự xoay khi nghẽn (B1) ═══
 *
 * Gộp free tier của nhiều nhà (Cerebras → Groq → Agnes) để tăng throughput + chịu
 * lỗi: gặp 429/nghẽn/timeout ở nhà này → tự nhảy nhà kế. Hết pool → throw → route
 * bắt → fallback deterministic 0đ (không "vỡ", chỉ mất phần văn AI).
 *
 * Tất cả PHẢI OpenAI-compatible (POST {base}/chat/completions, messages[]).
 *   Cerebras https://api.cerebras.ai/v1        — TPM cao nhất → ưu tiên đầu
 *   Groq     https://api.groq.com/openai/v1
 *   Agnes    https://apihub.agnes-ai.com/v1
 *
 * Cấu hình ENV:
 *   AI_LLM_POOL=cerebras,groq,agnes   (thứ tự ưu tiên; provider nào CÓ key mới tham gia)
 *   CEREBRAS_API_KEY / CEREBRAS_MODEL (default llama-3.3-70b)
 *   GROQ_API_KEY     / AI_MONEY_CHAT_GROQ_MODEL (default llama-3.3-70b-versatile)
 *   AGNES_API_KEY    / AGNES_MODEL    (default agnes-2.0-flash)
 * Tương thích cũ: AI_LLM_BASE_URL + AI_LLM_API_KEY (+AI_LLM_MODEL) → provider 'custom'
 *   đặt ĐẦU pool (giữ config PR #10 chạy tiếp).
 */

export interface ChatProvider {
  /** Base URL tới …/v1 (KHÔNG kèm /chat/completions). */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Nhãn cho ai_usage_log.provider: 'cerebras' | 'groq' | 'agnes' | 'custom'. */
  label: string;
}

interface KnownProvider {
  label: string;
  baseUrl: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
}

const KNOWN: Record<string, KnownProvider> = {
  cerebras: {
    label: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    modelEnv: 'CEREBRAS_MODEL',
    defaultModel: 'llama-3.3-70b',
  },
  groq: {
    label: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'AI_MONEY_CHAT_GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  agnes: {
    label: 'agnes',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    keyEnv: 'AGNES_API_KEY',
    modelEnv: 'AGNES_MODEL',
    defaultModel: 'agnes-2.0-flash',
  },
};

const DEFAULT_ORDER = ['cerebras', 'groq', 'agnes'];

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/** Provider 'custom' từ AI_LLM_* (tương thích PR #10). Null nếu không cấu hình. */
function customProvider(): ChatProvider | null {
  const baseUrl = env('AI_LLM_BASE_URL');
  const apiKey = env('AI_LLM_API_KEY');
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model: env('AI_LLM_MODEL') || env('AI_MONEY_CHAT_GROQ_MODEL') || 'llama-3.3-70b-versatile',
    label: 'custom',
  };
}

/**
 * Xây pool theo thứ tự ưu tiên. Chỉ gồm provider CÓ key. 'custom' (AI_LLM_*) luôn
 * đứng đầu nếu cấu hình. Rỗng → route trả 'no-key' → client fallback 0đ.
 */
export function resolveProviderPool(): ChatProvider[] {
  const pool: ChatProvider[] = [];
  const seen = new Set<string>();

  const custom = customProvider();
  if (custom) {
    pool.push(custom);
    seen.add(custom.baseUrl);
  }

  const order = (env('AI_LLM_POOL') || DEFAULT_ORDER.join(','))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  for (const name of order) {
    const k = KNOWN[name];
    if (!k) continue;
    const apiKey = env(k.keyEnv);
    if (!apiKey || seen.has(k.baseUrl)) continue;
    pool.push({ baseUrl: k.baseUrl, apiKey, model: env(k.modelEnv) || k.defaultModel, label: k.label });
    seen.add(k.baseUrl);
  }
  return pool;
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
  /** Provider THỰC SỰ trả kết quả (để log đối soát). */
  providerLabel: string;
}

/** Gọi 1 provider. Throw khi HTTP lỗi / thiếu content → caller xoay provider kế. */
export async function callOneProvider(
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
    providerLabel: provider.label,
  };
}

export interface CallPoolDeps {
  /** Inject để test xoay vòng mà không gọi mạng thật. */
  callOne?: (provider: ChatProvider, opts: ChatCompletionOptions) => Promise<ChatCompletionResult>;
}

/**
 * Thử từng provider theo thứ tự pool; lỗi (429/5xx/timeout/thiếu content) → nhảy
 * cái kế. Trả về kết quả provider ĐẦU TIÊN thành công. Hết pool → throw lỗi cuối.
 */
export async function callChatCompletion(
  pool: ChatProvider[],
  opts: ChatCompletionOptions,
  deps: CallPoolDeps = {},
): Promise<ChatCompletionResult> {
  const callOne = deps.callOne ?? callOneProvider;
  if (pool.length === 0) throw new Error('LLM pool is empty (no provider key configured).');

  let lastError: unknown = null;
  for (const provider of pool) {
    try {
      return await callOne(provider, opts);
    } catch (error) {
      lastError = error;
      // Provider này nghẽn/lỗi → thử nhà kế. Ghi log để theo dõi tần suất rơi.
      console.warn(`[llm-pool] provider "${provider.label}" failed, rotating:`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All LLM providers failed.');
}
