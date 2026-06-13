/* Phase 6B-2B — Client money sync runtime: lifecycle, outbox, account boundary, store safety */

// PHẢI import đầu tiên: cài localStorage mock TRƯỚC khi store (persist) được import.
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
  stopMoneySyncRuntime,
  resetMoneySyncRuntime,
  getMoneySyncRuntimeStatus,
  flushMoneySyncForTests,
} from '@/lib/moneySync/clientRuntime';
import { createInMemoryMoneyAdapter, createFailingMoneyAdapter } from '@/lib/moneySync/firestoreAdapter';
import type { UserProfile } from '@/types/user';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T08:00:00Z';

function makeUser(uid: string): UserProfile {
  return {
    uid, displayName: 'Runtime User', email: `${uid}@test.com`, photoURL: null,
    rank: 'iron', xp: 100, streak: 1, lastActiveDate: '2026-06-13',
    resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free',
    premiumExpiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: NOW,
  };
}

function makeTxn(id: string, amount: number): Transaction {
  return {
    id, type: 'expense', amount, categoryId: 'food', note: 'test',
    wallet: 'main', date: '2026-06-13', time: '08:00',
    dateLabel: 'Hôm nay', dateKey: '2026-06-13',
  };
}

/** Đưa 5 store về baseline cố định + set user + mark hydrated. */
function setupStores(uid: string): void {
  useFinanceStore.setState({
    transactions: [], mainBalance: 1_000_000, emergencyBalance: 0,
    billFundBalance: 0, fixedBills: [], billSnapshots: [],
  });
  useBudgetStore.setState({
    carryOver: 0, currentMonth: '2026-06', categoryBudgets: [],
    rolloverNotified: false, flaggedCategories: [], flaggedTransactionIds: [],
    monthlySnapshots: [], unviewedReportMonth: null, xpAtMonthStart: 0,
  });
  useGoalsStore.setState({ goals: [] });
  useTaskStore.setState({ tasks: [], xpPenalties: [] });
  useAuthStore.setState({ user: makeUser(uid) });
  useHydrationStore.setState({ finance: true, budget: true, goals: true, tasks: true, auth: true });
}

/** Reset toàn bộ runtime + stores + hydration về 0 giữa các scenario. */
function teardown(): void {
  resetMoneySyncRuntime();
  useHydrationStore.setState({ finance: false, budget: false, goals: false, tasks: false, auth: false });
  useAuthStore.setState({ user: null });
}

const START = { requireBrowser: false as const, now: () => NOW };

console.log('\nmoney-sync-runtime.test.ts');

// ─── Lifecycle ──────────────────────────────────────────────────────────────────

await it('runtime does NOT start before hydration is complete', async () => {
  teardown();
  useAuthStore.setState({ user: makeUser('user-A') });
  // hydration vẫn false
  const status = startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(status.started, false, 'not started before hydration');
});

await it('runtime does NOT start without authenticated user id', async () => {
  teardown();
  useHydrationStore.setState({ finance: true, budget: true, goals: true, tasks: true, auth: true });
  useAuthStore.setState({ user: null });
  const s1 = startMoneySyncRuntime({ ...START }); // uid từ store = undefined
  eq(s1.started, false, 'not started with null user');
  const s2 = startMoneySyncRuntime({ ...START, userId: 'local_user' }); // demo uid bị loại
  eq(s2.started, false, 'not started for local_user');
  teardown();
});

await it('runtime starts once after hydration + auth (no enqueue on start)', async () => {
  teardown();
  setupStores('user-A');
  const status = startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(status.started, true, 'started');
  eq(status.status, 'ready', 'status ready');
  eq(status.queueLength, 0, 'no enqueue on initial hydration');
  ok(status.lastSnapshotHash !== null, 'baseline hash set');
  teardown();
});

await it('calling start twice is idempotent (queue + hash preserved, no re-subscribe)', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 555 }); // 1 mutation -> 1 enqueue
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'one enqueue after mutation');
  const hashAfterMutation = getMoneySyncRuntimeStatus().lastSnapshotHash;
  // start lần 2 cùng user: KHÔNG reset queue, KHÔNG re-subscribe
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'queue preserved after 2nd start');
  eq(getMoneySyncRuntimeStatus().lastSnapshotHash, hashAfterMutation, 'hash preserved');
  teardown();
});

await it('calling stop twice is safe', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  stopMoneySyncRuntime();
  const s = stopMoneySyncRuntime();
  eq(s.started, false, 'stopped');
  teardown();
});

// ─── Queue / outbox ─────────────────────────────────────────────────────────────

await it('store mutation after start enqueues exactly one sync item', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState((s) => ({ transactions: [...s.transactions, makeTxn('tx1', 50_000)] }));
  const status = getMoneySyncRuntimeStatus();
  eq(status.queueLength, 1, 'one queue item');
  eq(status.pendingCount, 1, 'one pending');
  teardown();
});

await it('repeated UNCHANGED snapshot does not enqueue duplicate item', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 777 });           // change -> enqueue
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'one after real change');
  useFinanceStore.setState({ mainBalance: 777 });           // same value -> no change
  useFinanceStore.setState({ mainBalance: 777 });           // again -> no change
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'no duplicate for unchanged snapshot');
  teardown();
});

await it('initial hydration does not create noisy queue entries', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(getMoneySyncRuntimeStatus().queueLength, 0, 'empty queue right after start');
  teardown();
});

