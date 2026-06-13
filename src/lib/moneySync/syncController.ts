/* ═══ Money Sync — Production Sync Controller (Phase 6B-2E) ═══
 * Ghép remote adapter THẬT với runtime an toàn: pull-on-login (apply qua safe
 * pipeline có suppression), push outbox (debounced), reconnect flush.
 *
 * BẤT BIẾN:
 *  - Apply remote → store CHỈ qua applyRemoteMoneyState (suppression → không loop).
 *  - Merge dùng lại mergeCloudAndLocal. Decision dùng lại decideSyncAction.
 *  - CHỈ chạy khi isMoneySyncEnabled() (flag) bật — mặc định TẮT.
 *  - clock truyền vào; không Date.now trong nhánh logic test (nowProvider inject).
 */
'use client';

import { useMoneySyncStore } from '@/stores/useMoneySyncStore';
import { getCurrentMoneyEnvelope } from './clientRuntime';
import { decideSyncAction, type RemoteMoneySyncAdapter } from './remoteAdapter';
import { mergeCloudAndLocal } from './merge';
import { applyRemoteMoneyState } from './remoteApply';
import {
  markPendingWriteFlushed,
  getPendingRetryable,
} from './syncQueue';
import { buildSyncEnvelope, type MoneySyncEnvelopeV1 } from './syncEnvelope';
import { persistSyncCursor, loadSyncCursor } from './outboxPersistence';
import { isMoneySyncEnabled } from './moneySyncFlags';

// ─── Result types ─────────────────────────────────────────────────────────────

export type SyncCycleResult =
  | { ok: true; action: 'noop' | 'pushed' | 'pulled' | 'merged' }
  | { ok: false; reason: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Meta helpers ──────────────────────────────────────────────────────────────

function markOutboxFlushed(now: string): void {
  const m = useMoneySyncStore.getState();
  const ids = new Set(getPendingRetryable(m.queue).map((r) => r.id));
  if (ids.size === 0) return;
  m.replaceQueue(m.queue.map((w) => (ids.has(w.id) ? markPendingWriteFlushed(w, now) : w)));
}

function persistCursorNow(uid: string): void {
  const m = useMoneySyncStore.getState();
  persistSyncCursor(uid, {
    queue: m.queue,
    baseVersion: m.baseVersion,
    lastSyncedHash: m.lastSyncedHash,
    lastSnapshotHash: m.lastSnapshotHash,
  });
}

function fail(reason: string, message?: string): SyncCycleResult {
  const m = useMoneySyncStore.getState();
  if (message) m.setError(message);
  m.setStatus('error');
  return { ok: false, reason };
}

// ─── Core cycle ────────────────────────────────────────────────────────────────

/**
 * Một vòng sync với adapter remote THẬT. Pull-on-login + push + conflict-merge,
 * apply remote/merged vào store qua safe pipeline (suppressed). Cập nhật + persist
 * cursor. KHÔNG mutate store khi lỗi (apply pipeline tự rollback).
 */
export async function runMoneySyncCycle(
  adapter: RemoteMoneySyncAdapter,
  opts: { now: string },
): Promise<SyncCycleResult> {
  const meta = useMoneySyncStore.getState();
  const uid = meta.userId;
  if (!uid) return { ok: false, reason: 'no_user' };

  const env = getCurrentMoneyEnvelope(opts.now);
  if (!env) return { ok: false, reason: 'no_envelope' };

  let head;
  try {
    head = await adapter.getHead(uid);
  } catch (err) {
    return fail('getHead_error', errMsg(err));
  }

  useMoneySyncStore.getState().setStatus('syncing');

  const decision = decideSyncAction({
    localHash: env.snapshotHash,
    baseHash: meta.lastSyncedHash,
    baseVersion: env.baseVersion,
    remote: head,
  });

  if (decision.kind === 'noop') {
    persistCursorNow(uid);
    useMoneySyncStore.getState().setStatus('ready');
    return { ok: true, action: 'noop' };
  }

  if (decision.kind === 'pull') {
    return resolvePull(adapter, uid, opts.now);
  }

  if (decision.kind === 'conflict') {
    return resolveConflict(adapter, uid, env, opts.now);
  }

  // push (remote_empty | local_ahead)
  const res = await adapter.push(uid, env, head.version);
  if (res.ok) {
    markOutboxFlushed(opts.now);
    useMoneySyncStore.getState().setRemoteSynced(res.version, env.snapshotHash, opts.now);
    persistCursorNow(uid);
    useMoneySyncStore.getState().setStatus('ready');
    return { ok: true, action: 'pushed' };
  }
  if (res.reason === 'conflict') {
    return resolveConflict(adapter, uid, env, opts.now);
  }
  return fail('push_error', res.error.message);
}

/** Remote đi trước, local sạch → pull + apply remote vào store (suppressed). */
async function resolvePull(
  adapter: RemoteMoneySyncAdapter,
  uid: string,
  now: string,
): Promise<SyncCycleResult> {
  const pres = await adapter.pull(uid);
  if (!pres.ok) return fail('pull_error', pres.error.message);
  if (!pres.exists) {
    useMoneySyncStore.getState().setStatus('ready');
    return { ok: true, action: 'noop' };
  }
  const applyRes = applyRemoteMoneyState({
    userId: uid,
    envelope: pres.envelope,
    mode: 'apply',
    now,
    remoteVersion: pres.version,
  });
  if (applyRes.kind === 'rejected' || applyRes.kind === 'failed') {
    return fail(`apply_${applyRes.kind}`);
  }
  // applied/skipped → metadata cập nhật bởi pipeline; outbox (local sạch) flush.
  markOutboxFlushed(now);
  persistCursorNow(uid);
  useMoneySyncStore.getState().setStatus('ready');
  return { ok: true, action: 'pulled' };
}

/** Cùng base hai phía đổi → pull + merge + push merged + apply merged (suppressed). */
async function resolveConflict(
  adapter: RemoteMoneySyncAdapter,
  uid: string,
  env: MoneySyncEnvelopeV1,
  now: string,
): Promise<SyncCycleResult> {
  const pres = await adapter.pull(uid);
  if (!pres.ok) return fail('pull_error', pres.error.message);

  if (!pres.exists) {
    // Remote biến mất → push thẳng local.
    const res = await adapter.push(uid, env, 0);
    if (res.ok) {
      markOutboxFlushed(now);
      useMoneySyncStore.getState().setRemoteSynced(res.version, env.snapshotHash, now);
      persistCursorNow(uid);
      useMoneySyncStore.getState().setStatus('ready');
      return { ok: true, action: 'pushed' };
    }
    return fail('push_error', res.reason === 'error' ? res.error.message : 'conflict');
  }

  const merged = mergeCloudAndLocal({
    local: env.payload,
    cloud: pres.envelope.payload,
    now,
    deviceId: env.payload.lastPushedByDeviceId ?? 'controller',
  });
  const mergedEnv = buildSyncEnvelope({
    userId: uid,
    snapshotHash: `${env.snapshotHash}+${pres.envelope.snapshotHash}`,
    baseVersion: pres.version,
    localVersion: env.localVersion + 1,
    createdAt: now,
    payload: merged.merged,
  });

  const pushRes = await adapter.push(uid, mergedEnv, pres.version);
  if (!pushRes.ok) {
    if (pushRes.reason === 'conflict') return { ok: false, reason: 'conflict_retry' };
    return fail('push_error', pushRes.error.message);
  }

  const applyRes = applyRemoteMoneyState({
    userId: uid,
    envelope: mergedEnv,
    mode: 'apply',
    now,
    remoteVersion: pushRes.version,
  });
  if (applyRes.kind === 'rejected' || applyRes.kind === 'failed') {
    return fail(`apply_${applyRes.kind}`);
  }
  markOutboxFlushed(now);
  persistCursorNow(uid);
  useMoneySyncStore.getState().setStatus('ready');
  return { ok: true, action: 'merged' };
}

// ─── Lifecycle (flag-gated): pull-on-login + debounced push + reconnect ────────

let started = false;
let stopFns: Array<() => void> = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeAdapter: RemoteMoneySyncAdapter | null = null;
let nowProvider: () => string = () => new Date().toISOString();

/** Nạp cursor đã persist (nếu có) vào meta — resume outbox sau reload. */
function loadCursorIntoMeta(): void {
  const uid = useMoneySyncStore.getState().userId;
  if (!uid) return;
  const cur = loadSyncCursor(uid);
  if (!cur) return;
  useMoneySyncStore.setState({
    queue: cur.queue,
    baseVersion: cur.baseVersion,
    lastSyncedHash: cur.lastSyncedHash,
    lastSnapshotHash: cur.lastSnapshotHash ?? useMoneySyncStore.getState().lastSnapshotHash,
  });
}

function scheduleDebounced(ms: number): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (activeAdapter) void runMoneySyncCycle(activeAdapter, { now: nowProvider() });
  }, ms);
}

