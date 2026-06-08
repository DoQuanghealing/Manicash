/* Phase 3 — runCFOAnalysis LLM guard: no-key/invalid -> fallback, valid -> parsed */
import { runCFOAnalysis } from '@/lib/aiMoneyChat/cfo/cfoService';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

type AsyncFn = () => Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const SNAP: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 1_000_000 },
  transactions: [
    { id: 'i1', type: 'income', amount: 20_000_000, date: '2026-06-01T03:00:00Z', dateKey: '2026-06-01', weekKey: '2026-W23', monthKey: '2026-06' },
  ],
  budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};

const VALID_JSON = JSON.stringify({
  summary: 'OK.',
  diagnosis: ['Dòng tiền dương.'],
  risks: [],
  opportunities: [],
  actionPlan7Days: ['A', 'B', 'C'],
});

function main() {
  console.log('\nCFO LLM guard');

  it('no generate (no key) -> deterministic fallback', async () => {
    const r = await runCFOAnalysis(SNAP);
    eq(r.deterministicFallback, true);
    ok(r.cfo.actionPlan7Days.length >= 3, 'fallback plan');
    eq(r.context.version, 'cfo_context_v1');
  });

  it('invalid JSON -> fallback', async () => {
    const r = await runCFOAnalysis(SNAP, { generate: async () => ({ content: 'not json' }) });
    eq(r.deterministicFallback, true);
  });

  it('provider throws -> fallback (không crash)', async () => {
    const r = await runCFOAnalysis(SNAP, { generate: async () => { throw new Error('boom'); } });
    eq(r.deterministicFallback, true);
  });

  it('valid JSON -> parsed', async () => {
    const r = await runCFOAnalysis(SNAP, { generate: async () => ({ content: VALID_JSON, provider: 'openai', tokensUsed: 100 }) });
    eq(r.deterministicFallback, false);
    eq(r.cfo.summary, 'OK.');
    eq(r.provider, 'openai');
  });

  console.log('\nCFO LLM guard test complete.');
}

main();
