/* ═══ OpenAI Provider (primary) ═══
 * Gọi qua REST /chat/completions (tương thích OpenAI SDK, zero-dependency).
 * Model mặc định: gpt-4o-mini. Đọc key từ OPENAI_API_KEY.
 */

import type { LLMMessage, LLMOptions, LLMProvider, LLMResult } from './types';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async generateResponse(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

    const body: Record<string, unknown> = {
      model: options.model || process.env.AI_MONEY_CHAT_OPENAI_MODEL || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 700,
    };
    if (options.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI API error ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('OpenAI response missing content.');

    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? 0,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
      model: String(body.model),
    };
  }
}