/**
 * Bật sync production. No-op nếu flag tắt hoặc đã start. Idempotent.
 * Pull-on-login ngay; push debounced khi outbox đổi; flush khi reconnect.
 */
export function startProductionSync(
  adapter: RemoteMoneySyncAdapter,
  opts?: { now?: () => string; debounceMs?: number },
): void {
  if (!isMoneySyncEnabled()) return; // FLAG GATE — mặc định tắt
  if (started) return;
  started = true;
  activeAdapter = adapter;
  nowProvider = opts?.now ?? (() => new Date().toISOString());
  const debounceMs = opts?.debounceMs ?? 2500;

  loadCursorIntoMeta();

  // pull-on-login
  void runMoneySyncCycle(adapter, { now: nowProvider() });

  // debounced push khi outbox có pending mới
  const unsub = useMoneySyncStore.subscribe((s, prev) => {
    if (s.queue === prev.queue) return;
    if (getPendingRetryable(s.queue).length === 0) return;
    scheduleDebounced(debounceMs);
  });
  stopFns.push(unsub);

  // reconnect flush
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onOnline = () => {
      if (activeAdapter) void runMoneySyncCycle(activeAdapter, { now: nowProvider() });
    };
    window.addEventListener('online', onOnline);
    stopFns.push(() => window.removeEventListener('online', onOnline));
  }
}

/** Tắt sync production (unmount / account boundary). Idempotent. */
export function stopProductionSync(): void {
  for (const fn of stopFns) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  stopFns = [];
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  started = false;
  activeAdapter = null;
}

/** Test seam: trạng thái lifecycle hiện tại. */
export function isProductionSyncStarted(): boolean {
  return started;
}
