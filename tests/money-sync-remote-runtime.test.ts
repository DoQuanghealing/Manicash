/* Phase 6B-2C — Remote sync via runtime: simulate flush, user isolation, account boundary, store safety */

// PHẢI import đầu tiên: localStorage mock TRƯỚC khi store (persist) được import.
import './_setupLocalStorage';
import { useFinanceStore, type Transaction } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydrationStore } from '@/stores/useHydrationStore';
import { useMoneySyncStore } from '@/stores/useMoneySyncStore';
import { clearLocalMoneyPersistence } from '@/stores/clearLocalPersistence';
import {
  startMoneySyncRuntime,
  resetMoneySyncRuntime,
  getMoneySyncRuntimeStatus,
  simulateRemoteSyncForTests,
  getCurrentMoneyEnvelope,
} from '@/lib/moneySync/clientRuntime';
import { createFakeRemoteAdapter } from '@/lib/moneySync/fakeRemoteAdapter';
import type { UserProfile } from '@/types/user';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T10:00:00Z';

function makeUser(uid: string): UserProfile {
  return {
    uid, displayName: 'Remote User', email: `${uid}@test.com`, photoURL: null,
    rank: 'iron', xp: 100, streak: 1, lastActiveDate: '2026-06-13',
    resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free',
    premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: NOW,
  };
}

function makeTxn(id: string, amount: number): Transaction {
  return { id, type: 'expense', amount, categoryId: 'food', note: 'x', wallet: 'main', date: '2026-06-13', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' };
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
  resetMoneySyncRuntime();
  useHydrationStore.setState({ finance: false, budget: false, goals: false, tasks: false, auth: false });
  useAuthStore.setState({ user: null });
}

const START = { requireBrowser: false as const, now: () => NOW };

console.log('\nmoney-sync-remote-runtime.test.ts');

await it('getCurrentMoneyEnvelope returns null without a runtime user', async () => {
  teardown();
  eq(getCurrentMoneyEnvelope(NOW), null, 'null when no user');
});

await it('runtime simulate flush pushes to fake remote (first push v1, outbox flushed)', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState((s) => ({ transactions: [...s.transactions, makeTxn('tx1', 50_000)] }));
  ok(getMoneySyncRuntimeStatus().queueLength >= 1, 'queued after mutation');
  const remote = createFakeRemoteAdapter();
  const out = await simulateRemoteSyncForTests(remote, { now: NOW });
  ok(out.ok && out.action === 'pushed', 'pushed');
  eq(remote._peek('user-A')?.version, 1, 'remote v1');
  eq(getMoneySyncRuntimeStatus().pendingCount, 0, 'outbox flushed after push');
  eq(useMoneySyncStore.getState().baseVersion, 1, 'baseVersion advanced');
  teardown();
});

await it('runtime simulate no-op when nothing changed since last push', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 2_000_000 });
  const remote = createFakeRemoteAdapter();
  await simulateRemoteSyncForTests(remote, { now: NOW });       // push v1
  const out = await simulateRemoteSyncForTests(remote, { now: NOW }); // nothing changed
  ok(out.ok && out.action === 'noop', `expected noop, got ${out.ok ? out.action : out.reason}`);
  eq(remote._peek('user-A')?.version, 1, 'remote stays v1 (no duplicate)');
  teardown();
});

await it('runtime simulate pushes a new version after a real change', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const remote = createFakeRemoteAdapter();
  useFinanceStore.setState({ mainBalance: 111 });
  await simulateRemoteSyncForTests(remote, { now: NOW }); // v1
  useFinanceStore.setState({ mainBalance: 222 });          // real change
  const out = await simulateRemoteSyncForTests(remote, { now: NOW });
  ok(out.ok && out.action === 'pushed', 'pushed again');
  eq(remote._peek('user-A')?.version, 2, 'remote v2');
  teardown();
});

