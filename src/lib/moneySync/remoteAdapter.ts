/* ═══ Money Sync — Remote Adapter Contract (Phase 6B-2C) ═══
 * Contract chuẩn hóa cho remote sync (cloud giả lập trong phase này). KHÔNG bật
 * remote thật, KHÔNG network thật. firestoreAdapter (load/save) vẫn là seam tương
 * lai; contract này phong phú hơn: head/version + optimistic-concurrency push.
 *
 * PURE types — file này chỉ khai báo contract + lỗi mô phỏng. Không I/O.
 */
import type { MoneySyncEnvelopeV1 } from './syncEnvelope';

// ─── Errors mô phỏng ────────────────────────────────────────────────────────

export type RemoteSyncErrorKind = 'network' | 'permission' | 'conflict' | 'unknown';

export type RemoteSyncError = {
  kind: RemoteSyncErrorKind;
  message: string;
};

// ─── Remote head / version ──────────────────────────────────────────────────

export type RemoteMoneyHead = {
  exists: boolean;
  /** 0 khi remote rỗng; tăng mỗi lần có thay đổi thật. */
  version: number;
  snapshotHash: string | null;
  updatedAt: string | null;
};

// ─── Pull / push results ────────────────────────────────────────────────────

export type RemotePullResult =
  | { ok: true; exists: false }
  | { ok: true; exists: true; envelope: MoneySyncEnvelopeV1; version: number }
  | { ok: false; error: RemoteSyncError };

export type RemotePushResult =
  | { ok: true; version: number; head: RemoteMoneyHead; deduped: boolean }
  | { ok: false; reason: 'conflict'; remoteHead: RemoteMoneyHead }
  | { ok: false; reason: 'error'; error: RemoteSyncError };

// ─── Contract ───────────────────────────────────────────────────────────────

export interface RemoteMoneySyncAdapter {
  /** Đọc head/version hiện tại của user (account-scoped). */
  getHead(userId: string): Promise<RemoteMoneyHead>;
  /** Pull envelope remote của user; exists=false khi remote rỗng. */
  pull(userId: string): Promise<RemotePullResult>;
  /**
   * Push envelope với optimistic concurrency:
   *  - expectedBaseVersion phải khớp remote head version, nếu không → conflict.
   *  - push trùng snapshotHash → no-op (deduped=true), version KHÔNG tăng.
   */
  push(
    userId: string,
    envelope: MoneySyncEnvelopeV1,
    expectedBaseVersion: number,
  ): Promise<RemotePushResult>;
}

// ─── Decision (PURE) ──────────────────────────────────────────────────────────

export type SyncDecision =
  | { kind: 'noop'; reason: 'same_hash' | 'in_sync' }
  | { kind: 'push'; reason: 'remote_empty' | 'local_ahead' }
  | { kind: 'pull'; reason: 'remote_ahead' }
  | { kind: 'conflict'; reason: 'diverged' };

export type DecideSyncInput = {
  /** Hash state local hiện tại. */
  localHash: string;
  /** Hash mà local đã đồng bộ với remote lần gần nhất (null nếu chưa từng). */
  baseHash: string | null;
  /** Remote version mà local thấy lần gần nhất. */
  baseVersion: number;
  remote: RemoteMoneyHead;
};

/**
 * Quyết định hành động sync (thuần, không I/O):
 *  - remote rỗng → push (remote_empty)
 *  - remote.hash == localHash → noop (same_hash, đã giống hệt)
 *  - localChanged && !remoteChanged → push (local_ahead)
 *  - !localChanged && remoteChanged → pull (remote_ahead)
 *  - localChanged && remoteChanged → conflict (diverged, cùng base hai phía đổi)
 *  - !localChanged && !remoteChanged → noop (in_sync)
 */
export function decideSyncAction(input: DecideSyncInput): SyncDecision {
  const { localHash, baseHash, baseVersion, remote } = input;

  if (!remote.exists) return { kind: 'push', reason: 'remote_empty' };
  if (remote.snapshotHash === localHash) return { kind: 'noop', reason: 'same_hash' };

  const localChanged = baseHash === null ? true : localHash !== baseHash;
  const remoteChanged = remote.version !== baseVersion;

  if (localChanged && !remoteChanged) return { kind: 'push', reason: 'local_ahead' };
  if (!localChanged && remoteChanged) return { kind: 'pull', reason: 'remote_ahead' };
  if (localChanged && remoteChanged) return { kind: 'conflict', reason: 'diverged' };
  return { kind: 'noop', reason: 'in_sync' };
}
