/* ═══ Financial DNA — Oracle Schema + Validator (PV-3 · B3) ═══
 * Plain TS validator theo chuẩn nhà (taskEvalSchema — project chưa dùng Zod).
 * CHUẨN NHÀ: persona do engine deterministic tính — KHÔNG thuộc output LLM.
 * AI chỉ trả phần luận giải: 4 phần Oracle + growthOrientation (0–100).
 */

/** Báo cáo Oracle 4 phần (spec §5) — phần AI trả về, đã validate. */
export interface DnaOracleReport {
  /** 1. Nhóm người của ngài — mô tả ấm áp, cụ thể. */
  personaReflection: string;
  /** 2a. Điểm mạnh (1–3). */
  strengths: string[];
  /** 2b. Điểm mù (1–3) — giọng mô tả, không phán xét. */
  blindspots: string[];
  /** 3. Giải pháp hành vi nhỏ, cụ thể (2–3). */
  behaviorActions: string[];
  /** 4. MỘT hướng nâng tầm tư duy (money script lành mạnh hơn). */
  mindsetShift: string;
  /** Điểm Tư duy Tăng trưởng 0–100 — ghi ngược vào capacityEngine (lấp default 50). */
  growthOrientation: number;
}

const LIMITS = {
  strengths: 3,
  blindspots: 3,
  behaviorActions: 3,
  textMax: 600,
  itemMax: 250,
} as const;

function cleanStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim().slice(0, LIMITS.itemMax))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

function clamp100(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Validate strict. Bắt buộc: personaReflection + mindsetShift + growthOrientation
 * hợp lệ; thiếu → null (route sẽ fallback deterministic, KHÔNG trừ credit).
 */
export function validateDnaOracleReport(input: unknown): DnaOracleReport | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const personaReflection =
    typeof o.personaReflection === 'string' ? o.personaReflection.trim().slice(0, LIMITS.textMax) : '';
  const mindsetShift = typeof o.mindsetShift === 'string' ? o.mindsetShift.trim().slice(0, LIMITS.textMax) : '';
  const growthOrientation = clamp100(o.growthOrientation);
  const behaviorActions = cleanStringArray(o.behaviorActions, LIMITS.behaviorActions);
  // behaviorActions là phần LÕI mà user trả tiền (spec §5: "2–3 giải pháp hành vi").
  // Rỗng → coi báo cáo KHÔNG hợp lệ → route fallback bản deterministic (đủ 4 phần),
  // tránh trừ credit cho báo cáo thiếu ruột (QA + redteam).
  if (!personaReflection || !mindsetShift || growthOrientation === null || behaviorActions.length === 0) {
    return null;
  }

  return {
    personaReflection,
    strengths: cleanStringArray(o.strengths, LIMITS.strengths),
    blindspots: cleanStringArray(o.blindspots, LIMITS.blindspots),
    behaviorActions,
    mindsetShift,
    growthOrientation,
  };
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

/** Parse output LLM (string/object) → DnaOracleReport | null. Không throw. */
export function parseDnaOracleReport(input: unknown): DnaOracleReport | null {
  if (typeof input === 'string') return validateDnaOracleReport(extractJsonObject(input));
  return validateDnaOracleReport(input);
}

/** Disclaimer BẮT BUỘC (spec §6) — tĩnh, KHÔNG lấy từ LLM, UI luôn kèm dưới báo cáo. */
export const DNA_ORACLE_DISCLAIMER =
  'Đây là góc nhìn để tham khảo, không phải chẩn đoán tâm lý hay tư vấn đầu tư.';
