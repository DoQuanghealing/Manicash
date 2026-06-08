/* Phase 3 — handleCFOReport uses context pack; AI cannot override healthScore */
import { handleCFOReport, type CFOHandlerDeps } from '@/lib/aiMoneyChat/handlers/handleCFOReport';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import type { AiMoneyQuotaChargeResult } from '@/lib/aiMoneyChat/quota';
import { toMoneySnapshotV1, getFinancialHealthScore } from '@/lib/moneyBrain';

type AsyncFn = () => Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function inc(h: string, n: string): void { if (!h.includes(n)) throw new Error(`expected to include "${n}".\n${h}`); }
function noinc(h: string, n: string): void { if (h.includes(n)) throw new Error(`should NOT include "${n}"`); }
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }

const UID = 'cfo-user';
const MK = '2026-06';
const INPUT: ClientSnapshotInput = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh', monthKey: MK,
  wallets: { main: 20_000_000, emergency: 12_500_000, billFund: 1_200_000 },
  transactions: [
    { type: 'income', amount: 20_000_000, categoryId: 'salary', dateKey: '2026-06-01', monthKey: MK },
    { type: 'expense', amount: 2_400_000, categoryId: 'food', dateKey: '2026-06-02', monthKey: MK },
  ],
  budgets: [{ categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 }],
  bills: [{ id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 10, isPaid: false }],
  goals: [],
  tasks: [{ id: 't1', name: 'Freelance', expectedAmount: 3_000_000, startDate: '2026-06-01', endDate: '2026-06-30' }],
};

const EXPECTED_HEALTH = getFinancialHealthScore(toMoneySnapshotV1(INPUT)).total;

const quota = (allowed: boolean): AiMoneyQuotaChargeResult => ({
  uid: UID, monthKey: MK, plan: 'pro', monthlyLimit: 1500, hardLimit: 1500,
  usedCredits: allowed ? 8 : 1500, remainingCredits: allowed ? 1492 : 0,
  allowed, reason: allowed ? 'ok' : 'exceeded', chargedCredits: allowed ? 8 : 0,
});

const VALID_JSON = JSON.stringify({
  summary: 'Tình hình tháng này ổn.',
  diagnosis: ['Dòng tiền dương.'],
  risks: ['Bill chưa đóng.'],
  opportunities: ['Giảm ăn uống.'],
  actionPlan7Days: ['Việc 1', 'Việc 2', 'Việc 3'],
  // LLM cố tình nhồi số — phải bị strip:
  healthScore: 999,
  totalIncome: 1,
});

function main() {
  console.log('\nhandleCFOReport — context pack');

  it('dùng context pack: hiển thị healthScore deterministic', async () => {
    const deps: CFOHandlerDeps = {
      charge: async () => quota(true),
      generate: async () => ({ content: VALID_JSON, provider: 'openai', tokensUsed: 200 }),
    };
    const reply = await handleCFOReport(UID, routeIntent('lên báo cáo CFO tháng'), { clientSnapshot: INPUT }, deps);
    eq(reply.meta.source, 'llm');
    inc(reply.message, `${EXPECTED_HEALTH}/100`);
    inc(reply.message, 'Số liệu chính');
    inc(reply.message, 'Tình hình tháng này ổn.');
  });

  it('AI KHÔNG override được healthScore (999 bị bỏ)', async () => {
    const deps: CFOHandlerDeps = {
      charge: async () => quota(true),
      generate: async () => ({ content: VALID_JSON, provider: 'openai', tokensUsed: 200 }),
    };
    const reply = await handleCFOReport(UID, routeIntent('lên báo cáo CFO tháng'), { clientSnapshot: INPUT }, deps);
    noinc(reply.message, '999/100');
    const payload = reply.ui.payload as { healthScore: number };
    eq(payload.healthScore, EXPECTED_HEALTH);
  });

  it('LLM trả JSON sai -> fallback deterministic', async () => {
    const deps: CFOHandlerDeps = {
      charge: async () => quota(true),
      generate: async () => ({ content: 'đây không phải json', provider: 'openai', tokensUsed: 50 }),
    };
    const reply = await handleCFOReport(UID, routeIntent('lên báo cáo CFO tháng'), { clientSnapshot: INPUT }, deps);
    eq(reply.meta.source, 'deterministic');
    inc(reply.message, `${EXPECTED_HEALTH}/100`);
    eq(reply.ui.kind, 'cfo-card');
  });

  it('LLM throw -> fallback deterministic (không crash)', async () => {
    const deps: CFOHandlerDeps = {
      charge: async () => quota(true),
      generate: async () => { throw new Error('LLM down'); },
    };
    const reply = await handleCFOReport(UID, routeIntent('lên báo cáo CFO tháng'), { clientSnapshot: INPUT }, deps);
    eq(reply.meta.source, 'deterministic');
    inc(reply.message, '/100');
  });

  it('quota free denied -> mời Pro, không gọi LLM', async () => {
    let called = false;
    const deps: CFOHandlerDeps = {
      charge: async () => ({ ...quota(false), plan: 'free' }),
      generate: async () => { called = true; return { content: VALID_JSON }; },
    };
    const reply = await handleCFOReport(UID, routeIntent('phân tích tài chính'), { clientSnapshot: INPUT }, deps);
    inc(reply.message, 'Pro');
    eq(called, false, 'LLM not called when quota denied');
  });

  console.log('\nhandleCFOReport context test complete.');
}

main();
