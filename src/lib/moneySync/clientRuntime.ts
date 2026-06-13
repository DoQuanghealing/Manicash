/* ═══ Money Sync — Client Runtime / Orchestrator (Phase 6B-2B) ═══
 * Lớp tích hợp DUY NHẤT chạm cả Zustand store + lifecycle. Pure engine
 * (merge/serialize/snapshotBuilder) vẫn thuần — runtime gom data, build snapshot,
 * so hash, enqueue vào outbox. KHÔNG mutate store. KHÔNG network thật ở phase này.
 *
 * Invariants giữ:
 *  - Server không execute money action (runtime này client-only).
 *  - Không đổi công thức Safe-to-Spend / healthScore / CFO.
 *  - Không auto-apply patch về store ở phase này → không có vòng lặp enqueue.
 *  - Adapter là seam thay thế được (mặc định in-memory, Firestore sau).
 *
 * API: startMoneySyncRuntime / stopMoneySyncRuntime / resetMoneySyncRuntime /
 *      flushMoneySyncForTests / getMoneySyncRuntimeStatus.
 */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { areCoreStoresHydrated } from '@/stores/useHydrationStore';
import { useMoneySyncStore } from '@/stores/useMoneySyncStore';

import {
  buildMoneySyncSnapshot,
  hashMoneySyncSnapshot,
  type MoneySyncClientSnapshot,
} from './snapshotBuilder';
import { serializeAuthProgress, serializeMoneyStateToCloud } from './serialize';
import {
  enqueuePendingWrite,
  markPendingWriteFlushed,
  markPendingWriteFailed,
  getPendingRetryable,
} from './syncQueue';
import { getOrCreateMoneyDeviceId } from './deviceId';
import {
  createInMemoryMoneyAdapter,
  type MoneyCloudAdapter,
} from './firestoreAdapter';
import type { LocalMoneyStateInput } from './cloudTypes';

// ─── Module singletons ─────────────────────────────────────────────────────────

let started = false;
let currentUserId: string | null = null;
let unsubscribers: Array<() => void> = [];
let seq = 0; // deterministic write-id counter (reset bởi resetMoneySyncRuntime)

let adapter: MoneyCloudAdapter = createInMemoryMoneyAdapter();
let nowFn: () => string = () => new Date().toISOString();
let deviceId = 'pending-device';
let timezone = 'Asia/Ho_Chi_Minh';

// ─── Options + status types ──────────────────────────────────────────────────

export type StartMoneySyncOptions = {
  /** Mặc định: uid từ useAuthStore. Truyền tay trong tests. */
  userId?: string;
  /** Mặc định: in-memory adapter. Inject mock trong tests. */
  adapter?: MoneyCloudAdapter;
  /** Mặc định: () => new Date().toISOString(). Inject để test ổn định. */
  now?: () => string;
  deviceId?: string;
  timezone?: string;
  /** Mặc định true → chỉ start trong browser. Tests truyền false. */
  requireBrowser?: boolean;
};

