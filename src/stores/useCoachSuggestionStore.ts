/* ═══ useCoachSuggestionStore — nhớ đề xuất đã bỏ qua (PV-2) ═══
 * Lưu {id → ISO bỏ qua} để KHÔNG nài lại sớm (cooldown). Persist localStorage;
 * clearAll wire vào clearLocalPersistence (account boundary — không rò sang user khác).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const COACH_SUGGESTION_STORAGE_KEY = 'manicash.coach.suggestions.v1';

/** Số ngày không hiện lại một đề xuất đã bị bỏ qua. */
export const COACH_DISMISS_COOLDOWN_DAYS = 3;

interface CoachSuggestionState {
  /** id đề xuất → ISO thời điểm bỏ qua. */
  dismissed: Record<string, string>;
  dismiss: (id: string, nowISO: string) => void;
  clearAll: () => void;
}

export const useCoachSuggestionStore = create<CoachSuggestionState>()(
  persist(
    (set) => ({
      dismissed: {},
      dismiss: (id, nowISO) =>
        set((s) => ({ dismissed: { ...s.dismissed, [id]: nowISO } })),
      clearAll: () => set({ dismissed: {} }),
    }),
    {
      name: COACH_SUGGESTION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Đề xuất còn trong thời gian cooldown (đã bỏ qua gần đây) → tạm ẩn. */
export function isInCooldown(dismissedAtISO: string | undefined, now: number): boolean {
  if (!dismissedAtISO) return false;
  const t = new Date(dismissedAtISO).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t < COACH_DISMISS_COOLDOWN_DAYS * 86_400_000;
}
