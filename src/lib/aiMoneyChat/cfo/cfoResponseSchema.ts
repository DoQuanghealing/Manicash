/* ═══ AI CFO — Response Schema + Validator (Phase 3) ═══
 * Plain TypeScript validator (project chưa dùng Zod).
 * LLM CHỈ trả phần diễn giải — KHÔNG có healthScore/income/expense/safeToSpend.
 * Mọi con số tài chính thuộc CFOContextPack, không thuộc output LLM.
 */

export interface CFOAIResponse {
  summary: string;
  diagnosis: string[];
  risks: string[];
  opportunities: string[];
  actionPlan7Days: string[];
  quickWins?: string[];
  warnings?: string[];
}

const LIMITS = {
  diagnosis: { min: 1, max: 6 },
  risks: { min: 0, max: 6 },
  opportunities: { min: 0, max: 6 },
  actionPlan7Days: { min: 3, max: 7 },
  quickWins: { min: 0, max: 5 },
  warnings: { min: 0, max: 5 },
} as const;

function cleanStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

/**
 * Validate strict. Trả null nếu thiếu field bắt buộc (summary, diagnosis>=1,
 * actionPlan7Days>=3). CHỈ copy field cho phép → mọi field thừa (vd healthScore,
 * totalIncome) bị loại bỏ tự nhiên.
 */
export function validateCFOAIResponse(input: unknown): CFOAIResponse | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  if (!summary) return null;

  const diagnosis = cleanStringArray(o.diagnosis, LIMITS.diagnosis.max);
  if (diagnosis.length < LIMITS.diagnosis.min) return null;

  const actionPlan7Days = cleanStringArray(o.actionPlan7Days, LIMITS.actionPlan7Days.max);
  if (actionPlan7Days.length < LIMITS.actionPlan7Days.min) return null;

  const risks = cleanStringArray(o.risks, LIMITS.risks.max);
  const opportunities = cleanStringArray(o.opportunities, LIMITS.opportunities.max);
  const quickWins = cleanStringArray(o.quickWins, LIMITS.quickWins.max);
  const warnings = cleanStringArray(o.warnings, LIMITS.warnings.max);

  const result: CFOAIResponse = {
    summary,
    diagnosis,
    risks,
    opportunities,
    actionPlan7Days,
  };
  if (quickWins.length > 0) result.quickWins = quickWins;
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/** Trích object JSON đầu tiên từ chuỗi (xử lý ```json fences / text bao quanh). */
export function extractJsonObject(text: string): unknown {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Parse output LLM (string hoặc object) -> CFOAIResponse | null.
 * Không throw. Caller dựng deterministic fallback nếu trả null.
 */
export function parseCFOAIResponse(input: unknown): CFOAIResponse | null {
  if (typeof input === 'string') {
    const obj = extractJsonObject(input);
    return validateCFOAIResponse(obj);
  }
  return validateCFOAIResponse(input);
}
