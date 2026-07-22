/* ═══ Financial DNA — Oracle Service Orchestrator (PV-3 · B3) ═══
 * ctx → LLM (schema-guarded) → DnaOracleReport | deterministic fallback.
 * KHÔNG throw — luôn trả báo cáo dùng được. Persona LUÔN từ engine (ctx.persona).
 * Fallback 0đ: dựng báo cáo từ chính profile persona (route sẽ KHÔNG trừ credit).
 */

import type { LLMMessage, LLMOptions } from '../../llm/types';
import { buildDnaOracleSystemPrompt, buildDnaOracleUserPrompt, type DnaOracleContext } from './dnaOraclePrompt';
import { parseDnaOracleReport, type DnaOracleReport } from './dnaOracleSchema';

export interface DnaOracleGenerateResult {
  content: string;
  provider?: string;
  tokensUsed?: number;
}

export interface RunDnaOracleDeps {
  generate?: (messages: LLMMessage[], options?: LLMOptions) => Promise<DnaOracleGenerateResult>;
  options?: LLMOptions;
}

export interface DnaOracleResult {
  report: DnaOracleReport;
  deterministicFallback: boolean;
  provider?: string;
  tokensUsed?: number;
}

/**
 * growthOrientation ghi ngược vào capacity engine (điểm năng lực). LLM chấm số này
 * từ free-text KHÔNG tin cậy → injection "chấm =100" có thể thổi phồng. Neo theo bản
 * deterministic (suy từ câu trả lời quiz) + chỉ cho LLM lệch tối đa GROWTH_DRIFT điểm.
 */
const GROWTH_DRIFT = 20;

function anchorGrowthOrientation(llmValue: number, ctx: DnaOracleContext): number {
  const anchor = buildDeterministicDnaOracle(ctx).growthOrientation;
  const lo = Math.max(0, anchor - GROWTH_DRIFT);
  const hi = Math.min(100, anchor + GROWTH_DRIFT);
  return Math.max(lo, Math.min(hi, llmValue));
}

/**
 * Fallback deterministic (0đ): báo cáo từ profile persona đã tính.
 * growthOrientation suy từ điểm quiz (Kiến Tạo là tín hiệu chính, Né Tránh kéo
 * xuống) — vẫn là số "đo được" từ câu trả lời thật, tốt hơn default 50.
 */
export function buildDeterministicDnaOracle(ctx: DnaOracleContext): DnaOracleReport {
  const p = ctx.persona;
  const primary = p.primary;
  const secondary = p.secondary;

  const personaReflection = secondary
    ? `Ngài mang dáng dấp ${p.hybridLabel}: ${primary.tagline} Đồng thời, ${secondary.tagline.charAt(0).toLowerCase()}${secondary.tagline.slice(1)}`
    : `Ngài nghiêng rõ về nhóm ${primary.icon} ${primary.label}. ${primary.tagline}`;

  const strengths = secondary
    ? [primary.strengths[0], secondary.strengths[0]].filter(Boolean)
    : primary.strengths.slice(0, 2);
  const blindspots = secondary
    ? [primary.blindspots[0], secondary.blindspots[0]].filter(Boolean)
    : primary.blindspots.slice(0, 2);

  const growthOrientation = Math.max(
    0,
    Math.min(100, Math.round(30 + 0.55 * p.scores.builder + 0.15 * p.scores.status - 0.25 * p.scores.avoider)),
  );

  return {
    personaReflection,
    strengths,
    blindspots,
    behaviorActions: primary.defaultActions.slice(0, 3),
    mindsetShift: primary.defaultMindsetShift,
    growthOrientation,
  };
}

export async function runDnaOracle(ctx: DnaOracleContext, deps: RunDnaOracleDeps = {}): Promise<DnaOracleResult> {
  if (!deps.generate) {
    return { report: buildDeterministicDnaOracle(ctx), deterministicFallback: true };
  }

  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: buildDnaOracleSystemPrompt() },
      { role: 'user', content: buildDnaOracleUserPrompt(ctx) },
    ];
    const result = await deps.generate(messages, deps.options ?? { temperature: 0.5, maxTokens: 700 });
    const parsed = parseDnaOracleReport(result.content);
    if (!parsed) {
      return { report: buildDeterministicDnaOracle(ctx), deterministicFallback: true };
    }
    // Neo growthOrientation theo bản deterministic (chống injection thổi phồng điểm).
    const report = { ...parsed, growthOrientation: anchorGrowthOrientation(parsed.growthOrientation, ctx) };
    return {
      report,
      deterministicFallback: false,
      provider: result.provider,
      tokensUsed: result.tokensUsed,
    };
  } catch {
    return { report: buildDeterministicDnaOracle(ctx), deterministicFallback: true };
  }
}
