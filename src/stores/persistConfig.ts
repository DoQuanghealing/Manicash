/* ═══ Persistence Config (Phase 6B-1) ═══
 * Storage keys + versions + SSR-safe storage + onRehydrate hook dùng chung cho
 * các store tài chính. Local-first; KHÔNG cloud sync.
 */
'use client';

import { useHydrationStore, type CoreStoreKey } from '@/stores/useHydrationStore';

export const STORE_VERSIONS = {
  finance: 1,
  budget: 1,
  goals: 1,
  tasks: 1,
  auth: 1,
} as const;

export const STORE_KEYS = {
  finance: 'manicash.finance.v1',
  budget: 'manicash.budget.v1',
  goals: 'manicash.goals.v1',
  tasks: 'manicash.tasks.v1',
  auth: 'manicash.auth.v1',
} as const;

/**
 * onRehydrateStorage helper: sau khi rehydrate (kể cả khi chưa có persisted data),
 * đánh dấu store đã hydrate. Nuốt lỗi rehydrate để không crash app.
 */
export function onRehydrateMark(key: CoreStoreKey) {
  // Trả callback 0-arg để KHÔNG ràng buộc generic state của persist (tránh poison
  // type inference -> StateCreator<unknown>). Đánh dấu hydrated sau khi rehydrate.
  return () => () => {
    useHydrationStore.getState().markHydrated(key);
  };
}
