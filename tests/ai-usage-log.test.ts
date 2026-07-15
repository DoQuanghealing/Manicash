/* TDD — aiUsageLog.ts + llmClient breaker/log (T2 zero-leak, in-memory backend) */
import {
  logAiUsage,
  getSpentTodayVnd,
  checkSpendBreaker,
  __clearAiUsageLogForTest,
  __getAiUsageEntriesForTest,
  type AiUsageInput,
} from '@/lib/aiMoneyChat/llm/aiUsageLog';
import {
  generateLLMResponse,
  AiSpendBreakerError,
  type LLMClientDeps,
} from '@/lib/aiMoneyChat/llm/llmClient';
import type { LLMProvider } from '@/lib/aiMoneyChat/llm/types';

function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }

function entry(costVnd: number, feature = 'cfo'): AiUsageInput {
  return {
    uid: 'u1', feature, model: 'gpt-4o-mini', provider: 'openai',
    tokensIn: 1000, tokensOut: 200, tokensTotal: 1200,
    costVnd, fallbackUsed: false, latencyMs: 1234,
  };
}

function fakeProvider(name: 'openai' | 'groq', opts: { fail?: boolean } = {}): LLMProvider {
  return {
    name,
    isConfigured: () => true,
    generateResponse: async () => {
      if (opts.fail) throw new Error(`${name} down`);
      return { content: 'ok', tokensUsed: 1200, tokensIn: 1000, tokensOut: 200, model: 'gpt-4o-mini' };
    },
  };
}

async function main() {
  describe('logAiUsage + getSpentTodayVnd — in-memory backend');

  await it('cộng dồn tổng chi ngày qua nhiều lượt', async () => {
    __clearAiUsageLogForTest();
    await logAiUsage(entry(10.5));
    await logAiUsage(entry(4.5));
    eq(await getSpentTodayVnd(), 15);
    eq(__getAiUsageEntriesForTest().length, 2);
  });

  await it('cost âm bị clamp 0; feature key được sanitize', async () => {
    __clearAiUsageLogForTest();
    await logAiUsage(entry(-99, 'cfo narration!'));
    eq(await getSpentTodayVnd(), 0);
    eq(__getAiUsageEntriesForTest()[0].feature, 'cfo_narration_');
  });

  await it('entry có dayKey/monthKey/at được đóng dấu', async () => {
    __clearAiUsageLogForTest();
    await logAiUsage(entry(1));
    const e = __getAiUsageEntriesForTest()[0];
    ok(/^\d{4}-\d{2}-\d{2}$/.test(e.dayKey), 'dayKey');
    ok(/^\d{4}-\d{2}$/.test(e.monthKey), 'monthKey');
    ok(e.at.includes('T'), 'at ISO');
  });

  describe('checkSpendBreaker — cầu dao đọc tổng chi hôm nay');

  await it('dưới trần mặc định (50k) → allowed', async () => {
    __clearAiUsageLogForTest();
    await logAiUsage(entry(100));
    const d = await checkSpendBreaker();
    ok(d.allowed);
    eq(d.spentTodayVnd, 100);
  });

  await it('vượt trần → sập', async () => {
    __clearAiUsageLogForTest();
    await logAiUsage(entry(60_000));
    const d = await checkSpendBreaker();
    ok(!d.allowed);
  });

  describe('generateLLMResponse — yết hầu breaker + ghi sổ');

  await it('cầu dao sập → throw AiSpendBreakerError, KHÔNG gọi provider', async () => {
    let providerCalled = false;
    const deps: LLMClientDeps = {
      openai: {
        name: 'openai', isConfigured: () => true,
        generateResponse: async () => { providerCalled = true; return { content: 'x', tokensUsed: 1 }; },
      },
      groq: fakeProvider('groq'),
      checkBreaker: async () => ({ allowed: false, spentTodayVnd: 99_999, limitVnd: 50_000, remainingVnd: 0 }),
      logUsage: async () => {},
    };
    let threw: unknown = null;
    try { await generateLLMResponse([{ role: 'user', content: 'hi' }], {}, deps); }
    catch (e) { threw = e; }
    ok(threw instanceof AiSpendBreakerError, 'đúng loại lỗi');
    ok(!providerCalled, 'provider không bị gọi');
  });

  await it('thành công → ghi sổ đúng uid/feature/token/cost > 0', async () => {
    const logged: AiUsageInput[] = [];
    const deps: LLMClientDeps = {
      openai: fakeProvider('openai'),
      groq: fakeProvider('groq'),
      preferred: 'openai',
      checkBreaker: async () => ({ allowed: true, spentTodayVnd: 0, limitVnd: 50_000, remainingVnd: 50_000 }),
      logUsage: async (e) => { logged.push(e); },
    };
    const res = await generateLLMResponse(
      [{ role: 'user', content: 'hi' }],
      { usageContext: { uid: 'u42', feature: 'deep' } },
      deps,
    );
    eq(res.provider, 'openai');
    eq(logged.length, 1);
    eq(logged[0].uid, 'u42');
    eq(logged[0].feature, 'deep');
    eq(logged[0].tokensIn, 1000);
    eq(logged[0].tokensOut, 200);
    ok(logged[0].costVnd > 0, 'cost > 0');
    ok(!logged[0].fallbackUsed);
  });

  await it('primary sập → fallback secondary vẫn được ghi sổ với fallbackUsed=true', async () => {
    const logged: AiUsageInput[] = [];
    const deps: LLMClientDeps = {
      openai: fakeProvider('openai', { fail: true }),
      groq: fakeProvider('groq'),
      preferred: 'openai',
      checkBreaker: async () => ({ allowed: true, spentTodayVnd: 0, limitVnd: 50_000, remainingVnd: 50_000 }),
      logUsage: async (e) => { logged.push(e); },
    };
    const res = await generateLLMResponse([{ role: 'user', content: 'hi' }], {}, deps);
    eq(res.provider, 'groq');
    eq(logged.length, 1);
    ok(logged[0].fallbackUsed, 'fallbackUsed=true');
    eq(logged[0].uid, 'server', 'uid mặc định khi thiếu usageContext');
  });

  await it('logUsage nổ → lượt vẫn trả về bình thường (ghi sổ không gãy user)', async () => {
    const deps: LLMClientDeps = {
      openai: fakeProvider('openai'),
      groq: fakeProvider('groq'),
      checkBreaker: async () => ({ allowed: true, spentTodayVnd: 0, limitVnd: 50_000, remainingVnd: 50_000 }),
      logUsage: async () => { throw new Error('firestore down'); },
    };
    const res = await generateLLMResponse([{ role: 'user', content: 'hi' }], {}, deps);
    eq(res.content, 'ok');
  });

  __clearAiUsageLogForTest();
}

main();