await it('user A and user B do not share remote state via runtime', async () => {
  teardown();
  const remote = createFakeRemoteAdapter();
  // user A
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 5 });
  await simulateRemoteSyncForTests(remote, { now: NOW });
  // switch to user B
  setupStores('user-B');
  startMoneySyncRuntime({ ...START, userId: 'user-B' });
  useFinanceStore.setState({ mainBalance: 9 });
  await simulateRemoteSyncForTests(remote, { now: NOW });
  eq(remote._userCount(), 2, 'two isolated remote users');
  eq(remote._peek('user-A')?.envelope.userId, 'user-A', 'A envelope');
  eq(remote._peek('user-B')?.envelope.userId, 'user-B', 'B envelope');
  teardown();
});

await it('account cleanup clears remote sync metadata (baseVersion, lastSyncedHash)', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 42 });
  await simulateRemoteSyncForTests(createFakeRemoteAdapter(), { now: NOW });
  ok(useMoneySyncStore.getState().baseVersion >= 1, 'baseVersion set before cleanup');
  clearLocalMoneyPersistence();
  eq(useMoneySyncStore.getState().baseVersion, 0, 'baseVersion reset');
  eq(useMoneySyncStore.getState().lastSyncedHash, null, 'lastSyncedHash reset');
  eq(getMoneySyncRuntimeStatus().queueLength, 0, 'queue cleared');
  teardown();
});

await it('failed remote sync does NOT corrupt stores + keeps outbox pending', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState((s) => ({ transactions: [...s.transactions, makeTxn('keep', 77_000)] }));
  const before = useFinanceStore.getState().transactions.length;
  const pendingBefore = getMoneySyncRuntimeStatus().pendingCount;
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'network');
  const out = await simulateRemoteSyncForTests(remote, { now: NOW });
  ok(!out.ok, 'remote sync failed');
  eq(useFinanceStore.getState().transactions.length, before, 'finance not corrupted');
  ok(getMoneySyncRuntimeStatus().pendingCount >= pendingBefore, 'outbox still pending');
  eq(useMoneySyncStore.getState().status, 'error', 'status error');
  eq(remote._userCount(), 0, 'nothing written to remote on failure');
  teardown();
});

await it('retry after transient failure succeeds without duplicate remote record', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 314 });
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'network');
  const fail = await simulateRemoteSyncForTests(remote, { now: NOW });
  ok(!fail.ok, 'first attempt failed');
  const retry = await simulateRemoteSyncForTests(remote, { now: NOW });
  ok(retry.ok && retry.action === 'pushed', 'retry pushed');
  eq(remote._peek('user-A')?.version, 1, 'single remote record');
  eq(getMoneySyncRuntimeStatus().pendingCount, 0, 'outbox flushed after retry');
  teardown();
});

// ─── regression: store fields unchanged after failed remote sync ──────────────

await it('regression: finance/budget/goals/tasks/auth unchanged after failed remote sync', async () => {
  teardown();
  setupStores('user-A');
  useFinanceStore.setState({ transactions: [makeTxn('r1', 10)] });
  useBudgetStore.setState({ categoryBudgets: [{ categoryId: 'food', monthlyLimit: 1000, spent: 0, month: '2026-06' }] });
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const fin = useFinanceStore.getState().transactions;
  const bud = useBudgetStore.getState().categoryBudgets;
  const goals = useGoalsStore.getState().goals;
  const tasks = useTaskStore.getState().tasks;
  const user = useAuthStore.getState().user;
  const remote = createFakeRemoteAdapter();
  remote._failNext('getHead', 'permission');
  await simulateRemoteSyncForTests(remote, { now: NOW });
  eq(useFinanceStore.getState().transactions, fin, 'finance unchanged');
  eq(useBudgetStore.getState().categoryBudgets, bud, 'budget unchanged');
  eq(useGoalsStore.getState().goals, goals, 'goals unchanged');
  eq(useTaskStore.getState().tasks, tasks, 'tasks unchanged');
  eq(useAuthStore.getState().user, user, 'auth user unchanged');
  teardown();
});

console.log('\nmoney-sync-remote-runtime test complete.');
