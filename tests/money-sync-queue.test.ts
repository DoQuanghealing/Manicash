/* Phase 6B-2A — Sync Queue model tests */
import {
  enqueuePendingWrite,
  incrementPendingWriteAttempt,
  markPendingWriteFlushed,
  markPendingWriteFailed,
  getPendingRetryable,
  MAX_PENDING_WRITE_ATTEMPTS,
} from '@/lib/moneySync/syncQueue';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void {
  if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T06:00:00Z';
const UID = 'uid-queue-test';

console.log('\nmoney-sync-queue.test.ts');

// ── enqueue ───────────────────────────────────────────────────────────────────

await it('enqueuePendingWrite creates a pending record', async () => {
  const r = enqueuePendingWrite('write-1', UID, NOW);
  eq(r.id, 'write-1', 'id');
  eq(r.uid, UID, 'uid');
  eq(r.enqueuedAt, NOW, 'enqueuedAt');
  eq(r.status, 'pending', 'status pending');
  eq(r.attempts, 0, 'attempts 0');
  eq(r.lastAttemptAt, null, 'lastAttemptAt null');
  eq(r.failReason, null, 'failReason null');
});

// ── incrementAttempt ──────────────────────────────────────────────────────────

await it('incrementPendingWriteAttempt increments attempts', async () => {
  const r = enqueuePendingWrite('w2', UID, NOW);
  const r2 = incrementPendingWriteAttempt(r, NOW);
  eq(r2.attempts, 1, 'attempts 1');
  eq(r2.lastAttemptAt, NOW, 'lastAttemptAt set');
});

await it('incrementPendingWriteAttempt does not mutate original', async () => {
  const r = enqueuePendingWrite('w3', UID, NOW);
  const r2 = incrementPendingWriteAttempt(r, NOW);
  eq(r.attempts, 0, 'original unchanged');
  eq(r2.attempts, 1, 'new record incremented');
});

// ── markFlushed ───────────────────────────────────────────────────────────────

await it('markPendingWriteFlushed sets status to flushed', async () => {
  const r = enqueuePendingWrite('w4', UID, NOW);
  const flushed = markPendingWriteFlushed(r, NOW);
  eq(flushed.status, 'flushed', 'status flushed');
  eq(flushed.failReason, null, 'failReason cleared');
});

await it('markPendingWriteFlushed sets lastAttemptAt', async () => {
  const r = enqueuePendingWrite('w5', UID, NOW);
  const FLUSH_AT = '2026-06-13T06:30:00Z';
  const flushed = markPendingWriteFlushed(r, FLUSH_AT);
  eq(flushed.lastAttemptAt, FLUSH_AT, 'lastAttemptAt updated');
});

// ── markFailed ────────────────────────────────────────────────────────────────

await it('markPendingWriteFailed increments attempts', async () => {
  const r = enqueuePendingWrite('w6', UID, NOW);
  const failed = markPendingWriteFailed(r, NOW, 'network error');
  eq(failed.attempts, 1, 'attempts incremented');
  eq(failed.failReason, 'network error', 'failReason set');
});

await it('markPendingWriteFailed stays pending below maxAttempts', async () => {
  let r = enqueuePendingWrite('w7', UID, NOW);
  r = markPendingWriteFailed(r, NOW, 'err1');
  eq(r.status, 'pending', `status pending after 1 attempt (max=${MAX_PENDING_WRITE_ATTEMPTS})`);
});

await it(`markPendingWriteFailed sets status to failed at maxAttempts=${MAX_PENDING_WRITE_ATTEMPTS}`, async () => {
  let r = enqueuePendingWrite('w8', UID, NOW);
  for (let i = 0; i < MAX_PENDING_WRITE_ATTEMPTS; i++) {
    r = markPendingWriteFailed(r, NOW, `err${i}`);
  }
  eq(r.status, 'failed', 'status failed after max attempts');
  eq(r.attempts, MAX_PENDING_WRITE_ATTEMPTS, 'attempts at max');
});

await it('markPendingWriteFailed does not mutate original', async () => {
  const r = enqueuePendingWrite('w9', UID, NOW);
  markPendingWriteFailed(r, NOW, 'err');
  eq(r.attempts, 0, 'original attempts unchanged');
});

// ── getPendingRetryable ───────────────────────────────────────────────────────

await it('getPendingRetryable returns only pending records below maxAttempts', async () => {
  const r1 = enqueuePendingWrite('r1', UID, NOW);
  const r2 = markPendingWriteFlushed(enqueuePendingWrite('r2', UID, NOW), NOW);
  let r3 = enqueuePendingWrite('r3', UID, NOW);
  for (let i = 0; i < MAX_PENDING_WRITE_ATTEMPTS; i++) r3 = markPendingWriteFailed(r3, NOW, 'e');

  const retryable = getPendingRetryable([r1, r2, r3]);
  eq(retryable.length, 1, 'only r1 is retryable');
  eq(retryable[0].id, 'r1', 'r1 returned');
});

await it('getPendingRetryable returns empty list when all done', async () => {
  const r1 = markPendingWriteFlushed(enqueuePendingWrite('done1', UID, NOW), NOW);
  let r2 = enqueuePendingWrite('done2', UID, NOW);
  for (let i = 0; i < MAX_PENDING_WRITE_ATTEMPTS; i++) r2 = markPendingWriteFailed(r2, NOW, 'e');

  const retryable = getPendingRetryable([r1, r2]);
  eq(retryable.length, 0, 'nothing retryable');
});
