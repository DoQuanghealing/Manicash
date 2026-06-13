/* Phase 6B-2A — Merge / Conflict Engine tests */
import { mergeCloudAndLocal } from '@/lib/moneySync/merge';
import type { CloudMoneyDocumentV1, CloudAuthProgressV1 } from '@/lib/moneySync/cloudTypes';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void {
  if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = '2026-06-13T04:00:00Z';
const DEVICE = 'dev-test-merge';
const UID = 'uid-merge-test';

const AUTH_BASE: CloudAuthProgressV1 = {
  uid: UID, displayName: 'Test', email: 't@t.com', photoURL: null,
  rank: 'iron', xp: 100, streak: 3, lastActiveDate: '2026-06-13',
  resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free',
  premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-06-13T03:00:00Z',
};

function makeDoc(overrides: Partial<CloudMoneyDocumentV1> = {}): CloudMoneyDocumentV1 {
  return {
    version: 'cloud_money_v1',
    uid: UID,
    updatedAt: '2026-06-13T03:00:00Z',
    finance: {
      transactions: [],
      mainBalance: 1000000,
      emergencyBalance: 0,
      billFundBalance: 0,
      fixedBills: [],
      billSnapshots: [],
    },
    budget: {
      carryOver: 0,
      currentMonth: '2026-06',
      categoryBudgets: [],
      flaggedCategories: [],
      flaggedTransactionIds: [],
      monthlySnapshots: [],
      unviewedReportMonth: null,
      xpAtMonthStart: 0,
    },
    goals: { goals: [] },
    tasks: { tasks: [], xpPenalties: [] },
    authProgress: AUTH_BASE,
    audit: { records: [] },
    syncMeta: { schemaVersion: 1 },
    ...overrides,
  };
}

// ── Merge result structure ────────────────────────────────────────────────────

console.log('\nmoney-sync-merge.test.ts');

await it('merge returns merged, source, conflicts keys', async () => {
  const r = mergeCloudAndLocal({ local: makeDoc(), cloud: makeDoc(), now: NOW, deviceId: DEVICE });
  ok('merged' in r && 'source' in r && 'conflicts' in r, 'result shape');
});

await it('merged doc has version cloud_money_v1', async () => {
  const r = mergeCloudAndLocal({ local: makeDoc(), cloud: makeDoc(), now: NOW, deviceId: DEVICE });
  eq(r.merged.version, 'cloud_money_v1', 'version');
});

await it('merged.updatedAt is set to now param', async () => {
  const r = mergeCloudAndLocal({ local: makeDoc(), cloud: makeDoc(), now: NOW, deviceId: DEVICE });
  eq(r.merged.updatedAt, NOW, 'updatedAt');
});

// ── Transaction merge ─────────────────────────────────────────────────────────

await it('local-only transaction is kept', async () => {
  const local = makeDoc({ finance: { ...makeDoc().finance, transactions: [{ id: 'tx-local', amount: 100, type: 'expense', category: 'food', description: '', date: '2026-06-13', createdAt: '2026-06-13T02:00:00Z', updatedAt: '2026-06-13T02:00:00Z' } as never] } });
  const cloud = makeDoc();
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.finance.transactions.some(t => (t as {id: string}).id === 'tx-local'), 'local tx kept');
});

