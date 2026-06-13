/* ═══ Money Sync — Safe Remote Apply Pipeline (Phase 6B-2D) ═══
 * Đường DUY NHẤT để ghi remote/merged state vào 5 Zustand store. KHÔNG rải setState
 * remote khắp nơi. Chạy trong suppression guard → subscription fire nhưng runtime
 * KHÔNG enqueue outbox.
 *
 * BẤT BIẾN:
 *  - Validate TRƯỚC khi mutate (account/user/payload/base). Lỗi giữa chừng →
 *    rollback về snapshot trước apply (không partial corruption).
 *  - KHÔNG mutate audit store (giữ undo/action audit nguyên vẹn).
 *  - dry-run: KHÔNG mutate store / outbox / metadata.
 *  - clock (now) truyền vào, KHÔNG Date.now ở đây.
 */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMoneySyncStore } from '@/stores/useMoneySyncStore';

import { deserializeCloudMoneyDocument, serializeAuthProgress } from './serialize';
import { buildMoneySyncSnapshot, hashMoneySyncSnapshot } from './snapshotBuilder';
import { beginSystemApply, endSystemApply } from './suppressionGuard';
import type { MoneySyncEnvelopeV1 } from './syncEnvelope';
import type {
  CloudFinanceStateV1,
  CloudBudgetStateV1,
  CloudGoalsStateV1,
  CloudTasksStateV1,
  CloudAuthProgressV1,
} from './cloudTypes';
import type { UserProfile } from '@/types/user';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RemoteApplyMode = 'dry-run' | 'apply';

export type ChangedStore = 'finance' | 'budget' | 'goals' | 'tasks' | 'auth';

export type RemoteApplyResult =
  | { kind: 'dry-run'; noop: boolean; changedStores: ChangedStore[]; currentHash: string; targetHash: string }
  | { kind: 'applied'; changedStores: ChangedStore[]; newHash: string; baseVersion: number }
  | { kind: 'skipped'; reason: 'same_hash'; hash: string }
  | { kind: 'rejected'; reason: 'user_null' | 'user_mismatch' | 'invalid_payload' | 'base_mismatch' }
  | { kind: 'failed'; error: string; rolledBack: boolean };

export type RemoteApplyInput = {
  userId: string;
  envelope: MoneySyncEnvelopeV1;
  mode: RemoteApplyMode;
  now: string;
  /** Version remote để ghi vào metadata sau apply. Mặc định envelope.baseVersion. */
  remoteVersion?: number;
  /** Nếu set: phải khớp lastSyncedHash hiện tại, nếu không → base_mismatch. */
  expectedBaseHash?: string | null;
  /** Test-only: ép lỗi giữa chừng tại store này để chứng minh rollback. */
  _failOnStore?: ChangedStore;
};

// ─── Effective state builder ──────────────────────────────────────────────────

type EffectiveStates = {
  finance: CloudFinanceStateV1;
  budget: CloudBudgetStateV1;
  goals: CloudGoalsStateV1;
  tasks: CloudTasksStateV1;
  authUser: CloudAuthProgressV1 | null;
  /** User profile sau khi merge authProgress (giữ field local quan trọng). */
  mergedUser: UserProfile | null;
};

function currentStates(): EffectiveStates {
  const f = useFinanceStore.getState();
  const b = useBudgetStore.getState();
  const g = useGoalsStore.getState();
  const t = useTaskStore.getState();
  const user = useAuthStore.getState().user;
  return {
    finance: {
      transactions: f.transactions,
      mainBalance: f.mainBalance,
      emergencyBalance: f.emergencyBalance,
      billFundBalance: f.billFundBalance,
      fixedBills: f.fixedBills,
      billSnapshots: f.billSnapshots,
    },
    budget: {
      carryOver: b.carryOver,
      currentMonth: b.currentMonth,
      categoryBudgets: b.categoryBudgets,
      flaggedCategories: b.flaggedCategories,
      flaggedTransactionIds: b.flaggedTransactionIds,
      monthlySnapshots: b.monthlySnapshots,
      unviewedReportMonth: b.unviewedReportMonth,
      xpAtMonthStart: b.xpAtMonthStart,
    },
    goals: { goals: g.goals },
    tasks: { tasks: t.tasks, xpPenalties: t.xpPenalties },
    authUser: user ? serializeAuthProgress(user) : null,
    mergedUser: user,
  };
}

