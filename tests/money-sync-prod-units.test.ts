/* Phase 6B-2E — Flag + outbox persistence + Firestore remote adapter (via fake port) */

import './_setupLocalStorage';
import { isMoneySyncEnabled, __setMoneySyncEnabledForTests } from '@/lib/moneySync/moneySyncFlags';
import {
  persistSyncCursor,
  loadSyncCursor,
  clearSyncCursor,
  clearAllSyncCursors,
} from '@/lib/moneySync/outboxPersistence';
import {
  createRemoteAdapterFromPort,
  type RemoteFirestorePort,
  type RemoteRawRecord,
} from '@/lib/moneySync/firestoreRemoteAdapter';
import { buildSyncEnvelope, type MoneySyncEnvelopeV1 } from '@/lib/moneySync/syncEnvelope';
import type { CloudMoneyDocumentV1 } from '@/lib/moneySync/cloudTypes';
import { enqueuePendingWrite } from '@/lib/moneySync/syncQueue';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T12:00:00Z';

function makeDoc(uid: string, mainBalance: number): CloudMoneyDocumentV1 {
  return {
    version: 'cloud_money_v1', uid, updatedAt: NOW,
    finance: { transactions: [], mainBalance, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] },
    budget: { carryOver: 0, currentMonth: '2026-06', categoryBudgets: [], flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0 },
    goals: { goals: [] }, tasks: { tasks: [], xpPenalties: [] },
    authProgress: { uid, displayName: 'T', email: 't@t.com', photoURL: null, rank: 'iron', xp: 0, streak: 0, lastActiveDate: '2026-06-13', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: NOW },
    audit: { records: [] }, syncMeta: { schemaVersion: 1 },
  };
}
function envOf(uid: string, hash: string, baseVersion: number): MoneySyncEnvelopeV1 {
  return buildSyncEnvelope({ userId: uid, snapshotHash: hash, baseVersion, localVersion: 0, createdAt: NOW, payload: makeDoc(uid, 100) });
}

function makeFakePort(): RemoteFirestorePort & { store: Map<string, RemoteRawRecord> } {
  const store = new Map<string, RemoteRawRecord>();
  return {
    store,
    async getRaw(uid) { return store.get(uid) ?? null; },
    async casSet(uid, expected, next, env) {
      const cur = store.get(uid)?.version ?? 0;
      if (cur !== expected) return 'conflict';
      store.set(uid, { version: next, envelope: env });
      return 'ok';
    },
  };
}

console.log('\nmoney-sync-prod-units.test.ts');

// ─── Flag ───────────────────────────────────────────────────────────────────────

await it('flag default OFF (env not set)', async () => {
  __setMoneySyncEnabledForTests(null);
  eq(isMoneySyncEnabled(), false, 'default off');
});

await it('flag override on/off/reset', async () => {
  __setMoneySyncEnabledForTests(true);
  eq(isMoneySyncEnabled(), true, 'override on');
  __setMoneySyncEnabledForTests(false);
  eq(isMoneySyncEnabled(), false, 'override off');
  __setMoneySyncEnabledForTests(null);
  eq(isMoneySyncEnabled(), false, 'reset → env (off)');
});

// ─── Outbox persistence ──────────────────────────────────────────────────────

await it('persist then load round-trips cursor', async () => {
  clearAllSyncCursors();
  const q = [enqueuePendingWrite('w1', 'user-A', NOW)];
  persistSyncCursor('user-A', { queue: q, baseVersion: 3, lastSyncedHash: 'H', lastSnapshotHash: 'S' });
  const loaded = loadSyncCursor('user-A');
  ok(loaded !== null, 'loaded');
  eq(loaded?.baseVersion, 3, 'baseVersion');
  eq(loaded?.lastSyncedHash, 'H', 'lastSyncedHash');
  eq(loaded?.queue.length, 1, 'queue restored');
  eq(loaded?.queue[0].id, 'w1', 'queue item id');
  clearAllSyncCursors();
});

await it('load returns null when missing', async () => {
  clearAllSyncCursors();
  eq(loadSyncCursor('nobody'), null, 'null missing');
});

