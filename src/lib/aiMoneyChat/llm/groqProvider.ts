/* ═══ Groq Provider (fallback) ═══
 * Groq expose API /chat/completions tương thích OpenAI.
 * Model mặc định: llama-3.3-70b-versatile. Đọc key từ GROQ_API_KEY.
 */

import type { LLMMessage, LLMOptions, LLMProvider, LLMResult } from './types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export class GroqProvider implements LLMProvider {
  readonly name = 'groq' as const;

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
  }

  async generateResponse(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');

    const body: Record<string, unknown> = {
      model: options.model || process.env.AI_MONEY_CHAT_GROQ_MODEL || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 700,
    };
    if (options.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Groq API error ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Groq response missing content.');

    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? 0,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
      model: String(body.model),
    };
  }
}