/** State mục tiêu sau khi apply patch remote (auth MERGE để không mất field local). */
function targetStates(envelope: MoneySyncEnvelopeV1): EffectiveStates | null {
  const patch = deserializeCloudMoneyDocument(envelope.payload);
  if (Object.keys(patch).length === 0) return null; // invalid/unknown version

  const currentUser = useAuthStore.getState().user;
  const finance = patch.finance as CloudFinanceStateV1;
  const budget = patch.budget as CloudBudgetStateV1;
  const goals = patch.goals as CloudGoalsStateV1;
  const tasks = patch.tasks as CloudTasksStateV1;

  // Auth: MERGE authProgress vào user hiện tại (giữ accountStatus/deletion/tier...).
  let mergedUser: UserProfile | null = currentUser;
  if (currentUser && patch.authProgress) {
    mergedUser = { ...currentUser, ...patch.authProgress } as UserProfile;
  }
  const authUser = mergedUser ? serializeAuthProgress(mergedUser) : null;

  return { finance, budget, goals, tasks, authUser, mergedUser };
}

function snapshotHashOf(userId: string, s: EffectiveStates, now: string): string {
  return hashMoneySyncSnapshot(
    buildMoneySyncSnapshot({
      userId,
      clientNow: now,
      timezone: 'Asia/Ho_Chi_Minh',
      finance: s.finance,
      budget: s.budget,
      goals: s.goals,
      tasks: s.tasks,
      authUser: s.authUser,
    }),
  );
}

