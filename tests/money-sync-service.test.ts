/* Phase 6B-2A — Sync Service tests (uses mock adapter — no Firebase) */
import { syncMoneyStateOnce } from '@/lib/moneySync/syncService';
import { createMockMoneyAdapter, createFailingMoneyAdapter } from '@/lib/moneySync/firestoreAdapter';
import type { LocalMoneyStateInput } from '@/lib/moneySync/cloudTypes';
import type { UserProfile } from '@/types/user';

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

const NOW = '2026-06-13T05:00:00Z';
const DEVICE = 'dev-svc-test';
const UID = 'uid-svc-test';

const MOCK_USER: UserProfile = {
  uid: UID, displayName: 'Svc User', email: 'svc@test.com', photoURL: null,
  rank: 'iron', xp: 50, streak: 1, lastActiveDate: '2026-06-13',
  resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free',
  premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z',
  updatedAt: NOW,
};

function makeLocalState(overrides: Partial<LocalMoneyStateInput> = {}): LocalMoneyStateInput {
  return {
    uid: UID,
    now: NOW,
    deviceId: DEVICE,
    finance: {
      transactions: [],
      mainBalance: 2000000,
      emergencyBalance: 0,
      billFundBalance: 0,
      fixedBills: [],
      billSnapshots: [],
    },
    budget: {
      carryOver: 0, currentMonth: '2026-06',
      categoryBudgets: [], flaggedCategories: [],
      flaggedTransactionIds: [], monthlySnapshots: [],
      unviewedReportMonth: null, xpAtMonthStart: 0,
    },
    goals: { goals: [] },
    tasks: { tasks: [], xpPenalties: [] },
    auth: { user: MOCK_USER },
    audit: { records: [] },
    ...overrides,
  };
}

// ── Guard tests ───────────────────────────────────────────────────────────────

console.log('\nmoney-sync-service.test.ts');

await it('fails with uid_missing when uid is empty', async () => {
  const r = await syncMoneyStateOnce({
    uid: '',
    adapter: createMockMoneyAdapter(),
    localState: makeLocalState({ uid: '' }),
    now: NOW, deviceId: DEVICE, hydrated: true,
  });
  ok(!r.ok, 'not ok');
  if (!r.ok) eq(r.reason, 'uid_missing', 'reason uid_missing');
});

await it('fails with not_hydrated when hydrated=false', async () => {
  const r = await syncMoneyStateOnce({
    uid: UID,
    adapter: createMockMoneyAdapter(),
    localState: makeLocalState(),
    now: NOW, deviceId: DEVICE, hydrated: false,
  });
  ok(!r.ok, 'not ok');
  if (!r.ok) eq(r.reason, 'not_hydrated', 'reason not_hydrated');
});

await it('fails with user_null when auth.user is null', async () => {
  const r = await syncMoneyStateOnce({
    uid: UID,
    adapter: createMockMoneyAdapter(),
    localState: makeLocalState({ auth: { user: null } }),
    now: NOW, deviceId: DEVICE, hydrated: true,
  });
  ok(!r.ok, 'not ok');
  if (!r.ok) eq(r.reason, 'user_null', 'reason user_null');
});

// ── First sync (no cloud doc) ─────────────────────────────────────────────────

await it('creates cloud doc on first sync', async () => {
  const adapter = createMockMoneyAdapter(null);
  const r = await syncMoneyStateOnce({
    uid: UID, adapter, localState: makeLocalState(), now: NOW, deviceId: DEVICE, hydrated: true,
  });
  ok(r.ok, 'ok');
  if (r.ok) {
    eq(r.action, 'created', 'action created');
    eq(r.conflicts.length, 0, 'no conflicts');
  }
});

await it('first sync — adapter saves the doc', async () => {
  const adapter = createMockMoneyAdapter(null);
  await syncMoneyStateOnce({
    uid: UID, adapter, localState: makeLocalState(), now: NOW, deviceId: DEVICE, hydrated: true,
  });
  const saved = await adapter.load(UID);
  ok(saved !== null, 'doc saved to adapter');
  ok(saved?.version === 'cloud_money_v1', 'version correct');
});

// ── Existing cloud doc → merge ────────────────────────────────────────────────

