/* ═══ useSovereignMigrationStore — mốc báo trước PV-5 (bước 3) ═══
 * Ghi ngày ĐẦU TIÊN user thấy thông báo migration để đếm 14 ngày báo + 7 ngày trial.
 * Persist localStorage; clearAll wire vào clearLocalPersistence (account boundary).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const SOVEREIGN_MIGRATION_STORAGE_KEY = 'manicash.sovereign.migration.v1';

interface SovereignMigrationState {
  /** ISO ngày bắt đầu đếm báo trước. null = chưa bắt đầu. */
  noticeStartedAt: string | null;
  /** ISO lần cuối user đóng banner (ẩn trong ngày, hôm sau hiện lại). */
  bannerDismissedAt: string | null;
  startNotice: (nowISO: string) => void;
  dismissBanner: (nowISO: string) => void;
  clearAll: () => void;
}

export const useSovereignMigrationStore = create<SovereignMigrationState>()(
  persist(
    (set, get) => ({
      noticeStartedAt: null,
      bannerDismissedAt: null,
      startNotice: (nowISO) => {
        // Chỉ ghi LẦN ĐẦU — không reset đồng hồ nếu đã bắt đầu.
        if (get().noticeStartedAt) return;
        set({ noticeStartedAt: nowISO });
      },
      dismissBanner: (nowISO) => set({ bannerDismissedAt: nowISO }),
      clearAll: () => set({ noticeStartedAt: null, bannerDismissedAt: null }),
    }),
    {
      name: SOVEREIGN_MIGRATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Banner đã bị đóng trong CÙNG NGÀY chưa (hôm sau hiện lại). */
export function isBannerDismissedToday(dismissedAtISO: string | null, nowISO: string): boolean {
  if (!dismissedAtISO) return false;
  return dismissedAtISO.slice(0, 10) === nowISO.slice(0, 10);
}
