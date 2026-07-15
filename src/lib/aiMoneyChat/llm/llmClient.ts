/* ═══ LLM Client — Provider routing + auto-fallback (Phase 3) + zero-leak (T2) ═══
 * LLM_PROVIDER=openai (mặc định) -> thử OpenAI trước; lỗi/het quota/chưa cấu hình
 * -> tự fallback sang Groq để đảm bảo high availability.
 *
 * T2 — YẾT HẦU chi phí: MỌI lượt LLM qua đây đều:
 *   1. Qua cầu dao ngân sách ngày (checkSpendBreaker) TRƯỚC khi gọi — sập cầu dao
 *      → throw AiSpendBreakerError → caller degrade về deterministic (đường lỗi sẵn có).
 *   2. Ghi sổ ai_usage_log SAU khi thành công (model, tokens in/out, costVnd).
 * → route mới nào dùng generateLLMResponse là TỰ ĐỘNG được phủ, không phải nhớ wire.
 * (2 route legacy gọi Groq trực tiếp được wire tay: parse + cfo-narration.)
 *
 * Hỗ trợ dependency injection (deps) để test routing mà không gọi mạng thật.
 */

import { OpenAIProvider } from './openaiProvider';
import { GroqProvider } from './groqProvider';
import { estimateCostVnd, estimateCostVndConservative, type SpendBreakerDecision } from './aiCostCore';
import { checkSpendBreaker, logAiUsage, type AiUsageInput } from './aiUsageLog';
import type { LLMMessage, LLMOptions, LLMProvider, LLMResult } from './types';

export interface LLMResponse extends LLMResult {
  /** Provider thực sự đã trả kết quả. */
  provider: LLMProvider['name'];
  /** True nếu primary lỗi và đã fallback. */
  fallbackUsed: boolean;
}

/** Cầu dao ngân sách ngày đã sập — caller nên degrade về deterministic/cache. */
export class AiSpendBreakerError extends Error {
  readonly code = 'ai_daily_budget_exceeded';
  constructor(decision: SpendBreakerDecision) {
    super(
      `AI daily spend limit reached (${Math.round(decision.spentTodayVnd)}/${decision.limitVnd} VND).`,
    );
    this.name = 'AiSpendBreakerError';
  }
}

export interface LLMClientDeps {
  openai: LLMProvider;
  groq: LLMProvider;
  /** Override provider ưu tiên (mặc định đọc env LLM_PROVIDER). */
  preferred?: LLMProvider['name'];
  /** Inject cho test — mặc định aiUsageLog thật. */
  checkBreaker?: () => Promise<SpendBreakerDecision>;
  logUsage?: (input: AiUsageInput) => Promise<void>;
}

function defaultDeps(): LLMClientDeps {
  return { openai: new OpenAIProvider(), groq: new GroqProvider() };
}

/** Chi phí lượt: có tách in/out → giá đúng; không → chặn trên theo giá output. */
function computeCostVnd(result: LLMResult): number {
  const model = result.model ?? 'unknown';
  if (typeof result.tokensIn === 'number' && typeof result.tokensOut === 'number') {
    return estimateCostVnd(model, result.tokensIn, result.tokensOut);
  }
  return estimateCostVndConservative(model, result.tokensUsed);
}

/**
 * Sinh phản hồi LLM với fallback. Thứ tự ưu tiên theo LLM_PROVIDER (hoặc deps.preferred).
 * Ném AiSpendBreakerError khi cầu dao ngân sách sập; ném lỗi thường chỉ khi CẢ HAI
 * provider đều thất bại.
 */
export async function generateLLMResponse(
  messages: LLMMessage[],
  options: LLMOptions = {},
  deps: LLMClientDeps = defaultDeps(),
): Promise<LLMResponse> {
  // T2 — cầu dao ngân sách ngày TRƯỚC khi gọi provider (1 read Firestore, chấp nhận).
  const breaker = await (deps.checkBreaker ?? checkSpendBreaker)();
  if (!breaker.allowed) {
    throw new AiSpendBreakerError(breaker);
  }

  const preferred = deps.preferred ?? (process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'openai');

  const primary = preferred === 'groq' ? deps.groq : deps.openai;
  const secondary = preferred === 'groq' ? deps.openai : deps.groq;

  const startedAt = Date.now();
  const record = async (response: LLMResponse): Promise<void> => {
    // Ghi sổ không được gãy lượt (logAiUsage tự nuốt lỗi, đây chỉ là phòng bị kép).
    await (deps.logUsage ?? logAiUsage)({
      uid: options.usageContext?.uid ?? 'server',
      feature: options.usageContext?.feature ?? 'unknown',
      model: response.model ?? 'unknown',
      provider: response.provider,
      tokensIn: response.tokensIn ?? 0,
      tokensOut: response.tokensOut ?? 0,
      tokensTotal: response.tokensUsed,
      costVnd: computeCostVnd(response),
      fallbackUsed: response.fallbackUsed,
      latencyMs: Date.now() - startedAt,
    }).catch(() => {});
  };

  // Thử primary (nếu đã cấu hình).
  if (primary.isConfigured()) {
    try {
      const result = await primary.generateResponse(messages, options);
      const response: LLMResponse = { ...result, provider: primary.name, fallbackUsed: false };
      await record(response);
      return response;
    } catch (error) {
      console.error(`[llmClient] primary (${primary.name}) failed, trying fallback:`, error);
    }
  } else {
    console.warn(`[llmClient] primary (${primary.name}) not configured, trying fallback.`);
  }

  // Fallback secondary.
  if (secondary.isConfigured()) {
    const result = await secondary.generateResponse(messages, options);
    const response: LLMResponse = { ...result, provider: secondary.name, fallbackUsed: true };
    await record(response);
    return response;
  }

  throw new Error('No LLM provider available (both OpenAI and Groq unconfigured or failing).');
}
