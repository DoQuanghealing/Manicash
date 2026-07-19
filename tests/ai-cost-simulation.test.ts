/* ═══ CI Cost Simulation (T3) — chốt chặn #8 zero-leak ═══
 * Mô phỏng 5 persona × 30 ngày × tier qua CHÍNH engine quota thật:
 *   - decideAiMoneyCharge (quotaCore) — đúng hàm server dùng trong transaction.
 *   - getAiQuotaLimits (aiQuotaPolicy) — trần/ngày thật.
 *   - estimateCostVnd (aiCostCore) — bảng giá thật, chi phí = TRẦN mỗi lượt.
 * Deterministic (không random). Ai đổi quota/giá/prompt làm vỡ ngân sách → test ĐỎ.
 *
 * Chi phí/lượt lấy theo HÌNH DẠNG CALL THẬT hôm nay:
 *   - chat  = fallback parse (Groq 70B, max_tokens=220, prompt ~700 tok)
 *   - report = CFO worst-case (GPT-4o-mini 4000in/900out vs 70B narration 900/320 — lấy max)
 */
import {
  decideAiMoneyCharge,
  getAiMoneyQuotaConfig,
  type AiMoneyQuotaPlan,
} from '@/lib/aiMoneyChat/quotaCore';
import { getAiQuotaLimits, type AiFeature } from '@/lib/aiMoneyChat/aiQuotaPolicy';
import { estimateCostVnd } from '@/lib/aiMoneyChat/llm/aiCostCore';
import { PRO_PRICE_VND } from '@/lib/monetization/entitlement';

function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }

/* ─────────── Trần chi phí mỗi lượt (theo call thật) ─────────── */
const COST_PER_CALL_VND: Record<AiFeature, number> = {
  chat: estimateCostVnd('llama-3.3-70b-versatile', 700, 220),
  report: Math.max(
    estimateCostVnd('gpt-4o-mini', 4_000, 900),
    estimateCostVnd('llama-3.3-70b-versatile', 900, 320),
  ),
};

/* ─────────── Personas (deterministic — số lần THỬ gọi mỗi ngày) ─────────── */
interface Persona {
  name: string;
  /** Số lần thử gọi feature trong ngày d (1..30). */
  attempts: (feature: AiFeature, day: number) => number;
}

const PERSONAS: Persona[] = [
  { name: 'ghost', attempts: () => 0 },
  { name: 'casual', attempts: (f, d) => (f === 'chat' ? 2 : d % 7 === 1 ? 1 : 0) },
  { name: 'regular', attempts: (f) => (f === 'chat' ? 8 : 1) },
  { name: 'power', attempts: (f) => (f === 'chat' ? 20 : 3) },
  { name: 'abuser', attempts: (f) => (f === 'chat' ? 200 : 50) },
];

/* ─────────── Simulator — 30 ngày qua engine thật ─────────── */
interface SimResult {
  costVnd: number;
  accepted: Record<AiFeature, number>;
  denied: number;
  usedCredits: number;
}

const DAYS = 30;
const MONTH_KEY = '2026-08';

function simulateMonth(plan: AiMoneyQuotaPlan, persona: Persona): SimResult {
  const config = getAiMoneyQuotaConfig();
  const charge: Record<AiFeature, number> = {
    chat: config.fallbackParseCredits,
    report: config.cfoNarrationCredits,
  };

  let usedCredits = 0;
  let costVnd = 0;
  let denied = 0;
  const accepted: Record<AiFeature, number> = { chat: 0, report: 0 };

  for (let day = 1; day <= DAYS; day++) {
    // dayKey đổi → daily counter reset (mirror readDailyUsage).
    const usedToday: Record<AiFeature, number> = { chat: 0, report: 0 };

    for (const feature of ['chat', 'report'] as AiFeature[]) {
      const tries = persona.attempts(feature, day);
      for (let i = 0; i < tries; i++) {
        const decision = decideAiMoneyCharge(
          {
            uid: `sim-${persona.name}`,
            monthKey: MONTH_KEY,
            plan,
            feature,
            chargeCredits: charge[feature],
            usedCredits,
            usedTodayFeature: usedToday[feature],
            perDayLimit: getAiQuotaLimits(plan, feature).perDay,
          },
          config,
        );
        if (decision.allowed) {
          usedCredits += decision.chargedCredits;
          usedToday[feature] += 1;
          accepted[feature] += 1;
          costVnd += COST_PER_CALL_VND[feature];
        } else {
          denied += 1;
        }
      }
    }
  }

  return { costVnd: Math.round(costVnd * 100) / 100, accepted, denied, usedCredits };
}

