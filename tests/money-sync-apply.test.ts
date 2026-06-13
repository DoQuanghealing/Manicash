/* Phase 6B-2D — Safe remote apply: dry-run, real apply, suppression, rollback, account safety */

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
  getCurrentMoneyEnvelope,
  dryRunRemoteApplyForTests,
  applyRemoteForTests,
} from '@/lib/moneySync/clientRuntime';
import { buildSyncEnvelope, type MoneySyncEnvelopeV1 } from '@/lib/moneySync/syncEnvelope';
import { isSystemApplying } from '@/lib/moneySync/suppressionGuard';
import type { CloudMoneyDocumentV1 } from '@/lib/moneySync/cloudTypes';
import type { UserProfile } from '@/types/user';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const NOW = '2026-06-13T11:00:00Z';

function makeUser(uid: string): UserProfile {
  return {
    uid, displayName: 'Apply User', email: `${uid}@test.com`, photoURL: null,
    rank: 'iron', xp: 100, streak: 1, lastActiveDate: '2026-06-13',
    resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free',
    tier: 'pro', accountStatus: 'active', premiumExpiresAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: NOW,
  };
}

function makeTxn(id: string, amount: number): Transaction {
  return { id, type: 'expense', amount, categoryId: 'food', note: 'x', wallet: 'main', date: '2026-06-13', time: '11:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' };
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

/** Lấy payload từ state hiện tại (đã là CloudMoneyDocumentV1 hợp lệ). */
function currentPayload(): CloudMoneyDocumentV1 {
  const env = getCurrentMoneyEnvelope(NOW);
  if (!env) throw new Error('no current envelope');
  return env.payload;
}

function envOf(uid: string, payload: CloudMoneyDocumentV1, baseVersion = 0): MoneySyncEnvelopeV1 {
  return buildSyncEnvelope({ userId: uid, snapshotHash: 'h-test', baseVersion, localVersion: 0, createdAt: NOW, payload });
}

console.log('\nmoney-sync-apply.test.ts');

// ─── Dry-run ────────────────────────────────────────────────────────────────────

await it('dry-run does NOT mutate stores', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 5_000_000 } };
  const res = dryRunRemoteApplyForTests(envOf('user-A', payload), { now: NOW });
  eq(res.kind, 'dry-run', 'kind dry-run');
  eq(useFinanceStore.getState().mainBalance, 1_000_000, 'store unchanged by dry-run');
  teardown();
});

await it('dry-run does NOT enqueue outbox', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 7_000_000 } };
  dryRunRemoteApplyForTests(envOf('user-A', payload), { now: NOW });
  eq(getMoneySyncRuntimeStatus().queueLength, 0, 'no outbox item from dry-run');
  teardown();
});

await it('dry-run detects no-op when payload equals current state', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const res = dryRunRemoteApplyForTests(getCurrentMoneyEnvelope(NOW)!, { now: NOW });
  if (res.kind === 'dry-run') { eq(res.noop, true, 'noop true'); eq(res.changedStores.length, 0, 'no changed stores'); }
  else throw new Error(`expected dry-run, got ${res.kind}`);
  teardown();
});

await it('dry-run reports correct changed stores (goals only)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const base = currentPayload();
  const payload = { ...base, goals: { goals: [{ id: 'g1', name: 'Quỹ', icon: '🎯', targetAmount: 1000, currentAmount: 0, deadline: '2027-01-01', monthlyContributionTarget: 100, milestones: [] } as never] } };
  const res = dryRunRemoteApplyForTests(envOf('user-A', payload), { now: NOW });
  if (res.kind === 'dry-run') {
    eq(res.noop, false, 'not noop');
    eq(res.changedStores.join(','), 'goals', 'only goals changed');
  } else throw new Error(`expected dry-run, got ${res.kind}`);
  teardown();
});

// ─── Real apply ─────────────────────────────────────────────────────────────────

await it('apply mutates the target store', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 5_000_000 } };
  const res = applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 7 });
  eq(res.kind, 'applied', 'applied');
  eq(useFinanceStore.getState().mainBalance, 5_000_000, 'store mutated');
  teardown();
});

await it('apply does NOT enqueue outbox (suppression), but later user edit does', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 3_000_000 } };
  applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 2 });
  eq(getMoneySyncRuntimeStatus().queueLength, 0, 'apply did not enqueue');
  eq(isSystemApplying(), false, 'suppression off after apply');
  // genuine user edit now enqueues (suppression really turned off)
  useFinanceStore.setState({ mainBalance: 3_500_000 });
  eq(getMoneySyncRuntimeStatus().queueLength, 1, 'user edit enqueues after apply');
  teardown();
});

await it('apply updates lastSyncedHash + baseVersion metadata', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 4_242_000 } };
  const res = applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 9 });
  if (res.kind === 'applied') {
    eq(useMoneySyncStore.getState().baseVersion, 9, 'baseVersion set');
    eq(useMoneySyncStore.getState().lastSyncedHash, res.newHash, 'lastSyncedHash = newHash');
  } else throw new Error(`expected applied, got ${res.kind}`);
  teardown();
});

await it('apply with same hash → skipped no-op (store unchanged)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  useFinanceStore.setState({ mainBalance: 1_234_000 });
  const res = applyRemoteForTests(getCurrentMoneyEnvelope(NOW)!, { now: NOW });
  eq(res.kind, 'skipped', 'skipped');
  eq(useFinanceStore.getState().mainBalance, 1_234_000, 'unchanged');
  teardown();
});

// ─── Account safety ───────────────────────────────────────────────────────────

