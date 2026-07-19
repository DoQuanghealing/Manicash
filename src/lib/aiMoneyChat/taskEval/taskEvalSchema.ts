/* ═══ Task Eval — Response Schema + Validator (T5) ═══
 * Plain TS validator (project chưa dùng Zod). CHUẨN NHÀ: điểm khả thi (feasibility)
 * do engine deterministic tính — KHÔNG thuộc output LLM. AI chỉ trả phần diễn giải:
 * gợi ý nhiệm vụ phụ còn thiếu, rủi ro, khoảng giá đề xuất, một câu coach.
 */

export interface TaskPriceRange {
  min: number;
  max: number;
}

/** Phần AI trả về (đã validate). KHÔNG có feasibility — số đó của engine. */
export interface TaskEvalAIResponse {
  missingSubtasks: string[];
  risks: string[];
  suggestedPriceRange?: TaskPriceRange;
  oneLineCoach: string;
}

const LIMITS = {
  missingSubtasks: { min: 0, max: 6 },
  risks: { min: 0, max: 5 },
} as const;

function cleanStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

function parsePriceRange(v: unknown): TaskPriceRange | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const min = typeof o.min === 'number' && Number.isFinite(o.min) ? Math.max(0, Math.round(o.min)) : NaN;
  const max = typeof o.max === 'number' && Number.isFinite(o.max) ? Math.max(0, Math.round(o.max)) : NaN;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  return min <= max ? { min, max } : { min: max, max: min };
}

/**
 * Validate strict. Trả null nếu thiếu oneLineCoach (field bắt buộc duy nhất —
 * missingSubtasks/risks có thể rỗng). Field thừa (vd feasibility) bị loại tự nhiên.
 */
export function validateTaskEvalAIResponse(input: unknown): TaskEvalAIResponse | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const oneLineCoach = typeof o.oneLineCoach === 'string' ? o.oneLineCoach.trim() : '';
  if (!oneLineCoach) return null;

  const result: TaskEvalAIResponse = {
    missingSubtasks: cleanStringArray(o.missingSubtasks, LIMITS.missingSubtasks.max),
    risks: cleanStringArray(o.risks, LIMITS.risks.max),
    oneLineCoach: oneLineCoach.slice(0, 200),
  };
  const price = parsePriceRange(o.suggestedPriceRange);
  if (price) result.suggestedPriceRange = price;
  return result;
}

/** Trích object JSON đầu tiên từ chuỗi (```json fences / text bao quanh). */
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

/** Parse output LLM (string/object) → TaskEvalAIResponse | null. Không throw. */
export function parseTaskEvalAIResponse(input: unknown): TaskEvalAIResponse | null {
  if (typeof input === 'string') return validateTaskEvalAIResponse(extractJsonObject(input));
  return validateTaskEvalAIResponse(input);
}