/* ─────────── Chạy + báo cáo ─────────── */
const results = new Map<string, SimResult>();
for (const plan of ['free', 'pro'] as AiMoneyQuotaPlan[]) {
  for (const p of PERSONAS) {
    results.set(`${plan}:${p.name}`, simulateMonth(plan, p));
  }
}

console.log('\n═══ Bảng chi phí mô phỏng (worst-case VND/user/tháng) ═══');
console.log(`  trần/lượt: chat=${COST_PER_CALL_VND.chat}đ · report=${COST_PER_CALL_VND.report}đ`);
for (const [key, r] of results) {
  console.log(
    `  ${key.padEnd(14)} cost=${String(r.costVnd).padStart(9)}đ · chat=${r.accepted.chat} · report=${r.accepted.report} · denied=${r.denied} · credits=${r.usedCredits}`,
  );
}

describe('Free (config mặc định: 0 credits/tháng) — không một đồng nào lọt');

it('mọi persona Free → chi phí 0đ, 0 lượt lọt (kể cả abuser)', () => {
  for (const p of PERSONAS) {
    const r = results.get(`free:${p.name}`)!;
    eq(r.costVnd, 0, `free:${p.name} cost`);
    eq(r.accepted.chat + r.accepted.report, 0, `free:${p.name} accepted`);
  }
});

describe('Pro — chi phí bị chặn bởi double-cap (ngày + credits tháng)');

it('pro:regular ≤ 5.000đ/tháng', () => {
  const r = results.get('pro:regular')!;
  ok(r.costVnd <= 5_000, `regular = ${r.costVnd}đ`);
});

it('pro:power (đốt hết quota mỗi ngày) ≤ 12.500đ/tháng', () => {
  const r = results.get('pro:power')!;
  ok(r.costVnd <= 12_500, `power = ${r.costVnd}đ`);
});

it('BOUNDED: abuser (200 thử/ngày) tốn ĐÚNG BẰNG power — cap chặn bằng toán, không hy vọng', () => {
  const power = results.get('pro:power')!;
  const abuser = results.get('pro:abuser')!;
  eq(abuser.costVnd, power.costVnd, 'cost');
  eq(abuser.accepted.chat, power.accepted.chat, 'chat accepted');
  eq(abuser.accepted.report, power.accepted.report, 'report accepted');
  ok(abuser.denied > 6_000, `abuser bị chặn ${abuser.denied} lần`);
});

it('credits tháng không bao giờ vượt hardMonthlyCredits', () => {
  const config = getAiMoneyQuotaConfig();
  for (const [key, r] of results) {
    ok(r.usedCredits <= config.hardMonthlyCredits, `${key}: ${r.usedCredits} credits`);
  }
});

describe('Biên lợi nhuận — worst-case vẫn an toàn');

it('pro worst-case ≤ 30% giá gói tháng (margin API ≥ 70%)', () => {
  const worst = Math.max(...['ghost', 'casual', 'regular', 'power', 'abuser']
    .map((n) => results.get(`pro:${n}`)!.costVnd));
  const pct = (worst / PRO_PRICE_VND) * 100;
  ok(pct <= 30, `worst ${worst}đ = ${pct.toFixed(1)}% của ${PRO_PRICE_VND}đ`);
  console.log(`  → worst-case Pro = ${worst}đ = ${pct.toFixed(1)}% giá gói → margin API ≥ ${(100 - pct).toFixed(0)}%`);
});
