/* ═══ LLM Provider Pool — resolve + failover (B1) ═══
 * Pool đọc ENV theo thứ tự ưu tiên, chỉ gồm provider CÓ key; callChatCompletion
 * xoay sang nhà kế khi nhà trước throw; hết pool → throw (route → fallback 0đ).
 */
import {
  resolveProviderPool,
  callChatCompletion,
  type ChatProvider,
  type ChatCompletionResult,
} from '@/lib/aiMoneyChat/llm/chatProvider';

function it(name: string, fn: () => void | Promise<void>): void {
  const done = () => console.log(`  PASS ${name}`);
  const fail = (e: unknown) => { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; };
  try { const r = fn(); if (r instanceof Promise) r.then(done).catch(fail); else done(); }
  catch (e) { fail(e); }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const KEYS = [
  'AI_LLM_POOL', 'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'GROQ_API_KEY',
  'AI_MONEY_CHAT_GROQ_MODEL', 'AGNES_API_KEY', 'AGNES_MODEL',
  'AI_LLM_BASE_URL', 'AI_LLM_API_KEY', 'AI_LLM_MODEL',
];
function clearEnv() { for (const k of KEYS) delete process.env[k]; }

console.log('\nProvider pool — resolve từ ENV');

it('không key nào → pool rỗng', () => {
  clearEnv();
  eq(resolveProviderPool().length, 0);
});

it('mặc định thứ tự cerebras→groq→agnes, chỉ gồm nhà có key', () => {
  clearEnv();
  process.env.GROQ_API_KEY = 'gk';
  process.env.AGNES_API_KEY = 'ak';
  const pool = resolveProviderPool();
  eq(pool.map((p) => p.label).join(','), 'groq,agnes', 'cerebras không key → bị bỏ');
});

it('đủ 3 key → đúng thứ tự ưu tiên cerebras,groq,agnes', () => {
  clearEnv();
  process.env.CEREBRAS_API_KEY = 'ck';
  process.env.GROQ_API_KEY = 'gk';
  process.env.AGNES_API_KEY = 'ak';
  eq(resolveProviderPool().map((p) => p.label).join(','), 'cerebras,groq,agnes');
});

it('AI_LLM_POOL đổi thứ tự', () => {
  clearEnv();
  process.env.AI_LLM_POOL = 'agnes,cerebras';
  process.env.CEREBRAS_API_KEY = 'ck';
  process.env.AGNES_API_KEY = 'ak';
  process.env.GROQ_API_KEY = 'gk'; // không trong list → không tham gia
  eq(resolveProviderPool().map((p) => p.label).join(','), 'agnes,cerebras');
});

it('model mặc định + override qua ENV; base URL đúng mỗi nhà', () => {
  clearEnv();
  process.env.CEREBRAS_API_KEY = 'ck';
  process.env.CEREBRAS_MODEL = 'llama-4-scout';
  process.env.AGNES_API_KEY = 'ak';
  const pool = resolveProviderPool();
  const cere = pool.find((p) => p.label === 'cerebras')!;
  const agnes = pool.find((p) => p.label === 'agnes')!;
  eq(cere.model, 'llama-4-scout', 'override model');
  eq(cere.baseUrl, 'https://api.cerebras.ai/v1');
  eq(agnes.model, 'agnes-2.0-flash', 'default model');
  eq(agnes.baseUrl, 'https://apihub.agnes-ai.com/v1');
});

it('AI_LLM_* (custom) đứng ĐẦU pool, không trùng lặp', () => {
  clearEnv();
  process.env.AI_LLM_BASE_URL = 'https://my.llm/v1';
  process.env.AI_LLM_API_KEY = 'ck-custom';
  process.env.GROQ_API_KEY = 'gk';
  const pool = resolveProviderPool();
  eq(pool[0].label, 'custom');
  eq(pool[0].baseUrl, 'https://my.llm/v1');
  eq(pool.length, 2, 'custom + groq');
});

console.log('\nProvider pool — failover khi gọi');

const OPTS = { system: 's', user: 'u' };
function fakeResult(label: string): ChatCompletionResult {
  return { content: '{}', model: 'm', tokensIn: 1, tokensOut: 1, tokensTotal: 2, providerLabel: label };
}
const POOL: ChatProvider[] = [
  { baseUrl: 'a', apiKey: 'k', model: 'm', label: 'cerebras' },
  { baseUrl: 'b', apiKey: 'k', model: 'm', label: 'groq' },
  { baseUrl: 'c', apiKey: 'k', model: 'm', label: 'agnes' },
];

it('nhà đầu OK → dùng luôn, không gọi nhà sau', async () => {
  const calls: string[] = [];
  const r = await callChatCompletion(POOL, OPTS, {
    callOne: async (p) => { calls.push(p.label); return fakeResult(p.label); },
  });
  eq(r.providerLabel, 'cerebras');
  eq(calls.join(','), 'cerebras', 'chỉ gọi nhà đầu');
});

it('nhà đầu nghẽn (throw) → xoay sang nhà kế', async () => {
  const calls: string[] = [];
  const r = await callChatCompletion(POOL, OPTS, {
    callOne: async (p) => {
      calls.push(p.label);
      if (p.label === 'cerebras') throw new Error('429');
      return fakeResult(p.label);
    },
  });
  eq(r.providerLabel, 'groq', 'nhảy sang groq');
  eq(calls.join(','), 'cerebras,groq');
});

it('2 nhà đầu lỗi → nhà thứ 3 cứu', async () => {
  const r = await callChatCompletion(POOL, OPTS, {
    callOne: async (p) => {
      if (p.label !== 'agnes') throw new Error('down');
      return fakeResult(p.label);
    },
  });
  eq(r.providerLabel, 'agnes');
});

it('cả pool lỗi → throw lỗi cuối (route sẽ fallback 0đ)', async () => {
  let threw = false;
  try {
    await callChatCompletion(POOL, OPTS, { callOne: async () => { throw new Error('boom'); } });
  } catch (e) {
    threw = true;
    ok(e instanceof Error && e.message === 'boom');
  }
  ok(threw, 'phải throw khi hết pool');
});

it('pool rỗng → throw ngay', async () => {
  let threw = false;
  try { await callChatCompletion([], OPTS, { callOne: async () => fakeResult('x') }); }
  catch { threw = true; }
  ok(threw);
});

clearEnv();
console.log('');
