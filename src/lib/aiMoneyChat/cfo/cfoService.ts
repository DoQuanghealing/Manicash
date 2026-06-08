/* ═══ AI CFO — Service Orchestrator (Phase 3) ═══
 * snapshot → CFOContextPack → LLM (schema-guarded) → CFOAIResponse | deterministic fallback.
 * Dùng chung cho /api/cfo và handleCFOReport. Số liệu LUÔN từ context pack.
 */

import { buildCFOContextPack } from '@/lib/moneyBrain';
import type { CFOContextPackV1, MoneySnapshotV1 } from '@/lib/moneyBrain';
import type { LLMMessage, LLMOptions } from '../llm/types';
import { buildCFOSystemPrompt, buildCFOUserPrompt } from './cfoPromptBuilder';
import { parseCFOAIResponse, type CFOAIResponse } from './cfoResponseSchema';
import { buildDeterministicCFOFallback } from './cfoFallback';

export interface CFOGenerateResult {
  content: string;
  provider?: string;
  tokensUsed?: number;
}

export interface RunCFOAnalysisDeps {
  /** Gọi LLM. Nếu thiếu/throw/invalid → fallback deterministic. */
  generate?: (messages: LLMMessage[], options?: LLMOptions) => Promise<CFOGenerateResult>;
  options?: LLMOptions;
}

export interface CFOServiceResult {
  context: CFOContextPackV1;
  cfo: CFOAIResponse;
  deterministicFallback: boolean;
  provider?: string;
  tokensUsed?: number;
}

/**
 * Chạy phân tích CFO. KHÔNG throw — luôn trả kết quả dùng được (fallback nếu cần).
 */
export async function runCFOAnalysis(
  snapshot: MoneySnapshotV1,
  deps: RunCFOAnalysisDeps = {},
): Promise<CFOServiceResult> {
  const context = buildCFOContextPack(snapshot);

  if (!deps.generate) {
    return { context, cfo: buildDeterministicCFOFallback(context), deterministicFallback: true };
  }

  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: buildCFOSystemPrompt() },
      { role: 'user', content: buildCFOUserPrompt(context) },
    ];
    const result = await deps.generate(messages, deps.options ?? { temperature: 0.3, maxTokens: 700 });
    const parsed = parseCFOAIResponse(result.content);
    if (!parsed) {
      return { context, cfo: buildDeterministicCFOFallback(context), deterministicFallback: true };
    }
    return {
      context,
      cfo: parsed,
      deterministicFallback: false,
      provider: result.provider,
      tokensUsed: result.tokensUsed,
    };
  } catch {
    return { context, cfo: buildDeterministicCFOFallback(context), deterministicFallback: true };
  }
}
