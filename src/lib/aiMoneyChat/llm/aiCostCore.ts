/* ═══ AI Cost Core — Bảng giá + trần token + circuit breaker (T2 zero-leak) ═══
 * PURE functions (test được, không I/O). Nguồn sự thật cho:
 *   1. Giá model (USD/1M token) → quy VND (env AI_FX_VND_PER_USD).
 *   2. estimateCostVnd — LÀM TRÒN LÊN, không bao giờ đếm THIẾU tiền.
 *   3. TOKEN_BUDGETS per loại lượt → trần chi phí mỗi lượt (docs/BUTLER_TIERS_AND_API_COST_PLAN.md §4).
 *   4. evaluateSpendBreaker — cầu dao ngân sách API/ngày toàn nền tảng (chốt chặn #6).
 *
 * Model lạ (đổi env model mà quên thêm giá) → tính theo giá ĐẮT NHẤT đã biết:
 * thà đếm dư còn hơn để lọt.
 */

export interface AiPriceUsdPer1M {
  input: number;
  output: number;
}

/** Giá niêm yết USD / 1 triệu token. Cập nhật khi provider đổi giá. */
export const MODEL_PRICING_USD_PER_1M: Record<string, AiPriceUsdPer1M> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
};

/** Model không có trong bảng → giá đắt nhất đã biết (fail-safe). */
export const UNKNOWN_MODEL_PRICING: AiPriceUsdPer1M = { input: 0.59, output: 0.79 };

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** Tỷ giá quy đổi (đệm sẵn cao hơn thị trường một chút). Override: AI_FX_VND_PER_USD. */
export function getFxVndPerUsd(): number {
  return readPositiveNumber(process.env.AI_FX_VND_PER_USD, 26_000);
}

export function getModelPricing(model: string): AiPriceUsdPer1M {
  return MODEL_PRICING_USD_PER_1M[model] ?? UNKNOWN_MODEL_PRICING;
}

/** Ceil về 0.01đ — bậc đủ mịn cho lượt <1đ (rescue 8B) mà vẫn không đếm thiếu. */
function ceilVnd(x: number): number {
  return Math.ceil(x * 100) / 100;
}

/** Chi phí 1 lượt khi BIẾT tách in/out (từ usage.prompt_tokens/completion_tokens). */
export function estimateCostVnd(model: string, tokensIn: number, tokensOut: number): number {
  const price = getModelPricing(model);
  const fx = getFxVndPerUsd();
  const safeIn = Math.max(0, tokensIn);
  const safeOut = Math.max(0, tokensOut);
  const usd = (safeIn * price.input + safeOut * price.output) / 1_000_000;
  return ceilVnd(usd * fx);
}

/** KHÔNG có tách in/out → tính TẤT CẢ theo giá output (chặn trên, không bao giờ thiếu). */
export function estimateCostVndConservative(model: string, totalTokens: number): number {
  const price = getModelPricing(model);
  const fx = getFxVndPerUsd();
  const usd = (Math.max(0, totalTokens) * price.output) / 1_000_000;
  return ceilVnd(usd * fx);
}

/* ─────────── Trần token per loại lượt (plan §4) ─────────── */

export type AiCallKind = 'rescue' | 'deep' | 'cfo' | 'task_eval' | 'dna_oracle';

export interface TokenBudget {
  maxIn: number;
  maxOut: number;
  /** Model dự kiến của loại lượt (để tính trần chi phí). */
  model: string;
}

/** Input bị budgeter cắt theo maxIn; output bị max_tokens chặn ở API theo maxOut. */
export const TOKEN_BUDGETS: Record<AiCallKind, TokenBudget> = {
  rescue: { maxIn: 400, maxOut: 120, model: 'llama-3.1-8b-instant' },
  deep: { maxIn: 3_500, maxOut: 700, model: 'gpt-4o-mini' },
  cfo: { maxIn: 4_000, maxOut: 900, model: 'gpt-4o-mini' },
  task_eval: { maxIn: 1_200, maxOut: 450, model: 'gpt-4o-mini' },
  dna_oracle: { maxIn: 3_000, maxOut: 800, model: 'gpt-4o-mini' },
};

/** Trần chi phí 1 lượt của loại lượt (dùng cho CI simulation + báo cáo). */
export function costCeilingVnd(kind: AiCallKind): number {
  const b = TOKEN_BUDGETS[kind];
  return estimateCostVnd(b.model, b.maxIn, b.maxOut);
}

/* ─────────── Trần chi phí FIX CỨNG mỗi user/tháng (T6 · docs/PRO_PLUS_ECONOMICS.md) ─────────── */

export type CostCeilingTier = 'free' | 'pro' | 'pro_plus';

/**
 * Trần chi phí API tối đa CHO PHÉP mỗi user/tháng (VND). Vượt → degrade mềm về
 * bản deterministic 0đ. Pro Plus = 30k (=30% giá 99k → lãi ≥67% kể cả kịch trần).
 * Free = vô hạn ở đây (đã bị chặn bởi credit=0 ở lớp quota, không double-block).
 */
export function getUserMonthlyCostCeilingVnd(tier: CostCeilingTier): number {
  if (tier === 'pro_plus') return readPositiveNumber(process.env.AI_USER_CEILING_PRO_PLUS_VND, 30_000);
  if (tier === 'pro') return readPositiveNumber(process.env.AI_USER_CEILING_PRO_VND, 15_000);
  return Number.POSITIVE_INFINITY;
}

export interface UserCostCeilingDecision {
  allowed: boolean;
  spentVnd: number;
  ceilingVnd: number;
  remainingVnd: number;
}

/** PURE: user đã tiêu X đồng API tháng này → còn được gọi lượt TỐN TIỀN không. */
export function evaluateUserCostCeiling(
  spentThisMonthVnd: number,
  tier: CostCeilingTier,
): UserCostCeilingDecision {
  const ceilingVnd = getUserMonthlyCostCeilingVnd(tier);
  const spentVnd = Math.max(0, spentThisMonthVnd);
  return {
    allowed: spentVnd < ceilingVnd,
    spentVnd,
    ceilingVnd,
    remainingVnd: ceilingVnd === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, ceilingVnd - spentVnd),
  };
}

/* ─────────── Circuit breaker toàn nền tảng ─────────── */

/** Ngân sách API/ngày toàn nền tảng (VND). Override: AI_DAILY_SPEND_LIMIT_VND. */
export function getAiDailySpendLimitVnd(): number {
  return readPositiveNumber(process.env.AI_DAILY_SPEND_LIMIT_VND, 50_000);
}

export interface SpendBreakerDecision {
  allowed: boolean;
  spentTodayVnd: number;
  limitVnd: number;
  remainingVnd: number;
}

/** PURE: đã tiêu X hôm nay → còn được gọi tiếp không. */
export function evaluateSpendBreaker(
  spentTodayVnd: number,
  limitVnd = getAiDailySpendLimitVnd(),
): SpendBreakerDecision {
  const spent = Math.max(0, spentTodayVnd);
  return {
    allowed: spent < limitVnd,
    spentTodayVnd: spent,
    limitVnd,
    remainingVnd: Math.max(0, limitVnd - spent),
  };
}
