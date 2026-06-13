/* Phase 6B-2D — Suppression guard unit tests (pure) */
import {
  beginSystemApply,
  endSystemApply,
  isSystemApplying,
  resetSuppression,
  runWithSuppression,
} from '@/lib/moneySync/suppressionGuard';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

console.log('\nmoney-sync-suppression.test.ts');

await it('false initially', async () => {
  resetSuppression();
  eq(isSystemApplying(), false, 'initial false');
});

await it('begin → true, end → false', async () => {
  resetSuppression();
  beginSystemApply();
  eq(isSystemApplying(), true, 'true after begin');
  endSystemApply();
  eq(isSystemApplying(), false, 'false after end');
});

await it('re-entrant: nested begin needs matching ends', async () => {
  resetSuppression();
  beginSystemApply();
  beginSystemApply();
  eq(isSystemApplying(), true, 'still true after 2 begins');
  endSystemApply();
  eq(isSystemApplying(), true, 'still true after 1 end (1 begin remaining)');
  endSystemApply();
  eq(isSystemApplying(), false, 'false after 2 ends');
});

await it('end never goes negative', async () => {
  resetSuppression();
  endSystemApply();
  endSystemApply();
  eq(isSystemApplying(), false, 'still false');
  beginSystemApply();
  eq(isSystemApplying(), true, 'one begin → true (no negative offset)');
  endSystemApply();
  eq(isSystemApplying(), false, 'back to false');
});

await it('runWithSuppression: true inside, false after', async () => {
  resetSuppression();
  let insideValue = false;
  runWithSuppression(() => { insideValue = isSystemApplying(); });
  eq(insideValue, true, 'true inside');
  eq(isSystemApplying(), false, 'false after');
});

await it('runWithSuppression auto-clears even when callback throws', async () => {
  resetSuppression();
  let threw = false;
  try {
    runWithSuppression(() => { throw new Error('boom'); });
  } catch { threw = true; }
  ok(threw, 'error propagated');
  eq(isSystemApplying(), false, 'suppression cleared after throw');
});

await it('runWithSuppression returns callback value', async () => {
  resetSuppression();
  const v = runWithSuppression(() => 42);
  eq(v, 42, 'returns value');
});

await it('resetSuppression hard-clears nested depth', async () => {
  resetSuppression();
  beginSystemApply();
  beginSystemApply();
  beginSystemApply();
  resetSuppression();
  eq(isSystemApplying(), false, 'cleared regardless of depth');
});

console.log('\nmoney-sync-suppression test complete.');
