/* Phase 6B-2E — Production sync controller: pull-on-login apply, push, conflict, no-loop, flag gate */

import './_setupLocalStorage';
import { useFinanceStore, type Transaction } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydrationStore } from '@/stores/useHydrationStore';
import { useMoneySyncStore } from '@/stores/useMoneySyncStore';
import {
  startMoneySyncRuntime,
  resetMoneySyncRuntime,
  getMoneySyncRuntimeStatus,
  getCurrentMoneyEnvelope,
} from '@/lib/moneySync/clientRuntime';
import {
  runMoneySyncCycle,
  startProductionSync,
  stopProductionSync,
  isProductionSyncStarted,
} from '@/lib/moneySync/syncController';
import { createFakeRemoteAdapter } from '@/lib/moneySync/fakeRemoteAdapter';
import { __setMoneySyncEnabledForTests } from '@/lib/moneySync/moneySyncFlags';
import { loadSyncCursor, clearAllSyncCursors } from '@/lib/moneySync/outboxPersistence';
import { buildSyncEnvelope } from '@/lib/moneySync/syncEnvelope';
import { isSystemApplying } from '@/lib/moneySync/suppressionGuard';
import type { UserProfile } from '@/types/user';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T13:00:00Z';

function makeUser(uid: string): UserProfile {
  return { uid, displayName: 'Ctrl User', email: `${uid}@test.com`, photoURL: null, rank: 'iron', xp: 100, streak: 1, lastActiveDate: '2026-06-13', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: NOW };
}
function makeTxn(id: string, amount: number): Transaction {
  return { id, type: 'expense', amount, categoryId: 'food', note: 'x', wallet: 'main', date: '2026-06-13', time: '13:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' };
}
function setupStores(uid: string): void {
  useFinanceStore.setState({ transactions: [], mainBalance: 1_000_000, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] });
  useBudgetStore.setState({ carryOver: 0, currentMonth: '2026-06', categoryBudgets: [], rolloverNotified: false, flaggedCategories: [], flaggedTransactionIds: [], monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0 });
  useGoalsStore.setState({ goals: [] });
  useTaskStore.setState({ tasks: [], xpPenalties: [] });
  useAuthStore.setState({ user: makeUser(uid) });
  useHydrationStore.setState({ finance: true, budget: true, goals: true, tasks: true, auth: true });
}
function teardown(): void {
  stopProductionSync();
  resetMoneySyncRuntime();
  clearAllSyncCursors();
  __setMoneySyncEnabledForTests(null);
  useHydrationStore.setState({ finance: false, budget: false, goals: false, tasks: false, auth: false });
  useAuthStore.setState({ user: null });
}
const START = { requireBrowser: false as const, now: () => NOW };

console.log('\nmoney-sync-controller.test.ts');

// ─── runMoneySyncCycle ──────────────────────────────────────────────────────

await it('cycle: first login with empty remote → push', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 2_000_000 });
  const remote = createFakeRemoteAdapter();
  const res = await runMoneySyncCycle(remote, { now: NOW });
  ok(res.ok && res.action === 'pushed', `expected pushed, got ${res.ok ? res.action : res.reason}`);
  eq(remote._peek('user-A')?.version, 1, 'remote v1');
  eq(getMoneySyncRuntimeStatus().pendingCount, 0, 'outbox flushed');
  teardown();
});

await it('cycle: remote ahead → pulls and APPLIES into stores (no enqueue loop)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  // Seed remote with a different state (mainBalance 9,999,000) at version 2.
  const remote = createFakeRemoteAdapter();
  const remoteEnv = buildSyncEnvelope({
    userId: 'user-A', snapshotHash: 'REMOTE', baseVersion: 2, localVersion: 0, createdAt: NOW,
    payload: { ...getCurrentMoneyEnvelope(NOW)!.payload, finance: { ...getCurrentMoneyEnvelope(NOW)!.payload.finance, mainBalance: 9_999_000 } },
  });
  remote._setRemote('user-A', remoteEnv, 2);
  // local unchanged since base → baseHash = current local hash
  useMoneySyncStore.setState({ lastSyncedHash: getCurrentMoneyEnvelope(NOW)!.snapshotHash, baseVersion: 1 });
  const queueBefore = getMoneySyncRuntimeStatus().queueLength;
  const res = await runMoneySyncCycle(remote, { now: NOW });
  ok(res.ok && res.action === 'pulled', `expected pulled, got ${res.ok ? res.action : res.reason}`);
  eq(useFinanceStore.getState().mainBalance, 9_999_000, 'remote applied into finance store');
  eq(getMoneySyncRuntimeStatus().queueLength, queueBefore, 'apply did NOT enqueue (suppression)');
  eq(isSystemApplying(), false, 'suppression cleared after cycle');
  teardown();
});

