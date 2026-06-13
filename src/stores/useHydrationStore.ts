/* ═══ Hydration Store (Phase 6B-1) ═══
 * Theo dõi store nào đã rehydrate xong từ localStorage. Dùng để gate snapshot
 * builder (Chat/CFO) — không build snapshot từ seed trước khi persisted load.
 * KHÔNG persist store này.
 */
'use client';

import { create } from 'zustand';

export type CoreStoreKey = 'finance' | 'budget' | 'goals' | 'tasks' | 'auth';

const CORE_KEYS: CoreStoreKey[] = ['finance', 'budget', 'goals', 'tasks', 'auth'];

interface HydrationState {
  finance: boolean;
  budget: boolean;
  goals: boolean;
  tasks: boolean;
  auth: boolean;
  markHydrated: (key: CoreStoreKey) => void;
  areCoreStoresHydrated: () => boolean;
}

export const useHydrationStore = create<HydrationState>((set, get) => ({
  finance: false,
  budget: false,
  goals: false,
  tasks: false,
  auth: false,
  markHydrated: (key) => set({ [key]: true } as Partial<HydrationState>),
  areCoreStoresHydrated: () => CORE_KEYS.every((k) => get()[k]),
}));

/** Helper thuần (đọc getState) — dùng ngoài React (chat snapshot guard, tests). */
export function areCoreStoresHydrated(): boolean {
  return useHydrationStore.getState().areCoreStoresHydrated();
}