await it('reject: envelope userId differs from current user', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const res = applyRemoteForTests(envOf('user-B', currentPayload()), { now: NOW });
  if (res.kind === 'rejected') eq(res.reason, 'user_mismatch', 'user_mismatch');
  else throw new Error(`expected rejected, got ${res.kind}`);
  teardown();
});

await it('reject: no auth user', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const env = envOf('user-A', currentPayload());
  useAuthStore.setState({ user: null });
  const res = applyRemoteForTests(env, { now: NOW });
  if (res.kind === 'rejected') eq(res.reason, 'user_null', 'user_null');
  else throw new Error(`expected rejected, got ${res.kind}`);
  teardown();
});

await it('reject: base hash mismatch (optimistic guard)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 8_000_000 } };
  const res = applyRemoteForTests(envOf('user-A', payload), { now: NOW, expectedBaseHash: 'stale-hash' });
  if (res.kind === 'rejected') eq(res.reason, 'base_mismatch', 'base_mismatch');
  else throw new Error(`expected rejected, got ${res.kind}`);
  teardown();
});

// ─── Rollback / partial corruption ────────────────────────────────────────────

await it('failed apply rolls back — no partial corruption', async () => {
  teardown(); setupStores('user-A');
  useFinanceStore.setState({ transactions: [makeTxn('orig', 10)], mainBalance: 1_000_000 });
  useBudgetStore.setState({ categoryBudgets: [{ categoryId: 'food', monthlyLimit: 1000, spent: 0, month: '2026-06' }] });
  startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const base = currentPayload();
  const payload = {
    ...base,
    finance: { ...base.finance, mainBalance: 9_000_000 },
    budget: { ...base.budget, categoryBudgets: [{ categoryId: 'shop', monthlyLimit: 5, spent: 0, month: '2026-06' }] },
    goals: { goals: [{ id: 'gX', name: 'X', icon: '🎯', targetAmount: 1, currentAmount: 0, deadline: '2027-01-01', monthlyContributionTarget: 1, milestones: [] } as never] },
  };
  const res = applyRemoteForTests(envOf('user-A', payload), { now: NOW, _failOnStore: 'goals' });
  if (res.kind === 'failed') ok(res.rolledBack, 'rolledBack true');
  else throw new Error(`expected failed, got ${res.kind}`);
  // finance + budget (applied before the failing goals step) must be rolled back
  eq(useFinanceStore.getState().mainBalance, 1_000_000, 'finance rolled back');
  eq(useFinanceStore.getState().transactions[0]?.id, 'orig', 'finance txns rolled back');
  eq(useBudgetStore.getState().categoryBudgets[0]?.categoryId, 'food', 'budget rolled back');
  eq(getMoneySyncRuntimeStatus().queueLength, 0, 'no outbox from failed apply');
  eq(isSystemApplying(), false, 'suppression cleared after failure');
  teardown();
});

// ─── User isolation / account boundary ────────────────────────────────────────

await it('user switch does not reuse old metadata/hash', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 6_000_000 } };
  applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 3 });
  ok(useMoneySyncStore.getState().baseVersion === 3, 'A baseVersion set');
  // switch to B
  setupStores('user-B'); startMoneySyncRuntime({ ...START, userId: 'user-B' });
  eq(useMoneySyncStore.getState().baseVersion, 0, 'B baseVersion reset');
  eq(useMoneySyncStore.getState().lastSyncedHash, null, 'B lastSyncedHash reset');
  teardown();
});

await it('sign-out cleanup resets metadata after apply', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const payload = { ...currentPayload(), finance: { ...currentPayload().finance, mainBalance: 2_500_000 } };
  applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 4 });
  clearLocalMoneyPersistence();
  eq(useMoneySyncStore.getState().baseVersion, 0, 'baseVersion reset');
  eq(useMoneySyncStore.getState().lastSyncedHash, null, 'lastSyncedHash reset');
  eq(isSystemApplying(), false, 'suppression reset on cleanup');
  teardown();
});

// ─── Field preservation ───────────────────────────────────────────────────────

await it('apply preserves local-only user fields (accountStatus, tier)', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const base = currentPayload();
  const payload = { ...base, authProgress: { ...base.authProgress, xp: 999 } };
  const res = applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 1 });
  eq(res.kind, 'applied', 'applied');
  const user = useAuthStore.getState().user;
  eq(user?.xp, 999, 'xp updated from remote');
  eq(user?.accountStatus, 'active', 'accountStatus preserved (not in cloud subset)');
  eq(user?.tier, 'pro', 'tier preserved');
  teardown();
});

await it('apply preserves finance/budget/goals/tasks required fields', async () => {
  teardown(); setupStores('user-A'); startMoneySyncRuntime({ ...START, userId: 'user-A' });
  const base = currentPayload();
  const payload = {
    ...base,
    finance: { ...base.finance, transactions: [makeTxn('a1', 50_000)], mainBalance: 1_500_000 },
    tasks: { tasks: [], xpPenalties: [{ taskId: 't1', penaltyMultiplier: 0.7, remainingTasks: 2 } as never] },
  };
  applyRemoteForTests(envOf('user-A', payload), { now: NOW, remoteVersion: 1 });
  const tx = useFinanceStore.getState().transactions[0];
  eq(tx?.id, 'a1', 'tx id present');
  eq(tx?.categoryId, 'food', 'tx categoryId preserved');
  eq(tx?.wallet, 'main', 'tx wallet preserved');
  eq(useTaskStore.getState().xpPenalties[0]?.taskId, 't1', 'xpPenalty preserved');
  teardown();
});

console.log('\nmoney-sync-apply test complete.');
