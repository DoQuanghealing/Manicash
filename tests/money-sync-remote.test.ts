/* Phase 6B-2C — Remote adapter contract + fake remote + conflict simulation (pure) */
import { decideSyncAction, type RemoteMoneyHead } from '@/lib/moneySync/remoteAdapter';
import { createFakeRemoteAdapter } from '@/lib/moneySync/fakeRemoteAdapter';
import { buildSyncEnvelope, isMoneySyncEnvelopeV1, type MoneySyncEnvelopeV1 } from '@/lib/moneySync/syncEnvelope';
import { simulateRemoteSyncOnce } from '@/lib/moneySync/remoteSyncService';
import type { CloudMoneyDocumentV1, CloudAuthProgressV1 } from '@/lib/moneySync/cloudTypes';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T09:00:00Z';
const DEVICE = 'dev-remote-test';

const AUTH: CloudAuthProgressV1 = {
  uid: 'u', displayName: 'T', email: 't@t.com', photoURL: null, rank: 'iron',
  xp: 0, streak: 0, lastActiveDate: '2026-06-13', resistCount: 0, totalResistSaved: 0,
  isPremium: false, plan: 'free', premiumExpiresAt: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: NOW,
};

function makeDoc(uid: string, mainBalance: number, updatedAt = NOW): CloudMoneyDocumentV1 {
  return {
    version: 'cloud_money_v1', uid, updatedAt,
    finance: { transactions: [], mainBalance, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] },
    budget: { carryOver: 0, currentMonth: '2026-06', categoryBudgets: [], flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0 },
    goals: { goals: [] }, tasks: { tasks: [], xpPenalties: [] },
    authProgress: { ...AUTH, uid }, audit: { records: [] }, syncMeta: { schemaVersion: 1 },
  };
}

function makeEnvelope(uid: string, hash: string, baseVersion: number, mainBalance = 100, updatedAt = NOW): MoneySyncEnvelopeV1 {
  return buildSyncEnvelope({
    userId: uid, snapshotHash: hash, baseVersion, localVersion: 0,
    createdAt: NOW, payload: makeDoc(uid, mainBalance, updatedAt),
  });
}

function head(exists: boolean, version: number, snapshotHash: string | null): RemoteMoneyHead {
  return { exists, version, snapshotHash, updatedAt: exists ? NOW : null };
}

console.log('\nmoney-sync-remote.test.ts');

// ─── decideSyncAction (pure) ──────────────────────────────────────────────────

await it('decision: remote empty → push remote_empty', async () => {
  const d = decideSyncAction({ localHash: 'L', baseHash: null, baseVersion: 0, remote: head(false, 0, null) });
  eq(d.kind, 'push', 'kind'); eq(d.reason, 'remote_empty', 'reason');
});

await it('decision: remote hash == local → noop same_hash', async () => {
  const d = decideSyncAction({ localHash: 'L', baseHash: 'L', baseVersion: 1, remote: head(true, 1, 'L') });
  eq(d.kind, 'noop', 'kind'); eq(d.reason, 'same_hash', 'reason');
});

await it('decision: local changed, remote unchanged → push local_ahead', async () => {
  const d = decideSyncAction({ localHash: 'L2', baseHash: 'L1', baseVersion: 1, remote: head(true, 1, 'L1') });
  eq(d.kind, 'push', 'kind'); eq(d.reason, 'local_ahead', 'reason');
});

await it('decision: local unchanged, remote changed → pull remote_ahead', async () => {
  const d = decideSyncAction({ localHash: 'L1', baseHash: 'L1', baseVersion: 1, remote: head(true, 2, 'R2') });
  eq(d.kind, 'pull', 'kind'); eq(d.reason, 'remote_ahead', 'reason');
});

await it('decision: both changed from same base → conflict diverged', async () => {
  const d = decideSyncAction({ localHash: 'L2', baseHash: 'L1', baseVersion: 1, remote: head(true, 2, 'R2') });
  eq(d.kind, 'conflict', 'kind'); eq(d.reason, 'diverged', 'reason');
});

await it('decision: nothing changed (different hash, same versions) → noop in_sync', async () => {
  const d = decideSyncAction({ localHash: 'L1', baseHash: 'L1', baseVersion: 2, remote: head(true, 2, 'R-other') });
  eq(d.kind, 'noop', 'kind'); eq(d.reason, 'in_sync', 'reason');
});

// ─── envelope ─────────────────────────────────────────────────────────────────

