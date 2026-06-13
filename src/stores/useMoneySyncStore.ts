/* ═══ Money Sync Meta Store — Zustand (Phase 6B-2B) ═══
 * Trạng thái runtime + outbox (pending writes) cho client money sync.
 *
 * Account boundary: KHÔNG persist (in-memory). Lý do — outbox/metadata không
 * được phép leak sang user kế tiếp trên cùng browser. clearLocalMoneyPersistence
 * + resetMoneySyncRuntime gọi reset() để dọn sạch khi logout / xóa tài khoản /
 * đổi user. Money DATA thật vẫn do 5 store tài chính persist.
 */
'use client';

import { create } from 'zustand';
import {
  type PendingMoneySyncWrite,
  getPendingRetryable,
} from '@/lib/moneySync/syncQueue';

export type MoneySyncStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'dirty'
  | 'syncing'
  | 'error'
  | 'stopped';

interface MoneySyncMetaState {
  userId: string | null;
  status: MoneySyncStatus;
  /** Outbox — pending writes chờ flush lên adapter. */
  queue: PendingMoneySyncWrite[];
  lastSnapshotHash: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;

  // ── actions ──
  reset: () => void;
  setStatus: (status: MoneySyncStatus) => void;
  setUserId: (userId: string | null) => void;
  setLastHash: (hash: string | null) => void;
  enqueueWrite: (write: PendingMoneySyncWrite) => void;
  replaceQueue: (queue: PendingMoneySyncWrite[]) => void;
  markSynced: (at: string) => void;
  setError: (message: string | null) => void;

  // ── derived ──
  getPendingCount: () => number;
}

const INITIAL = {
  userId: null,
  status: 'idle' as MoneySyncStatus,
  queue: [] as PendingMoneySyncWrite[],
  lastSnapshotHash: null,
  lastSyncedAt: null,
  lastError: null,
};

export const useMoneySyncStore = create<MoneySyncMetaState>((set, get) => ({
  ...INITIAL,

  reset: () => set({ ...INITIAL, queue: [] }),

  setStatus: (status) => set({ status }),

  setUserId: (userId) => set({ userId }),

  setLastHash: (lastSnapshotHash) => set({ lastSnapshotHash }),

  enqueueWrite: (write) => set((s) => ({ queue: [...s.queue, write] })),

  replaceQueue: (queue) => set({ queue }),

  markSynced: (at) => set({ lastSyncedAt: at, lastError: null }),

  setError: (lastError) => set({ lastError }),

  getPendingCount: () => getPendingRetryable(get().queue).length,
}));
