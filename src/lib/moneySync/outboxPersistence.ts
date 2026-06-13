/* ═══ Money Sync — Outbox / Cursor Persistence (Phase 6B-2E) ═══
 * Lưu outbox + sync cursor để SỐNG QUA RELOAD (offline queue bền).
 *
 * Account boundary: key namespaced theo UID (`manicash.moneysync.<uid>.v1`) →
 * không leak sang user khác. Load tự validate userId khớp. clearAllSyncCursors()
 * dọn mọi key khi logout/xóa tài khoản (gọi từ clearLocalMoneyPersistence).
 *
 * SSR-safe: no-op khi không có localStorage.
 */
import type { PendingMoneySyncWrite } from './syncQueue';

const KEY_PREFIX = 'manicash.moneysync.';
const KEY_SUFFIX = '.v1';

export type PersistedSyncCursor = {
  version: 1;
  userId: string;
  queue: PendingMoneySyncWrite[];
  baseVersion: number;
  lastSyncedHash: string | null;
  lastSnapshotHash: string | null;
};

function keyFor(uid: string): string {
  return `${KEY_PREFIX}${uid}${KEY_SUFFIX}`;
}

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Lưu cursor cho uid. No-op nếu uid rỗng hoặc không có localStorage. */
export function persistSyncCursor(uid: string, cursor: Omit<PersistedSyncCursor, 'version' | 'userId'>): void {
  if (!uid || !hasStorage()) return;
  try {
    const payload: PersistedSyncCursor = {
      version: 1,
      userId: uid,
      queue: cursor.queue,
      baseVersion: cursor.baseVersion,
      lastSyncedHash: cursor.lastSyncedHash,
      lastSnapshotHash: cursor.lastSnapshotHash,
    };
    localStorage.setItem(keyFor(uid), JSON.stringify(payload));
  } catch {
    /* nuốt lỗi quota/serialize */
  }
}

/** Đọc cursor cho uid. Trả null nếu thiếu / hỏng / userId không khớp. */
export function loadSyncCursor(uid: string): PersistedSyncCursor | null {
  if (!uid || !hasStorage()) return null;
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSyncCursor>;
    if (parsed.version !== 1 || parsed.userId !== uid) return null; // account safety
    return {
      version: 1,
      userId: uid,
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      baseVersion: typeof parsed.baseVersion === 'number' ? parsed.baseVersion : 0,
      lastSyncedHash: typeof parsed.lastSyncedHash === 'string' ? parsed.lastSyncedHash : null,
      lastSnapshotHash: typeof parsed.lastSnapshotHash === 'string' ? parsed.lastSnapshotHash : null,
    };
  } catch {
    return null;
  }
}

/** Xóa cursor của 1 uid. */
export function clearSyncCursor(uid: string): void {
  if (!uid || !hasStorage()) return;
  try {
    localStorage.removeItem(keyFor(uid));
  } catch {
    /* ignore */
  }
}

/** Xóa TẤT CẢ cursor money-sync (account boundary / logout). */
export function clearAllSyncCursors(): void {
  if (!hasStorage()) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX) && k.endsWith(KEY_SUFFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