function diffChangedStores(cur: EffectiveStates, next: EffectiveStates): ChangedStore[] {
  const changed: ChangedStore[] = [];
  const j = (v: unknown) => JSON.stringify(v);
  if (j(cur.finance) !== j(next.finance)) changed.push('finance');
  if (j(cur.budget) !== j(next.budget)) changed.push('budget');
  if (j(cur.goals) !== j(next.goals)) changed.push('goals');
  if (j(cur.tasks) !== j(next.tasks)) changed.push('tasks');
  if (j(cur.authUser) !== j(next.authUser)) changed.push('auth');
  return changed;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

/**
 * Apply remote/merged envelope vào local. dry-run (mặc định an toàn) hoặc apply thật.
 * KHÔNG tự gọi trong production runtime — gọi qua test seam / phase sau.
 */
export function applyRemoteMoneyState(input: RemoteApplyInput): RemoteApplyResult {
  const { userId, envelope, mode, now } = input;

  // ── Validate account/user ───────────────────────────────────────────────────
  const authUser = useAuthStore.getState().user;
  if (!authUser) return { kind: 'rejected', reason: 'user_null' };
  if (authUser.uid !== userId) return { kind: 'rejected', reason: 'user_mismatch' };
  if (envelope.userId !== userId) return { kind: 'rejected', reason: 'user_mismatch' };

  // ── Validate base (optimistic) ──────────────────────────────────────────────
  if (input.expectedBaseHash !== undefined) {
    const meta = useMoneySyncStore.getState();
    if (input.expectedBaseHash !== meta.lastSyncedHash) {
      return { kind: 'rejected', reason: 'base_mismatch' };
    }
  }

  // ── Validate payload ────────────────────────────────────────────────────────
  const next = targetStates(envelope);
  if (!next) return { kind: 'rejected', reason: 'invalid_payload' };

  const cur = currentStates();
  const currentHash = snapshotHashOf(userId, cur, now);
  const targetHash = snapshotHashOf(userId, next, now);
  const changedStores = diffChangedStores(cur, next);
  const noop = changedStores.length === 0;

  // ── Dry-run: KHÔNG mutate gì cả ─────────────────────────────────────────────
  if (mode === 'dry-run') {
    return { kind: 'dry-run', noop, changedStores, currentHash, targetHash };
  }

  // ── Apply thật ───────────────────────────────────────────────────────────────
  if (noop) {
    return { kind: 'skipped', reason: 'same_hash', hash: currentHash };
  }

  // Snapshot trước apply để rollback nếu lỗi giữa chừng.
  const snaps = {
    finance: useFinanceStore.getState(),
    budget: useBudgetStore.getState(),
    goals: useGoalsStore.getState(),
    tasks: useTaskStore.getState(),
    auth: useAuthStore.getState().user,
  };

  let failure: string | null = null;
  beginSystemApply();
  try {
    applyOne('finance', next, input._failOnStore);
    applyOne('budget', next, input._failOnStore);
    applyOne('goals', next, input._failOnStore);
    applyOne('tasks', next, input._failOnStore);
    applyOne('auth', next, input._failOnStore);
  } catch (err) {
    // Rollback (vẫn trong suppression → không enqueue).
    useFinanceStore.setState({
      transactions: snaps.finance.transactions,
      mainBalance: snaps.finance.mainBalance,
      emergencyBalance: snaps.finance.emergencyBalance,
      billFundBalance: snaps.finance.billFundBalance,
      fixedBills: snaps.finance.fixedBills,
      billSnapshots: snaps.finance.billSnapshots,
    });
    useBudgetStore.setState({
      carryOver: snaps.budget.carryOver,
      currentMonth: snaps.budget.currentMonth,
      categoryBudgets: snaps.budget.categoryBudgets,
      flaggedCategories: snaps.budget.flaggedCategories,
      flaggedTransactionIds: snaps.budget.flaggedTransactionIds,
      monthlySnapshots: snaps.budget.monthlySnapshots,
      unviewedReportMonth: snaps.budget.unviewedReportMonth,
      xpAtMonthStart: snaps.budget.xpAtMonthStart,
    });
    useGoalsStore.setState({ goals: snaps.goals.goals });
    useTaskStore.setState({ tasks: snaps.tasks.tasks, xpPenalties: snaps.tasks.xpPenalties });
    useAuthStore.setState({ user: snaps.auth });
    failure = err instanceof Error ? err.message : String(err);
  } finally {
    endSystemApply();
  }

  if (failure) {
    return { kind: 'failed', error: failure, rolledBack: true };
  }

  // ── Cập nhật metadata sau apply thành công (KHÔNG enqueue) ──────────────────
  const remoteVersion = input.remoteVersion ?? envelope.baseVersion;
  const meta = useMoneySyncStore.getState();
  meta.setLastHash(targetHash);
  meta.setRemoteSynced(remoteVersion, targetHash, now);

  return { kind: 'applied', changedStores, newHash: targetHash, baseVersion: remoteVersion };
}

/** Apply 1 store từ effective states; ném lỗi nếu trùng _failOnStore (test). */
function applyOne(
  store: ChangedStore,
  next: EffectiveStates,
  failOn?: ChangedStore,
): void {
  if (failOn === store) {
    throw new Error(`simulated apply failure at store: ${store}`);
  }
  switch (store) {
    case 'finance':
      useFinanceStore.setState({
        transactions: next.finance.transactions,
        mainBalance: next.finance.mainBalance,
        emergencyBalance: next.finance.emergencyBalance,
        billFundBalance: next.finance.billFundBalance,
        fixedBills: next.finance.fixedBills,
        billSnapshots: next.finance.billSnapshots,
      });
      break;
    case 'budget':
      useBudgetStore.setState({
        carryOver: next.budget.carryOver,
        currentMonth: next.budget.currentMonth,
        categoryBudgets: next.budget.categoryBudgets,
        flaggedCategories: next.budget.flaggedCategories,
        flaggedTransactionIds: next.budget.flaggedTransactionIds,
        monthlySnapshots: next.budget.monthlySnapshots,
        unviewedReportMonth: next.budget.unviewedReportMonth,
        xpAtMonthStart: next.budget.xpAtMonthStart,
      });
      break;
    case 'goals':
      useGoalsStore.setState({ goals: next.goals.goals });
      break;
    case 'tasks':
      useTaskStore.setState({ tasks: next.tasks.tasks, xpPenalties: next.tasks.xpPenalties });
      break;
    case 'auth':
      if (next.mergedUser) useAuthStore.setState({ user: next.mergedUser });
      break;
  }
}