export type MoneySyncRuntimeStatus = {
  started: boolean;
  userId: string | null;
  status: ReturnType<typeof useMoneySyncStore.getState>['status'];
  pendingCount: number;
  queueLength: number;
  lastSnapshotHash: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type FlushResult = {
  ok: boolean;
  flushed: number;
  pending: number;
  reason?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** uid hợp lệ để sync: có giá trị, không rỗng, không phải local demo. */
function isSyncableUid(uid: string | undefined | null): uid is string {
  return Boolean(uid && uid.trim().length > 0 && uid !== 'local_user');
}

function resolveTimezone(tz?: string): string {
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}

/** Gom state 5 store → snapshot (cho hash) + localState (cho serialize/flush). */
function gather(userId: string): {
  snapshot: MoneySyncClientSnapshot;
  localState: LocalMoneyStateInput;
} {
  const f = useFinanceStore.getState();
  const b = useBudgetStore.getState();
  const g = useGoalsStore.getState();
  const t = useTaskStore.getState();
  const a = useAuthStore.getState();
  const aud = useActionAuditStore.getState();

  const finance = {
    transactions: f.transactions,
    mainBalance: f.mainBalance,
    emergencyBalance: f.emergencyBalance,
    billFundBalance: f.billFundBalance,
    fixedBills: f.fixedBills,
    billSnapshots: f.billSnapshots,
  };
  const budget = {
    carryOver: b.carryOver,
    currentMonth: b.currentMonth,
    categoryBudgets: b.categoryBudgets,
    flaggedCategories: b.flaggedCategories,
    flaggedTransactionIds: b.flaggedTransactionIds,
    monthlySnapshots: b.monthlySnapshots,
    unviewedReportMonth: b.unviewedReportMonth,
    xpAtMonthStart: b.xpAtMonthStart,
  };
  const goals = { goals: g.goals };
  const tasks = { tasks: t.tasks, xpPenalties: t.xpPenalties };
  const authUser = a.user ? serializeAuthProgress(a.user) : null;

  const snapshot = buildMoneySyncSnapshot({
    userId,
    clientNow: nowFn(),
    timezone,
    finance,
    budget,
    goals,
    tasks,
    authUser,
  });

  const localState: LocalMoneyStateInput = {
    uid: userId,
    now: nowFn(),
    deviceId,
    finance,
    budget,
    goals,
    tasks,
    auth: { user: a.user },
    audit: { records: aud.records },
  };

  return { snapshot, localState };
}

/** Re-gom snapshot khi store đổi; enqueue 1 write nếu hash khác. */
function handleStoreChange(userId: string): void {
  if (!started || currentUserId !== userId) return;
  const { snapshot } = gather(userId);
  const hash = hashMoneySyncSnapshot(snapshot);
  const meta = useMoneySyncStore.getState();
  if (hash === meta.lastSnapshotHash) return; // không đổi → không enqueue
  meta.setLastHash(hash);
  meta.enqueueWrite(enqueuePendingWrite(`${userId}:${seq++}`, userId, nowFn()));
  meta.setStatus('dirty');
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Khởi động runtime cho user hiện tại. Idempotent + an toàn gọi nhiều lần:
 *  - Chưa hydrate hoặc không có uid hợp lệ → không start (no-op).
 *  - Đã start cho cùng uid → no-op (không duplicate subscription).
 *  - Đã start cho uid khác → stop + reset trước rồi start mới (account isolation).
 *  - Lần start: set lastHash từ snapshot ban đầu, KHÔNG enqueue (tránh nhiễu).
 */
export function startMoneySyncRuntime(
  options: StartMoneySyncOptions = {},
): MoneySyncRuntimeStatus {
  const requireBrowser = options.requireBrowser ?? true;
  if (requireBrowser && typeof window === 'undefined') {
    return getMoneySyncRuntimeStatus();
  }
  if (!areCoreStoresHydrated()) {
    return getMoneySyncRuntimeStatus();
  }
  const userId = options.userId ?? useAuthStore.getState().user?.uid;
  if (!isSyncableUid(userId)) {
    return getMoneySyncRuntimeStatus();
  }

  // Config (đặt trước gather để nowFn/deviceId/timezone đúng).
  nowFn = options.now ?? (() => new Date().toISOString());
  deviceId =
    options.deviceId ??
    (deviceId !== 'pending-device' ? deviceId : getOrCreateMoneyDeviceId());
  timezone = resolveTimezone(options.timezone);
  if (options.adapter) adapter = options.adapter;

  // Đổi user → stop + reset để không leak outbox/hash của user cũ.
  if (started && currentUserId && currentUserId !== userId) {
    resetMoneySyncRuntime();
  }
  // Cùng user, đã start → idempotent.
  if (started && currentUserId === userId) {
    return getMoneySyncRuntimeStatus();
  }

  const meta = useMoneySyncStore.getState();
  meta.reset();
  meta.setUserId(userId);
  meta.setStatus('starting');

  // Snapshot ban đầu → set hash mà KHÔNG enqueue.
  const { snapshot } = gather(userId);
  meta.setLastHash(hashMoneySyncSnapshot(snapshot));

  const onChange = () => handleStoreChange(userId);
  unsubscribers = [
    useFinanceStore.subscribe(onChange),
    useBudgetStore.subscribe(onChange),
    useGoalsStore.subscribe(onChange),
    useTaskStore.subscribe(onChange),
    useAuthStore.subscribe(onChange),
  ];

  started = true;
  currentUserId = userId;
  useMoneySyncStore.getState().setStatus('ready');
  return getMoneySyncRuntimeStatus();
}

/** Dừng subscriptions. Idempotent — an toàn gọi nhiều lần. KHÔNG xóa outbox. */
export function stopMoneySyncRuntime(): MoneySyncRuntimeStatus {
  for (const unsub of unsubscribers) {
    try {
      unsub();
    } catch {
      /* nuốt lỗi unsubscribe */
    }
  }
  unsubscribers = [];
  started = false;
  currentUserId = null;
  const meta = useMoneySyncStore.getState();
  if (meta.status !== 'idle') meta.setStatus('stopped');
  return getMoneySyncRuntimeStatus();
}

/** Stop + xóa sạch outbox/metadata + reset seq. Dùng cho account boundary. */
export function resetMoneySyncRuntime(): void {
  stopMoneySyncRuntime();
  seq = 0;
  useMoneySyncStore.getState().reset();
}

/** Trạng thái runtime hiện tại (đọc-only). */
export function getMoneySyncRuntimeStatus(): MoneySyncRuntimeStatus {
  const m = useMoneySyncStore.getState();
  return {
    started,
    userId: currentUserId ?? m.userId,
    status: m.status,
    pendingCount: getPendingRetryable(m.queue).length,
    queueLength: m.queue.length,
    lastSnapshotHash: m.lastSnapshotHash,
    lastSyncedAt: m.lastSyncedAt,
    lastError: m.lastError,
  };
}

/**
 * Drain outbox qua adapter hiện tại (in-memory/mock/no-op).
 *  - Không có user / không có pending → no-op an toàn.
 *  - Push 1 lần state mới nhất (LWW-friendly): thành công → mark tất cả retryable
 *    flushed; thất bại → mark failed (giữ pending tới maxAttempts) + set error.
 *  - KHÔNG mutate store dù thành công hay thất bại.
 */
export async function flushMoneySyncForTests(): Promise<FlushResult> {
  const meta = useMoneySyncStore.getState();
  const uid = meta.userId;
  if (!isSyncableUid(uid)) {
    return { ok: false, flushed: 0, pending: 0, reason: 'no_user' };
  }

  const retryable = getPendingRetryable(meta.queue);
  if (retryable.length === 0) {
    return { ok: true, flushed: 0, pending: 0 };
  }

  const now = nowFn();
  let doc;
  try {
    doc = serializeMoneyStateToCloud(gather(uid).localState);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    meta.setError(reason);
    meta.setStatus('error');
    return { ok: false, flushed: 0, pending: retryable.length, reason };
  }

  meta.setStatus('syncing');
  const targetIds = new Set(retryable.map((r) => r.id));

  try {
    await adapter.save(uid, doc);
    useMoneySyncStore.getState().replaceQueue(
      useMoneySyncStore
        .getState()
        .queue.map((w) =>
          targetIds.has(w.id) ? markPendingWriteFlushed(w, now) : w,
        ),
    );
    const after = useMoneySyncStore.getState();
    after.markSynced(now);
    after.setStatus('ready');
    return {
      ok: true,
      flushed: targetIds.size,
      pending: getPendingRetryable(after.queue).length,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    useMoneySyncStore.getState().replaceQueue(
      useMoneySyncStore
        .getState()
        .queue.map((w) =>
          targetIds.has(w.id) ? markPendingWriteFailed(w, now, reason) : w,
        ),
    );
    const after = useMoneySyncStore.getState();
    after.setError(reason);
    after.setStatus('error');
    return {
      ok: false,
      flushed: 0,
      pending: getPendingRetryable(after.queue).length,
      reason,
    };
  }
}