await it('cloud-only transaction is kept', async () => {
  const local = makeDoc();
  const cloud = makeDoc({ finance: { ...makeDoc().finance, transactions: [{ id: 'tx-cloud', amount: 200, type: 'income', category: 'salary', description: '', date: '2026-06-13', createdAt: '2026-06-13T01:00:00Z', updatedAt: '2026-06-13T01:00:00Z' } as never] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.finance.transactions.some(t => (t as {id: string}).id === 'tx-cloud'), 'cloud tx kept');
});

await it('both have same tx id — newer updatedAt wins', async () => {
  const baseTx = { id: 'tx-shared', amount: 100, type: 'expense', category: 'food', description: 'old', date: '2026-06-12', createdAt: '2026-06-12T00:00:00Z' };
  const localTx = { ...baseTx, updatedAt: '2026-06-13T03:00:00Z', description: 'local-newer' };
  const cloudTx = { ...baseTx, updatedAt: '2026-06-12T00:00:00Z', description: 'cloud-older' };
  const local = makeDoc({ finance: { ...makeDoc().finance, transactions: [localTx as never] } });
  const cloud = makeDoc({ finance: { ...makeDoc().finance, transactions: [cloudTx as never] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  const tx = r.merged.finance.transactions.find(t => (t as {id: string}).id === 'tx-shared') as {description: string} | undefined;
  ok(!!tx, 'shared tx exists in merged');
  eq(tx?.description, 'local-newer', 'newer local wins');
});

await it('same tx id — cloud newer wins', async () => {
  const baseTx = { id: 'tx-shared2', amount: 50, type: 'expense', category: 'food', description: 'x', date: '2026-06-12', createdAt: '2026-06-12T00:00:00Z' };
  const localTx = { ...baseTx, updatedAt: '2026-06-11T00:00:00Z', description: 'local-old' };
  const cloudTx = { ...baseTx, updatedAt: '2026-06-13T02:00:00Z', description: 'cloud-new' };
  const local = makeDoc({ finance: { ...makeDoc().finance, transactions: [localTx as never] } });
  const cloud = makeDoc({ finance: { ...makeDoc().finance, transactions: [cloudTx as never] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  const tx = r.merged.finance.transactions.find(t => (t as {id: string}).id === 'tx-shared2') as {description: string} | undefined;
  eq(tx?.description, 'cloud-new', 'newer cloud wins');
});

await it('same tx id no timestamp — local wins and conflict recorded', async () => {
  const localTx = { id: 'tx-no-ts', amount: 75, type: 'expense', category: 'food', description: 'local-val' };
  const cloudTx = { id: 'tx-no-ts', amount: 75, type: 'expense', category: 'food', description: 'cloud-val' };
  const local = makeDoc({ finance: { ...makeDoc().finance, transactions: [localTx as never] } });
  const cloud = makeDoc({ finance: { ...makeDoc().finance, transactions: [cloudTx as never] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  const tx = r.merged.finance.transactions.find(t => (t as {id: string}).id === 'tx-no-ts') as {description: string} | undefined;
  eq(tx?.description, 'local-val', 'local wins on no timestamp');
  ok(r.conflicts.some(c => c.field.includes('tx-no-ts')), 'conflict recorded');
});

// ── Scalar LWW ────────────────────────────────────────────────────────────────

await it('scalar mainBalance — newer document wins', async () => {
  const local = makeDoc({ updatedAt: '2026-06-13T03:00:00Z', finance: { ...makeDoc().finance, mainBalance: 9999 } });
  const cloud = makeDoc({ updatedAt: '2026-06-12T00:00:00Z', finance: { ...makeDoc().finance, mainBalance: 1111 } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.merged.finance.mainBalance, 9999, 'local (newer) mainBalance wins');
});

await it('scalar mainBalance — cloud newer wins', async () => {
  const local = makeDoc({ updatedAt: '2026-06-12T00:00:00Z', finance: { ...makeDoc().finance, mainBalance: 1111 } });
  const cloud = makeDoc({ updatedAt: '2026-06-13T03:00:00Z', finance: { ...makeDoc().finance, mainBalance: 9999 } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.merged.finance.mainBalance, 9999, 'cloud (newer) mainBalance wins');
});

await it('different mainBalance records a conflict', async () => {
  const local = makeDoc({ updatedAt: '2026-06-13T03:00:00Z', finance: { ...makeDoc().finance, mainBalance: 5000 } });
  const cloud = makeDoc({ updatedAt: '2026-06-12T00:00:00Z', finance: { ...makeDoc().finance, mainBalance: 3000 } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.conflicts.some(c => c.field === 'finance.mainBalance'), 'mainBalance conflict recorded');
});

// ── Audit merge ───────────────────────────────────────────────────────────────

await it('audit dedup by id', async () => {
  const rec = { id: 'a1', actionType: 'add_transaction', createdAt: '2026-06-13T01:00:00Z', snapshot: {} as never, reversalSnapshot: {} as never };
  const local = makeDoc({ audit: { records: [rec as never] } });
  const cloud = makeDoc({ audit: { records: [rec as never] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.merged.audit.records.filter(x => x.id === 'a1').length, 1, 'audit dedup');
});

await it('audit cap at 200', async () => {
  const localRecs = Array.from({ length: 150 }, (_, i) => ({
    id: `a-local-${i}`, actionType: 'add_transaction', createdAt: `2026-06-01T0${(i % 10)}:00:00Z`, snapshot: {} as never, reversalSnapshot: {} as never,
  }));
  const cloudRecs = Array.from({ length: 150 }, (_, i) => ({
    id: `a-cloud-${i}`, actionType: 'add_transaction', createdAt: `2026-06-02T0${(i % 10)}:00:00Z`, snapshot: {} as never, reversalSnapshot: {} as never,
  }));
  const local = makeDoc({ audit: { records: localRecs as never } });
  const cloud = makeDoc({ audit: { records: cloudRecs as never } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.audit.records.length <= 200, `audit capped at 200, got ${r.merged.audit.records.length}`);
});

await it('audit newest first after merge', async () => {
  const old = { id: 'a-old', actionType: 'add_transaction', createdAt: '2026-06-10T00:00:00Z', snapshot: {} as never, reversalSnapshot: {} as never };
  const newer = { id: 'a-new', actionType: 'add_transaction', createdAt: '2026-06-13T00:00:00Z', snapshot: {} as never, reversalSnapshot: {} as never };
  const local = makeDoc({ audit: { records: [old as never] } });
  const cloud = makeDoc({ audit: { records: [newer as never] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.merged.audit.records[0].id, 'a-new', 'newest first');
});

// ── Budget flags union ────────────────────────────────────────────────────────

await it('flaggedCategories is a union (never loses flags)', async () => {
  const local = makeDoc({ budget: { ...makeDoc().budget, flaggedCategories: ['cat-A'] } });
  const cloud = makeDoc({ budget: { ...makeDoc().budget, flaggedCategories: ['cat-B'] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.budget.flaggedCategories.includes('cat-A'), 'cat-A present');
  ok(r.merged.budget.flaggedCategories.includes('cat-B'), 'cat-B present');
});

await it('flaggedTransactionIds is a union', async () => {
  const local = makeDoc({ budget: { ...makeDoc().budget, flaggedTransactionIds: ['tx-A'] } });
  const cloud = makeDoc({ budget: { ...makeDoc().budget, flaggedTransactionIds: ['tx-B'] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.budget.flaggedTransactionIds.includes('tx-A'), 'tx-A present');
  ok(r.merged.budget.flaggedTransactionIds.includes('tx-B'), 'tx-B present');
});

// ── Source field ──────────────────────────────────────────────────────────────

await it('source is local when no conflicts and local newer', async () => {
  const local = makeDoc({ updatedAt: '2026-06-13T05:00:00Z' });
  const cloud = makeDoc({ updatedAt: '2026-06-12T00:00:00Z' });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.source, 'local', 'source local');
});

await it('source is cloud when no conflicts and cloud newer', async () => {
  const local = makeDoc({ updatedAt: '2026-06-11T00:00:00Z' });
  const cloud = makeDoc({ updatedAt: '2026-06-13T05:00:00Z' });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.source, 'cloud', 'source cloud');
});

await it('source is merged when conflicts exist', async () => {
  const local = makeDoc({ updatedAt: '2026-06-13T05:00:00Z', finance: { ...makeDoc().finance, mainBalance: 100 } });
  const cloud = makeDoc({ updatedAt: '2026-06-12T00:00:00Z', finance: { ...makeDoc().finance, mainBalance: 999 } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  eq(r.source, 'merged', 'source merged when conflicts');
});

// ── Goals merge ───────────────────────────────────────────────────────────────

await it('local-only goal is kept', async () => {
  const local = makeDoc({ goals: { goals: [{ id: 'g1', name: 'Emergency Fund', targetAmount: 10000000, savedAmount: 0, deadline: '2026-12-31', createdAt: NOW, updatedAt: NOW } as never] } });
  const cloud = makeDoc();
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.goals.goals.some(g => (g as {id: string}).id === 'g1'), 'local goal kept');
});

// ── xpPenalties — local wins ──────────────────────────────────────────────────

await it('xpPenalties always takes local value', async () => {
  const pen = { taskId: 't1', penaltyMultiplier: 0.7, remainingTasks: 2 };
  const local = makeDoc({ tasks: { tasks: [], xpPenalties: [pen as never] } });
  const cloud = makeDoc({ tasks: { tasks: [], xpPenalties: [] } });
  const r = mergeCloudAndLocal({ local, cloud, now: NOW, deviceId: DEVICE });
  ok(r.merged.tasks.xpPenalties.length === 1, 'xpPenalties from local (length 1)');
  eq((r.merged.tasks.xpPenalties[0] as {taskId: string}).taskId, 't1', 'xpPenalty taskId');
});
