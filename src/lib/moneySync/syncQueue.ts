/* ═══ Money Sync — Pending Write Queue (Phase 6B-2A) ═══
 * Offline-safe model cho pending cloud writes.
 *
 * Design:
 *  - Pure data model — không import Firebase / Zustand / localStorage.
 *  - Caller (UI / sync trigger) owns storage; queue helpers chỉ transform records.
 *  - maxAttempts = 5 để tránh vòng lặp vô tận khi Firestore lỗi lâu dài.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingWriteStatus = 'pending' | 'flushed' | 'failed';

export type PendingMoneySyncWrite = {
  id: string;           // unique write id (uuid/nanoid từ caller)
  uid: string;          // firebase uid
  enqueuedAt: string;   // ISO timestamp (từ caller)
  status: PendingWriteStatus;
  attempts: number;
  lastAttemptAt: string | null;
  failReason: string | null;
};

export const MAX_PENDING_WRITE_ATTEMPTS = 5;

// ─── Helpers (pure — return new record, không mutate) ─────────────────────────

export function enqueuePendingWrite(
  id: string,
  uid: string,
  now: string,
): PendingMoneySyncWrite {
  return {
    id,
    uid,
    enqueuedAt: now,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    failReason: null,
  };
}

export function incrementPendingWriteAttempt(
  record: PendingMoneySyncWrite,
  now: string,
): PendingMoneySyncWrite {
  return {
    ...record,
    attempts: record.attempts + 1,
    lastAttemptAt: now,
  };
}

export function markPendingWriteFlushed(
  record: PendingMoneySyncWrite,
  now: string,
): PendingMoneySyncWrite {
  return {
    ...record,
    status: 'flushed',
    lastAttemptAt: now,
    failReason: null,
  };
}

export function markPendingWriteFailed(
  record: PendingMoneySyncWrite,
  now: string,
  reason: string,
): PendingMoneySyncWrite {
  const updated = incrementPendingWriteAttempt(record, now);
  return {
    ...updated,
    status: updated.attempts >= MAX_PENDING_WRITE_ATTEMPTS ? 'failed' : 'pending',
    failReason: reason,
  };
}

/** Lọc các write còn có thể retry (pending + chưa vượt maxAttempts). */
export function getPendingRetryable(
  records: PendingMoneySyncWrite[],
): PendingMoneySyncWrite[] {
  return records.filter(
    (r) => r.status === 'pending' && r.attempts < MAX_PENDING_WRITE_ATTEMPTS,
  );
}