await it('buildSyncEnvelope sets version tag + fields; type guard accepts it', async () => {
  const env = makeEnvelope('u1', 'H1', 0);
  eq(env.envelopeVersion, 'money_sync_envelope_v1', 'tag');
  ok(isMoneySyncEnvelopeV1(env), 'type guard true');
  ok(!isMoneySyncEnvelopeV1({ envelopeVersion: 'x' }), 'type guard false for junk');
});

await it('buildSyncEnvelope throws on empty userId', async () => {
  let threw = false;
  try { makeEnvelope('', 'H', 0); } catch { threw = true; }
  ok(threw, 'throws empty uid');
});

// ─── fake remote adapter ──────────────────────────────────────────────────────

await it('fake: getHead on empty remote → exists false, version 0', async () => {
  const remote = createFakeRemoteAdapter();
  const h = await remote.getHead('u1');
  eq(h.exists, false, 'not exists'); eq(h.version, 0, 'version 0');
});

await it('fake: first push → version 1, head exists', async () => {
  const remote = createFakeRemoteAdapter();
  const res = await remote.push('u1', makeEnvelope('u1', 'H1', 0), 0);
  ok(res.ok, 'push ok');
  if (res.ok) { eq(res.version, 1, 'version 1'); eq(res.deduped, false, 'not deduped'); eq(res.head.exists, true, 'head exists'); }
});

await it('fake: pull existing returns envelope; pull empty returns exists false', async () => {
  const remote = createFakeRemoteAdapter();
  const empty = await remote.pull('u1');
  ok(empty.ok && empty.exists === false, 'empty pull');
  await remote.push('u1', makeEnvelope('u1', 'H1', 0), 0);
  const got = await remote.pull('u1');
  ok(got.ok && got.exists === true, 'pull existing');
  if (got.ok && got.exists) eq(got.envelope.snapshotHash, 'H1', 'envelope hash');
});

await it('fake: push same snapshot hash → deduped, version unchanged', async () => {
  const remote = createFakeRemoteAdapter();
  await remote.push('u1', makeEnvelope('u1', 'H1', 0), 0); // v1
  const again = await remote.push('u1', makeEnvelope('u1', 'H1', 1), 1); // same hash
  ok(again.ok, 'ok');
  if (again.ok) { eq(again.deduped, true, 'deduped'); eq(again.version, 1, 'version unchanged'); }
});

await it('fake: version increments only on real change', async () => {
  const remote = createFakeRemoteAdapter();
  await remote.push('u1', makeEnvelope('u1', 'H1', 0), 0); // v1
  const changed = await remote.push('u1', makeEnvelope('u1', 'H2', 1), 1); // new hash
  ok(changed.ok && changed.version === 2, 'version 2 on change');
});

await it('fake: stale base version → conflict result', async () => {
  const remote = createFakeRemoteAdapter();
  await remote.push('u1', makeEnvelope('u1', 'H1', 0), 0); // v1
  const stale = await remote.push('u1', makeEnvelope('u1', 'H2', 0), 0); // expects base 0 but remote is 1
  ok(!stale.ok, 'not ok');
  if (!stale.ok) { eq(stale.reason, 'conflict', 'conflict'); }
});

await it('fake: network error injection on getHead (one-shot) then recovers', async () => {
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'network');
  let threw = false;
  try { await remote.getHead('u1'); } catch { threw = true; }
  ok(threw, 'first getHead throws');
  const h = await remote.getHead('u1'); // recovered
  eq(h.exists, false, 'second getHead ok');
});

await it('fake: permission error injection on pull', async () => {
  const remote = createFakeRemoteAdapter();
  remote._failNext('pull', 'permission');
  const res = await remote.pull('u1');
  ok(!res.ok, 'pull failed');
  if (!res.ok) eq(res.error.kind, 'permission', 'permission error');
});

await it('fake: user A and user B are isolated', async () => {
  const remote = createFakeRemoteAdapter();
  await remote.push('user-A', makeEnvelope('user-A', 'HA', 0), 0);
  await remote.push('user-B', makeEnvelope('user-B', 'HB', 0), 0);
  eq(remote._userCount(), 2, 'two users');
  const a = await remote.pull('user-A');
  const b = await remote.pull('user-B');
  ok(a.ok && a.exists && a.envelope.snapshotHash === 'HA', 'A isolated');
  ok(b.ok && b.exists && b.envelope.snapshotHash === 'HB', 'B isolated');
});

// ─── simulateRemoteSyncOnce ───────────────────────────────────────────────────

await it('service: first push to empty remote → pushed v1', async () => {
  const remote = createFakeRemoteAdapter();
  const out = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote, localEnvelope: makeEnvelope('u1', 'H1', 0),
    baseHash: null, now: NOW, deviceId: DEVICE,
  });
  ok(out.ok, 'ok');
  if (out.ok && out.action === 'pushed') eq(out.remoteVersion, 1, 'version 1');
  else throw new Error(`expected pushed, got ${out.ok ? out.action : out.reason}`);
});