await it('failed adapter push keeps item pending/error WITHOUT corrupting stores', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A', adapter: createFailingMoneyAdapter('push failed') });
  useFinanceStore.setState((s) => ({ transactions: [...s.transactions, makeTxn('tx-keep', 99_000)] }));
  const before = useFinanceStore.getState().transactions.length;
  const result = await flushMoneySyncForTests();
  eq(result.ok, false, 'flush failed');
  eq(useFinanceStore.getState().transactions.length, before, 'store NOT corrupted after failed push');
  ok(getMoneySyncRuntimeStatus().lastError !== null, 'error recorded');
  ok(getMoneySyncRuntimeStatus().pendingCount >= 1, 'item still pending (retryable)');
  teardown();
});

await it('manual flush drains queue with in-memory adapter', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A', adapter: createInMemoryMoneyAdapter() });
  useFinanceStore.setState((s) => ({ transactions: [...s.transactions, makeTxn('tx-flush', 12_000)] }));
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'one queued');
  const result = await flushMoneySyncForTests();
  eq(result.ok, true, 'flush ok');
  eq(result.flushed, 1, 'one flushed');
  eq(getMoneySyncRuntimeStatus().pendingCount, 0, 'no pending after flush');
  teardown();
});

// ─── Account boundary ─────────────────────────────────────────────────────────

await it('sign-out (clearLocalMoneyPersistence) clears runtime + queue + metadata', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 222 }); // enqueue
  ok(getMoneySyncRuntimeStatus().queueLength >= 1, 'has queue before sign-out');
  clearLocalMoneyPersistence();
  const status = getMoneySyncRuntimeStatus();
  eq(status.started, false, 'runtime stopped');
  eq(status.queueLength, 0, 'queue cleared');
  eq(status.userId, null, 'userId cleared');
  eq(useMoneySyncStore.getState().status, 'idle', 'meta reset to idle');
  teardown();
});

await it('account deletion (resetMoneySyncRuntime) clears runtime + queue + metadata', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 333 });
  resetMoneySyncRuntime();
  const status = getMoneySyncRuntimeStatus();
  eq(status.started, false, 'stopped');
  eq(status.queueLength, 0, 'queue cleared');
  eq(status.lastSnapshotHash, null, 'hash cleared');
  teardown();
});

await it('switching user does NOT leak previous user queue', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState((s) => ({ transactions: [...s.transactions, makeTxn('tx-A', 1)] }));
  ok(getMoneySyncRuntimeStatus().queueLength >= 1, 'user-A has queue');
  // switch to user-B
  useAuthStore.setState({ user: makeUser('user-B') });
  startMoneySyncRuntime({ ...START, userId: 'user-B' });
  const status = getMoneySyncRuntimeStatus();
  eq(status.userId, 'user-B', 'now user-B');
  eq(status.queueLength, 0, 'user-B starts with empty queue (no leak)');
  teardown();
});

await it('previous user snapshot hash is not reused for next user', async () => {
  teardown();
  setupStores('user-A');
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const hashA = getMoneySyncRuntimeStatus().lastSnapshotHash;
  // user-B với data khác (hash phải gồm userId -> khác A)
  useAuthStore.setState({ user: makeUser('user-B') });
  startMoneySyncRuntime({ ...START, userId: 'user-B' });
  const hashB = getMoneySyncRuntimeStatus().lastSnapshotHash;
  ok(hashB !== null, 'B has fresh baseline hash');
  ok(hashB !== hashA, 'B hash differs from A (account-scoped)');
  // và mutate B enqueue bình thường (baseline B thiết lập đúng)
  useFinanceStore.setState({ mainBalance: 9 });
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'B enqueues after its own baseline');
  teardown();
});

// ─── Store safety (runtime startup không đổi dữ liệu) ─────────────────────────

await it('finance transactions unchanged after runtime startup', async () => {
  teardown();
  setupStores('user-A');
  useFinanceStore.setState({ transactions: [makeTxn('keep-1', 10), makeTxn('keep-2', 20)] });
  const before = useFinanceStore.getState().transactions;
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(useFinanceStore.getState().transactions, before, 'same transactions reference (untouched)');
  eq(useFinanceStore.getState().transactions.length, 2, 'count preserved');
  teardown();
});

await it('budget category budgets unchanged after runtime startup', async () => {
  teardown();
  setupStores('user-A');
  useBudgetStore.setState({ categoryBudgets: [{ categoryId: 'food', monthlyLimit: 1000, spent: 0, month: '2026-06' }] });
  const before = useBudgetStore.getState().categoryBudgets;
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(useBudgetStore.getState().categoryBudgets, before, 'category budgets untouched');
  teardown();
});

await it('goals unchanged after runtime startup', async () => {
  teardown();
  setupStores('user-A');
  const before = useGoalsStore.getState().goals;
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(useGoalsStore.getState().goals, before, 'goals untouched');
  teardown();
});

await it('tasks and xp penalties unchanged after runtime startup', async () => {
  teardown();
  setupStores('user-A');
  const beforeTasks = useTaskStore.getState().tasks;
  const beforePen = useTaskStore.getState().xpPenalties;
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  eq(useTaskStore.getState().tasks, beforeTasks, 'tasks untouched');
  eq(useTaskStore.getState().xpPenalties, beforePen, 'xpPenalties untouched');
  teardown();
});

await it('auth user xp/streak/shields unchanged after runtime startup', async () => {
  teardown();
  setupStores('user-A');
  const before = useAuthStore.getState().user;
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const after = useAuthStore.getState().user;
  eq(after, before, 'user reference untouched');
  eq(after?.xp, 100, 'xp preserved');
  eq(after?.streak, 1, 'streak preserved');
  teardown();
});

console.log('\nmoney-sync-runtime test complete.');