await it('load rejects userId mismatch (account safety)', async () => {
  clearAllSyncCursors();
  // ghi thủ công payload có userId khác key
  localStorage.setItem('manicash.moneysync.user-A.v1', JSON.stringify({ version: 1, userId: 'user-EVIL', queue: [], baseVersion: 9, lastSyncedHash: 'x', lastSnapshotHash: 'y' }));
  eq(loadSyncCursor('user-A'), null, 'mismatch → null');
  clearAllSyncCursors();
});

await it('account isolation: A cursor not visible to B', async () => {
  clearAllSyncCursors();
  persistSyncCursor('user-A', { queue: [], baseVersion: 1, lastSyncedHash: 'A', lastSnapshotHash: null });
  persistSyncCursor('user-B', { queue: [], baseVersion: 2, lastSyncedHash: 'B', lastSnapshotHash: null });
  eq(loadSyncCursor('user-A')?.lastSyncedHash, 'A', 'A isolated');
  eq(loadSyncCursor('user-B')?.lastSyncedHash, 'B', 'B isolated');
  clearAllSyncCursors();
});

await it('clearSyncCursor removes one; clearAllSyncCursors removes all', async () => {
  clearAllSyncCursors();
  persistSyncCursor('user-A', { queue: [], baseVersion: 1, lastSyncedHash: 'A', lastSnapshotHash: null });
  persistSyncCursor('user-B', { queue: [], baseVersion: 1, lastSyncedHash: 'B', lastSnapshotHash: null });
  clearSyncCursor('user-A');
  eq(loadSyncCursor('user-A'), null, 'A removed');
  ok(loadSyncCursor('user-B') !== null, 'B still present');
  clearAllSyncCursors();
  eq(loadSyncCursor('user-B'), null, 'all cleared');
});

// ─── Firestore remote adapter (via fake port) ────────────────────────────────

await it('adapter getHead empty → exists false', async () => {
  const adapter = createRemoteAdapterFromPort(makeFakePort());
  const h = await adapter.getHead('u1');
  eq(h.exists, false, 'not exists');
});

await it('adapter first push → version 1, pull returns it', async () => {
  const adapter = createRemoteAdapterFromPort(makeFakePort());
  const res = await adapter.push('u1', envOf('u1', 'H1', 0), 0);
  ok(res.ok, 'push ok');
  if (res.ok) eq(res.version, 1, 'version 1');
  const pull = await adapter.pull('u1');
  ok(pull.ok && pull.exists === true, 'pull exists');
  if (pull.ok && pull.exists) eq(pull.envelope.snapshotHash, 'H1', 'envelope hash');
});

await it('adapter dedup same hash → deduped, version unchanged', async () => {
  const adapter = createRemoteAdapterFromPort(makeFakePort());
  await adapter.push('u1', envOf('u1', 'H1', 0), 0);
  const again = await adapter.push('u1', envOf('u1', 'H1', 1), 1);
  ok(again.ok, 'ok');
  if (again.ok) { eq(again.deduped, true, 'deduped'); eq(again.version, 1, 'version unchanged'); }
});

await it('adapter version bumps on real change', async () => {
  const adapter = createRemoteAdapterFromPort(makeFakePort());
  await adapter.push('u1', envOf('u1', 'H1', 0), 0);
  const changed = await adapter.push('u1', envOf('u1', 'H2', 1), 1);
  ok(changed.ok && changed.version === 2, 'version 2');
});

await it('adapter stale base → conflict', async () => {
  const adapter = createRemoteAdapterFromPort(makeFakePort());
  await adapter.push('u1', envOf('u1', 'H1', 0), 0);
  const stale = await adapter.push('u1', envOf('u1', 'H2', 0), 0);
  ok(!stale.ok, 'not ok');
  if (!stale.ok) eq(stale.reason, 'conflict', 'conflict');
});

await it('adapter user isolation', async () => {
  const port = makeFakePort();
  const adapter = createRemoteAdapterFromPort(port);
  await adapter.push('user-A', envOf('user-A', 'HA', 0), 0);
  await adapter.push('user-B', envOf('user-B', 'HB', 0), 0);
  eq(port.store.size, 2, 'two users');
  const a = await adapter.pull('user-A');
  ok(a.ok && a.exists && a.envelope.userId === 'user-A', 'A isolated');
});

console.log('\nmoney-sync-prod-units test complete.');