await it('service: no-op when remote hash equals local hash', async () => {
  const remote = createFakeRemoteAdapter();
  remote._setRemote('u1', makeEnvelope('u1', 'SAME', 1), 1);
  const out = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote, localEnvelope: makeEnvelope('u1', 'SAME', 1),
    baseHash: 'SAME', now: NOW, deviceId: DEVICE,
  });
  ok(out.ok && out.action === 'noop', 'noop');
});

await it('service: remote ahead + local unchanged → pulled with patch', async () => {
  const remote = createFakeRemoteAdapter();
  remote._setRemote('u1', makeEnvelope('u1', 'R2', 2, 999), 2);
  const out = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote, localEnvelope: makeEnvelope('u1', 'L1', 1, 100),
    baseHash: 'L1', now: NOW, deviceId: DEVICE, // local unchanged since base, remote moved
  });
  ok(out.ok, 'ok');
  if (out.ok && out.action === 'pulled') {
    eq(out.remoteVersion, 2, 'remote version 2');
    eq(out.patch.finance?.mainBalance, 999, 'patch carries remote balance');
  } else throw new Error(`expected pulled, got ${out.ok ? out.action : out.reason}`);
});

await it('service: diverged → merged preview + conflicts (no push when applyMerge=false)', async () => {
  const remote = createFakeRemoteAdapter();
  remote._setRemote('u1', makeEnvelope('u1', 'R2', 2, 555), 2);
  const out = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote,
    localEnvelope: makeEnvelope('u1', 'L2', 1, 777), // local changed since base L1
    baseHash: 'L1', now: NOW, deviceId: DEVICE, applyMerge: false,
  });
  ok(out.ok, 'ok');
  if (out.ok && out.action === 'merged') {
    ok(out.mergedPreview.version === 'cloud_money_v1', 'merged preview present');
    ok(out.conflicts.length >= 1, 'conflicts recorded (balances differ)');
    eq(out.pushedMerge, false, 'not pushed when applyMerge=false');
    eq(remote._peek('u1')?.version, 2, 'remote untouched');
  } else throw new Error(`expected merged, got ${out.ok ? out.action : out.reason}`);
});

await it('service: diverged with applyMerge=true → pushes merged, version bumps', async () => {
  const remote = createFakeRemoteAdapter();
  remote._setRemote('u1', makeEnvelope('u1', 'R2', 2, 555), 2);
  const out = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote,
    localEnvelope: makeEnvelope('u1', 'L2', 1, 777),
    baseHash: 'L1', now: NOW, deviceId: DEVICE, applyMerge: true,
  });
  ok(out.ok && out.action === 'merged', 'merged');
  if (out.ok && out.action === 'merged') {
    eq(out.pushedMerge, true, 'merged pushed');
    eq(out.remoteVersion, 3, 'remote bumped to 3');
  }
});

await it('service: network error on getHead → ok false error network', async () => {
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'network');
  const out = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote, localEnvelope: makeEnvelope('u1', 'H1', 0),
    baseHash: null, now: NOW, deviceId: DEVICE,
  });
  ok(!out.ok, 'failed');
  if (!out.ok) { eq(out.reason, 'error', 'error reason'); eq(out.error?.kind, 'network', 'network kind'); }
});

await it('service: retry after transient error succeeds (no duplicate remote record)', async () => {
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'network');
  const fail = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote, localEnvelope: makeEnvelope('u1', 'H1', 0),
    baseHash: null, now: NOW, deviceId: DEVICE,
  });
  ok(!fail.ok, 'first attempt failed');
  const retry = await simulateRemoteSyncOnce({
    userId: 'u1', adapter: remote, localEnvelope: makeEnvelope('u1', 'H1', 0),
    baseHash: null, now: NOW, deviceId: DEVICE,
  });
  ok(retry.ok && retry.action === 'pushed', 'retry pushed');
  eq(remote._peek('u1')?.version, 1, 'single remote record (no duplicate)');
});

await it('service: empty userId → uid_missing', async () => {
  const remote = createFakeRemoteAdapter();
  const out = await simulateRemoteSyncOnce({
    userId: '', adapter: remote, localEnvelope: makeEnvelope('u1', 'H1', 0),
    baseHash: null, now: NOW, deviceId: DEVICE,
  });
  ok(!out.ok && out.reason === 'uid_missing', 'uid_missing');
});

console.log('\nmoney-sync-remote test complete.');