await it('full sync returns merged action when cloud exists', async () => {
  // Seed cloud with different balance
  const cloudDoc = {
    version: 'cloud_money_v1' as const,
    uid: UID,
    updatedAt: '2026-06-12T00:00:00Z',
    finance: {
      transactions: [], mainBalance: 500000, emergencyBalance: 0,
      billFundBalance: 0, fixedBills: [], billSnapshots: [],
    },
    budget: {
      carryOver: 0, currentMonth: '2026-06', categoryBudgets: [],
      flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [],
      unviewedReportMonth: null, xpAtMonthStart: 0,
    },
    goals: { goals: [] },
    tasks: { tasks: [], xpPenalties: [] },
    authProgress: {
      uid: UID, displayName: 'Old', email: 'svc@test.com', photoURL: null,
      rank: 'iron' as const, xp: 10, streak: 1, lastActiveDate: '2026-06-12',
      resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free' as const,
      premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-06-12T00:00:00Z',
    },
    audit: { records: [] },
    syncMeta: { schemaVersion: 1 as const },
  };
  const adapter = createMockMoneyAdapter(cloudDoc);
  const r = await syncMoneyStateOnce({
    uid: UID, adapter, localState: makeLocalState(), now: NOW, deviceId: DEVICE, hydrated: true,
  });
  ok(r.ok, 'ok');
  if (r.ok) {
    eq(r.action, 'merged', 'action merged');
    ok(r.patch !== null, 'patch returned');
  }
});

await it('full sync — merged doc saved to adapter', async () => {
  const cloudDoc = {
    version: 'cloud_money_v1' as const,
    uid: UID,
    updatedAt: '2026-06-12T00:00:00Z',
    finance: { transactions: [], mainBalance: 999, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] },
    budget: { carryOver: 0, currentMonth: '2026-05', categoryBudgets: [], flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0 },
    goals: { goals: [] }, tasks: { tasks: [], xpPenalties: [] },
    authProgress: { uid: UID, displayName: 'Old', email: 'svc@test.com', photoURL: null, rank: 'iron' as const, xp: 10, streak: 1, lastActiveDate: '2026-06-12', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free' as const, premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-06-12T00:00:00Z' },
    audit: { records: [] }, syncMeta: { schemaVersion: 1 as const },
  };
  const adapter = createMockMoneyAdapter(cloudDoc);
  await syncMoneyStateOnce({ uid: UID, adapter, localState: makeLocalState(), now: NOW, deviceId: DEVICE, hydrated: true });
  const saved = await adapter.load(UID);
  eq(saved?.updatedAt, NOW, 'saved doc has new updatedAt');
});

// ── Adapter error ─────────────────────────────────────────────────────────────

await it('adapter load error → adapter_error result', async () => {
  const r = await syncMoneyStateOnce({
    uid: UID, adapter: createFailingMoneyAdapter('simulated load error'),
    localState: makeLocalState(), now: NOW, deviceId: DEVICE, hydrated: true,
  });
  ok(!r.ok, 'not ok');
  if (!r.ok) {
    eq(r.reason, 'adapter_error', 'reason adapter_error');
    ok(r.error?.includes('simulated load error') ?? false, 'error message propagated');
  }
});

// ── push_only mode ────────────────────────────────────────────────────────────

await it('push_only saves without loading', async () => {
  const adapter = createMockMoneyAdapter(null);
  const r = await syncMoneyStateOnce({
    uid: UID, adapter, localState: makeLocalState(),
    now: NOW, deviceId: DEVICE, hydrated: true, mode: 'push_only',
  });
  ok(r.ok, 'ok');
  if (r.ok) {
    eq(r.action, 'pushed', 'action pushed');
    eq(r.patch, null, 'no patch in push_only');
  }
});

// ── pull_only mode ────────────────────────────────────────────────────────────

await it('pull_only with no cloud doc → noop', async () => {
  const adapter = createMockMoneyAdapter(null);
  const r = await syncMoneyStateOnce({
    uid: UID, adapter, localState: makeLocalState(),
    now: NOW, deviceId: DEVICE, hydrated: true, mode: 'pull_only',
  });
  ok(r.ok, 'ok');
  if (r.ok) eq(r.action, 'noop', 'action noop');
});

await it('pull_only returns patch when cloud doc exists', async () => {
  const cloudDoc = {
    version: 'cloud_money_v1' as const, uid: UID, updatedAt: '2026-06-13T02:00:00Z',
    finance: { transactions: [], mainBalance: 7777777, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] },
    budget: { carryOver: 0, currentMonth: '2026-06', categoryBudgets: [], flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0 },
    goals: { goals: [] }, tasks: { tasks: [], xpPenalties: [] },
    authProgress: { uid: UID, displayName: 'Cloud', email: 'svc@test.com', photoURL: null, rank: 'iron' as const, xp: 100, streak: 1, lastActiveDate: '2026-06-13', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free' as const, premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-06-13T02:00:00Z' },
    audit: { records: [] }, syncMeta: { schemaVersion: 1 as const },
  };
  const adapter = createMockMoneyAdapter(cloudDoc);
  const r = await syncMoneyStateOnce({
    uid: UID, adapter, localState: makeLocalState(),
    now: NOW, deviceId: DEVICE, hydrated: true, mode: 'pull_only',
  });
  ok(r.ok, 'ok');
  if (r.ok) {
    eq(r.action, 'pulled', 'action pulled');
    eq(r.patch?.finance?.mainBalance, 7777777, 'patch has cloud mainBalance');
  }
});
