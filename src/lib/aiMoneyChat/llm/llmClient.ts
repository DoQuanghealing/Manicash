/* ═══ LLM Client — Provider routing + auto-fallback (Phase 3) ═══
 * LLM_PROVIDER=openai (mặc định) -> thử OpenAI trước; lỗi/het quota/chưa cấu hình
 * -> tự fallback sang Groq để đảm bảo high availability.
 *
 * Hỗ trợ dependency injection (deps) để test routing mà không gọi mạng thật.
 */

import { OpenAIProvider } from './openaiProvider';
import { GroqProvider } from './groqProvider';
import type { LLMMessage, LLMOptions, LLMProvider, LLMResult } from './types';

export interface LLMResponse extends LLMResult {
  /** Provider thực sự đã trả kết quả. */
  provider: LLMProvider['name'];
  /** True nếu primary lỗi và đã fallback. */
  fallbackUsed: boolean;
}

export interface LLMClientDeps {
  openai: LLMProvider;
  groq: LLMProvider;
  /** Override provider ưu tiên (mặc định đọc env LLM_PROVIDER). */
  preferred?: LLMProvider['name'];
}

function defaultDeps(): LLMClientDeps {
  return { openai: new OpenAIProvider(), groq: new GroqProvider() };
}

/**
 * Sinh phản hồi LLM với fallback. Thứ tự ưu tiên theo LLM_PROVIDER (hoặc deps.preferred).
 * Ném lỗi chỉ khi CẢ HAI provider đều thất bại.
 */
export async function generateLLMResponse(
  messages: LLMMessage[],
  options: LLMOptions = {},
  deps: LLMClientDeps = defaultDeps(),
): Promise<LLMResponse> {
  const preferred = deps.preferred ?? (process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'openai');

  const primary = preferred === 'groq' ? deps.groq : deps.openai;
  const secondary = preferred === 'groq' ? deps.openai : deps.groq;

  // Thử primary (nếu đã cấu hình).
  if (primary.isConfigured()) {
    try {
      const result = await primary.generateResponse(messages, options);
      return { ...result, provider: primary.name, fallbackUsed: false };
    } catch (error) {
      console.error(`[llmClient] primary (${primary.name}) failed, trying fallback:`, error);
    }
  } else {
    console.warn(`[llmClient] primary (${primary.name}) not configured, trying fallback.`);
  }

  // Fallback secondary.
  if (secondary.isConfigured()) {
    const result = await secondary.generateResponse(messages, options);
    return { ...result, provider: secondary.name, fallbackUsed: true };
  }

  throw new Error('No LLM provider available (both OpenAI and Groq unconfigured or failing).');
}
