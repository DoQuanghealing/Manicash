import {
  getFinanceSnapshot,
  __clearSnapshotCacheForTest,
} from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { buildLLMMessages, compactSnapshot } from '@/lib/aiMoneyChat/llm/promptBuilder';
import { generateLLMResponse, type LLMClientDeps } from '@/lib/aiMoneyChat/llm/llmClient';
import type { LLMProvider, LLMResult } from '@/lib/aiMoneyChat/llm/types';
import { handleCFOReport, type CFOHandlerDeps } from '@/lib/aiMoneyChat/handlers/handleCFOReport';
import type { AiMoneyQuotaChargeResult } from '@/lib/aiMoneyChat/quota';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';

type AsyncTestFn = () => void | Promise<void>;

function describe(name: string): void {
  console.log(`\n${name}`);
}
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try {
    await fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}
function expectIncludes(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) throw new Error(`Expected to include "${needle}".\n${haystack}`);
}
function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`Expected ${label} to be true`);
}

const UID = 'cfo-user';

// Snapshot input đầy đủ: cashflow, budgets, history (anomaly), goals (at risk).
const FULL_INPUT: ClientSnapshotInput = {
  wallets: { main: 4_500_000, emergency: 6_000_000, billFund: 1_200_000 },
  transactions: [
    { type: 'income', amount: 20_000_000, categoryId: 'salary' },
    { type: 'expense', amount: 2_400_000, categoryId: 'food' },
    { type: 'expense', amount: 1_800_000, categoryId: 'shopping' },
    { type: 'transfer', amount: 2_000_000, toWallet: 'emergency' },
  ],
  budgets: [
    { categoryId: 'food', name: 'Ăn uống', limit: 2_000_000 },
    { categoryId: 'shopping', name: 'Mua sắm', limit: 1_500_000 },
  ],
  history: [
    { monthKey: '2026-03', categorySpend: { shopping: 800_000, food: 2_000_000 } },
    { monthKey: '2026-04', categorySpend: { shopping: 850_000, food: 2_400_000 } },
    { monthKey: '2026-05', categorySpend: { shopping: 750_000, food: 2_300_000 } },
  ],
  goals: [
    { id: 'g1', name: 'Mua xe máy', targetAmount: 50_000_000, savedAmount: 12_000_000, deadline: '2026-12-01', monthlyContribution: 500_000 },
  ],
};

/* ─────────── Mock LLM provider ─────────── */
class MockProvider implements LLMProvider {
  constructor(
    public readonly name: 'openai' | 'groq',
    private configured: boolean,
    private behavior: () => Promise<LLMResult>,
  ) {}
  isConfigured(): boolean {
    return this.configured;
  }
  generateResponse(): Promise<LLMResult> {
    return this.behavior();
  }
}

const okResult = (tag: string): (() => Promise<LLMResult>) => async () => ({ content: `from-${tag}`, tokensUsed: 123 });
const failResult = (): (() => Promise<LLMResult>) => async () => {
  throw new Error('provider down');
};

