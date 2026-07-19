/* TDD — aiCostCore.ts: bảng giá, trần chi phí/lượt, circuit breaker (T2 zero-leak) */
import {
  estimateCostVnd,
  estimateCostVndConservative,
  costCeilingVnd,
  TOKEN_BUDGETS,
  getModelPricing,
  UNKNOWN_MODEL_PRICING,
  getFxVndPerUsd,
  getAiDailySpendLimitVnd,
  evaluateSpendBreaker,
  type AiCallKind,
} from '@/lib/aiMoneyChat/llm/aiCostCore';

function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }

function withEnv<T>(key: string, value: string, fn: () => T): T {
  const prev = process.env[key];
  process.env[key] = value;
  try { return fn(); }
  finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

describe('estimateCostVnd — giá đúng theo bảng, làm tròn LÊN');

it('deep 3500in/700out gpt-4o-mini ≤ trần 25đ (plan §4)', () => {
  const cost = estimateCostVnd('gpt-4o-mini', 3_500, 700);
  ok(cost > 20 && cost <= 25, `deep cost = ${cost}`);
});

it('rescue 400in/120out 8B-instant ≤ trần 1đ', () => {
  const cost = estimateCostVnd('llama-3.1-8b-instant', 400, 120);
  ok(cost > 0 && cost <= 1, `rescue cost = ${cost}`);
});

it('không bao giờ đếm THIẾU: lượt tí hon vẫn > 0 (ceil)', () => {
  ok(estimateCostVnd('gpt-4o-mini', 1, 1) > 0, 'ceil > 0');
});

it('token âm được clamp về 0 (không ra chi phí âm)', () => {
  eq(estimateCostVnd('gpt-4o-mini', -100, -100), 0);
});

it('model LẠ → giá đắt nhất đã biết (fail-safe, đắt hơn 4o-mini)', () => {
  eq(getModelPricing('gpt-99-turbo-max'), UNKNOWN_MODEL_PRICING);
  const unknown = estimateCostVnd('gpt-99-turbo-max', 1000, 1000);
  const mini = estimateCostVnd('gpt-4o-mini', 1000, 1000);
  ok(unknown > mini, `unknown ${unknown} > mini ${mini}`);
});

it('estimateCostVndConservative (không tách in/out) ≥ giá thật cùng tổng token', () => {
  for (const model of ['gpt-4o-mini', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
    const real = estimateCostVnd(model, 3_000, 500);
    const conservative = estimateCostVndConservative(model, 3_500);
    ok(conservative >= real, `${model}: conservative ${conservative} >= real ${real}`);
  }
});

it('FX override: gấp đôi tỷ giá → chi phí ~gấp đôi', () => {
  const base = estimateCostVnd('gpt-4o-mini', 10_000, 2_000);
  const doubled = withEnv('AI_FX_VND_PER_USD', '52000', () =>
    estimateCostVnd('gpt-4o-mini', 10_000, 2_000),
  );
  ok(Math.abs(doubled - base * 2) < 0.05, `${doubled} ~ 2×${base}`);
  eq(getFxVndPerUsd(), 26_000, 'default FX');
});

describe('costCeilingVnd — trần mỗi loại lượt khớp plan §4');

it('trần từng loại ≤ số công bố trong plan (rescue 1 · deep 25 · cfo 30 · task_eval 12 · dna 25)', () => {
  const DOC_CEILING: Record<AiCallKind, number> = {
    rescue: 1, deep: 25, cfo: 30, task_eval: 12, dna_oracle: 25,
  };
  for (const kind of Object.keys(TOKEN_BUDGETS) as AiCallKind[]) {
    const ceiling = costCeilingVnd(kind);
    ok(ceiling > 0 && ceiling <= DOC_CEILING[kind], `${kind}: ${ceiling} ≤ ${DOC_CEILING[kind]}`);
  }
});

it('budget maxOut là số dương (được enforce bằng max_tokens ở API)', () => {
  for (const [kind, b] of Object.entries(TOKEN_BUDGETS)) {
    ok(b.maxIn > 0 && b.maxOut > 0, `${kind} budget dương`);
    ok(b.model in { 'gpt-4o-mini': 1, 'llama-3.3-70b-versatile': 1, 'llama-3.1-8b-instant': 1 },
      `${kind} model có trong bảng giá`);
  }
});

describe('evaluateSpendBreaker — cầu dao ngân sách ngày');

it('dưới trần → allowed, đúng remaining', () => {
  const d = evaluateSpendBreaker(30_000, 50_000);
  ok(d.allowed);
  eq(d.remainingVnd, 20_000);
});

it('chạm/vượt trần → sập cầu dao', () => {
  ok(!evaluateSpendBreaker(50_000, 50_000).allowed, 'chạm trần');
  ok(!evaluateSpendBreaker(99_999, 50_000).allowed, 'vượt trần');
  eq(evaluateSpendBreaker(99_999, 50_000).remainingVnd, 0);
});

it('spent âm (dữ liệu hỏng) → clamp 0, vẫn allowed', () => {
  const d = evaluateSpendBreaker(-500, 50_000);
  ok(d.allowed);
  eq(d.spentTodayVnd, 0);
});

it('trần mặc định 50.000đ, override qua env', () => {
  eq(getAiDailySpendLimitVnd(), 50_000);
  const v = withEnv('AI_DAILY_SPEND_LIMIT_VND', '200000', () => getAiDailySpendLimitVnd());
  eq(v, 200_000);
});
