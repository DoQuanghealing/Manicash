/* ═══ Page Visit Store — Track lần cuối user vào từng page ═══
 *
 * Dùng cho daily quest detection (budget_viewed, wishlist_viewed).
 * Chỉ lưu ISO timestamp cuối — không tích lũy history.
 *
 * Cách dùng trong page component:
 *   useEffect(() => { usePageVisitStore.getState().recordVisit('ledger'); }, []);
 */
'use client';

import { create } from 'zustand';
import { getDateKey } from '@/lib/dateHelpers';

export type TrackedPage =
  | 'overview'
  | 'ledger'      // sổ cái / ngân sách
  | 'wishlist'
  | 'goals'
  | 'money'       // tab tiền (tasks + CFO)
  | 'profile';

interface PageVisitState {
  lastVisitedAt: Partial<Record<TrackedPage, string>>;

  recordVisit: (page: TrackedPage) => void;
  visitedToday: (page: TrackedPage) => boolean;
}

export const usePageVisitStore = create<PageVisitState>((set, get) => ({
  lastVisitedAt: {},

  recordVisit: (page) => {
    set((s) => ({
      lastVisitedAt: { ...s.lastVisitedAt, [page]: new Date().toISOString() },
    }));
  },

  visitedToday: (page) => {
    const ts = get().lastVisitedAt[page];
    if (!ts) return false;
    return getDateKey(new Date(ts)) === getDateKey(new Date());
  },
}));