async function main() {
  __clearSnapshotCacheForTest();

  describe('getFinanceSnapshot() — Phase 3 sections');
  await it('cashflow: income/expense/savingsRate đúng', async () => {
    __clearSnapshotCacheForTest();
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    expectEqual(s.cashflow.income, 20_000_000);
    expectEqual(s.cashflow.expense, 4_200_000);
    expectEqual(s.cashflow.savings, 2_000_000);
    expectTrue(Math.abs(s.cashflow.savingsRate - 0.79) < 0.001, 'savingsRate ~0.79');
  });
  await it('budget: total + safeToSpend + overspent count', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    expectEqual(s.budget.monthlyBudgetTotal, 3_500_000);
    expectEqual(s.budget.categoriesOverBudget, 2);
    // B-01: safe-to-spend = income(20M) + carryOver(0) − budget(3.5M) − bills(0) − goals(0) = 16.5M
    // (trước đây tính sai budget − expense − dueBills, bỏ qua income/carryOver/goals).
    expectEqual(s.budget.safeToSpend, 16_500_000);
  });
  await it('anomaly: z-score > 2 cho mua sắm đột biến', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    const shopping = s.categories.anomalies.find((a) => a.categoryId === 'shopping');
    expectTrue(shopping !== undefined, 'shopping anomaly detected');
    expectTrue(shopping!.zScore > 2.0, 'z > 2');
    // food ổn định -> không anomaly
    expectTrue(s.categories.anomalies.find((a) => a.categoryId === 'food') === undefined, 'food not anomalous');
  });
  await it('goals at risk: không kịp deadline ở tốc độ hiện tại', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    expectEqual(s.goals.atRisk.length, 1);
    expectEqual(s.goals.atRisk[0].name, 'Mua xe máy');
  });
  await it('health: score 0-100 + tier hợp lệ', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    expectTrue(s.health.score >= 0 && s.health.score <= 100, 'score in range');
    expectTrue(['poor', 'fair', 'good'].includes(s.health.tier), 'valid tier');
  });

  describe('compactSnapshot() — nén ID thừa');
  await it('không lộ uid / id, có cashflow + health', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    const compact = compactSnapshot(s);
    const json = JSON.stringify(compact);
    expectTrue(!json.includes('cfo-user'), 'no uid leaked');
    expectTrue(!json.includes('"id"'), 'no id field');
    expectTrue(json.includes('savingsRate'), 'has cashflow');
    expectTrue(json.includes('"score"'), 'has health');
    expectTrue(json.includes('anomalies'), 'has anomalies');
  });

  describe('buildLLMMessages()');
  await it('system Lord Diamond + context + user message cuối', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    const intent = routeIntent('lên báo cáo CFO tháng');
    const msgs = buildLLMMessages({ snapshot: s, userMessage: intent.rawText, intent: intent.type });
    expectIncludes(msgs[0].content, 'Lord Diamond');
    expectIncludes(msgs[1].content, 'CONTEXT');
    expectEqual(msgs[msgs.length - 1].role, 'user');
    expectIncludes(msgs[msgs.length - 1].content, 'báo cáo CFO');
  });
  await it('history chèn cặp user/assistant trước câu hỏi mới', async () => {
    const s = await getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
    const msgs = buildLLMMessages({
      snapshot: s,
      userMessage: 'cắt thế nào',
      intent: 'FOLLOW_UP',
      history: [{ userMessage: 'tại sao lố', assistantMessage: 'vì mua sắm' }],
    });
    expectIncludes(msgs.map((m) => m.content).join('|'), 'tại sao lố');
    expectIncludes(msgs.map((m) => m.content).join('|'), 'vì mua sắm');
  });

  describe('generateLLMResponse() — routing + fallback');
  const depsOf = (openai: MockProvider, groq: MockProvider, preferred?: 'openai' | 'groq'): LLMClientDeps => ({
    openai,
    groq,
    preferred,
  });
  await it('primary OpenAI OK -> dùng OpenAI, không fallback', async () => {
    const r = await generateLLMResponse(
      [],
      {},
      depsOf(new MockProvider('openai', true, okResult('openai')), new MockProvider('groq', true, okResult('groq')), 'openai'),
    );
    expectEqual(r.provider, 'openai');
    expectEqual(r.fallbackUsed, false);
    expectEqual(r.content, 'from-openai');
  });
  await it('OpenAI lỗi -> fallback sang Groq', async () => {
    const r = await generateLLMResponse(
      [],
      {},
      depsOf(new MockProvider('openai', true, failResult()), new MockProvider('groq', true, okResult('groq')), 'openai'),
    );
    expectEqual(r.provider, 'groq');
    expectEqual(r.fallbackUsed, true);
  });
  await it('OpenAI chưa cấu hình -> fallback sang Groq', async () => {
    const r = await generateLLMResponse(
      [],
      {},
      depsOf(new MockProvider('openai', false, okResult('openai')), new MockProvider('groq', true, okResult('groq')), 'openai'),
    );
    expectEqual(r.provider, 'groq');
    expectEqual(r.fallbackUsed, true);
  });
  await it('preferred=groq -> dùng Groq trước', async () => {
    const r = await generateLLMResponse(
      [],
      {},
      depsOf(new MockProvider('openai', true, okResult('openai')), new MockProvider('groq', true, okResult('groq')), 'groq'),
    );
    expectEqual(r.provider, 'groq');
    expectEqual(r.fallbackUsed, false);
  });
  await it('cả hai fail -> throw', async () => {
    let threw = false;
    try {
      await generateLLMResponse(
        [],
        {},
        depsOf(new MockProvider('openai', true, failResult()), new MockProvider('groq', false, okResult('groq')), 'openai'),
      );
    } catch {
      threw = true;
    }
    expectTrue(threw, 'threw when both unavailable');
  });

  describe('handleCFOReport() — DI');
  const quota = (allowed: boolean, plan: 'free' | 'pro'): AiMoneyQuotaChargeResult => ({
    uid: UID,
    monthKey: '2026-06',
    plan,
    monthlyLimit: 1500,
    hardLimit: 1500,
    usedCredits: allowed ? 8 : 1500,
    remainingCredits: allowed ? 1492 : 0,
    allowed,
    reason: allowed ? 'ok' : 'exceeded',
    chargedCredits: allowed ? 8 : 0,
  });
  // Phase 3: LLM trả JSON theo CFOAIResponse schema (không phải markdown).
  const CFO_AI_JSON = JSON.stringify({
    summary: 'Tháng này tài chính ổn định.',
    diagnosis: ['Dòng tiền dương.'],
    risks: ['Quỹ dự phòng mỏng.'],
    opportunities: ['Giảm chi ăn uống.'],
    actionPlan7Days: ['Khóa bill', 'Soát chi lớn', 'Hoàn thành task'],
  });
  const genOk: CFOHandlerDeps['generate'] = async () => ({
    content: CFO_AI_JSON,
    tokensUsed: 300,
    provider: 'openai',
  });

  await it('quota OK -> cfo-card + số liệu chính (context) + tokensUsed', async () => {
    const intent = routeIntent('lên báo cáo CFO tháng');
    const reply = await handleCFOReport(UID, intent, { clientSnapshot: FULL_INPUT }, { charge: async () => quota(true, 'pro'), generate: genOk });
    expectEqual(reply.ui.kind, 'cfo-card');
    expectEqual(reply.meta.source, 'llm');
    expectEqual(reply.meta.tokensUsed, 300);
    expectIncludes(reply.message, 'Số liệu chính');
    expectIncludes(reply.message, '/100');
    const payload = reply.ui.payload as { healthScore: number; suggestions: string[] };
    expectTrue(typeof payload.healthScore === 'number', 'healthScore number');
    expectTrue(payload.suggestions.length > 0, 'suggestions extracted');
  });
  await it('quota free denied -> mời nâng Pro', async () => {
    const intent = routeIntent('phân tích năng lực tài chính');
    const reply = await handleCFOReport(UID, intent, {}, { charge: async () => quota(false, 'free'), generate: genOk });
    expectIncludes(reply.message, 'Pro');
    expectEqual(reply.ui.kind, 'none');
  });
  await it('quota pro hết hạn mức -> báo hết credit', async () => {
    const intent = routeIntent('gợi ý cắt giảm chi tiêu');
    const reply = await handleCFOReport(UID, intent, {}, { charge: async () => quota(false, 'pro'), generate: genOk });
    expectIncludes(reply.message, 'hết hạn mức');
  });
  await it('LLM lỗi -> fallback deterministic kèm health score', async () => {
    const intent = routeIntent('lên báo cáo CFO tháng');
    const reply = await handleCFOReport(
      UID,
      intent,
      { clientSnapshot: FULL_INPUT },
      {
        charge: async () => quota(true, 'pro'),
        generate: async () => {
          throw new Error('LLM down');
        },
      },
    );
    expectEqual(reply.meta.source, 'deterministic');
    expectIncludes(reply.message, '/100');
    expectEqual(reply.ui.kind, 'cfo-card');
  });

  console.log('\nPhase 3 CFO + LLM test suite complete.');
}

main();