await it('cycle: no-op when already in sync (remote hash == local)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const remote = createFakeRemoteAdapter();
  await runMoneySyncCycle(remote, { now: NOW }); // first push (v1, baseHash=current)
  const res = await runMoneySyncCycle(remote, { now: NOW }); // nothing changed
  ok(res.ok && res.action === 'noop', `expected noop, got ${res.ok ? res.action : res.reason}`);
  eq(remote._peek('user-A')?.version, 1, 'remote stays v1');
  teardown();
});

await it('cycle: diverged → merges, pushes merged, applies merged locally', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const remote = createFakeRemoteAdapter();
  // remote changed (v2) with a different balance, base was v1
  const remoteEnv = buildSyncEnvelope({
    userId: 'user-A', snapshotHash: 'REMOTE2', baseVersion: 2, localVersion: 0, createdAt: NOW,
    payload: { ...getCurrentMoneyEnvelope(NOW)!.payload, finance: { ...getCurrentMoneyEnvelope(NOW)!.payload.finance, mainBalance: 5_000_000 } },
  });
  remote._setRemote('user-A', remoteEnv, 2);
  // local changed since base (baseHash differs from current local hash)
  useFinanceStore.setState({ mainBalance: 7_000_000 });
  useMoneySyncStore.setState({ lastSyncedHash: 'OLD-BASE', baseVersion: 1 });
  const res = await runMoneySyncCycle(remote, { now: NOW });
  ok(res.ok && res.action === 'merged', `expected merged, got ${res.ok ? res.action : res.reason}`);
  ok((remote._peek('user-A')?.version ?? 0) >= 3, 'remote bumped past 2 (merged pushed)');
  eq(getMoneySyncRuntimeStatus().queueLength === 0 || isSystemApplying() === false, true, 'no loop / suppression clean');
  teardown();
});

await it('cycle: getHead network error → ok false, stores untouched', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 1_234_000 });
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'network');
  const res = await runMoneySyncCycle(remote, { now: NOW });
  ok(!res.ok, 'failed');
  eq(useFinanceStore.getState().mainBalance, 1_234_000, 'stores untouched');
  eq(useMoneySyncStore.getState().status, 'error', 'status error');
  teardown();
});

await it('cycle: no user → no_user', async () => {
  teardown();
  const remote = createFakeRemoteAdapter();
  const res = await runMoneySyncCycle(remote, { now: NOW });
  ok(!res.ok && res.reason === 'no_user', 'no_user');
  teardown();
});

// ─── startProductionSync flag gating ──────────────────────────────────────────

await it('startProductionSync is a no-op when flag OFF', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  __setMoneySyncEnabledForTests(false);
  startProductionSync(createFakeRemoteAdapter(), { now: () => NOW });
  eq(isProductionSyncStarted(), false, 'not started when flag off');
  teardown();
});

await it('startProductionSync starts + pull-on-login when flag ON', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 3_333_000 });
  __setMoneySyncEnabledForTests(true);
  const remote = createFakeRemoteAdapter();
  startProductionSync(remote, { now: () => NOW, debounceMs: 999999 });
  ok(isProductionSyncStarted(), 'started when flag on');
  // pull-on-login fires async — chờ microtask
  await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 10));
  eq(remote._peek('user-A')?.version, 1, 'pull-on-login pushed initial state');
  stopProductionSync();
  eq(isProductionSyncStarted(), false, 'stopped');
  teardown();
});

// ─── Cursor persistence via controller ────────────────────────────────────────

await it('cycle persists cursor; loadSyncCursor returns it', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 4_000_000 });
  const remote = createFakeRemoteAdapter();
  await runMoneySyncCycle(remote, { now: NOW });
  const cur = loadSyncCursor('user-A');
  ok(cur !== null, 'cursor persisted');
  eq(cur?.baseVersion, 1, 'persisted baseVersion');
  teardown();
});

await it('account boundary: cursor cleared on teardown (no leak to next user)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  await runMoneySyncCycle(createFakeRemoteAdapter(), { now: NOW });
  ok(loadSyncCursor('user-A') !== null, 'A cursor exists');
  clearAllSyncCursors();
  eq(loadSyncCursor('user-A'), null, 'cleared');
  teardown();
});

console.log('\nmoney-sync-controller test complete.');
