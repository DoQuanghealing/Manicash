/* ═══ useCareStore — nhịp "chăm sóc" của Phú Vương (Care Companion, Cấp 3) ═══
 * Giữ ETHICS_CHARTER §9: tối đa 1 kịch bản/ngày, mỗi kịch bản cooldown ≥3 ngày,
 * bỏ qua = lùi không nài. Persist localStorage; clearAll wire vào clearLocalPersistence
 * (account boundary — không rò kịch bản đã xử lý sang user kế tiếp cùng browser).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const CARE_STORAGE_KEY = 'manicash.care.companion.v1';

/** Số ngày không hiện lại MỘT kịch bản đã xử lý/bỏ qua. */
export const CARE_COOLDOWN_DAYS = 3;

interface CareState {
  /** id kịch bản → ISO thời điểm xử lý/bỏ qua gần nhất (cooldown per-script). */
  handled: Record<string, string>;
  /** dateKey (YYYY-MM-DD) lần cuối user xử lý MỘT kịch bản — chốt "1/ngày". */
  lastActionDateKey: string | null;
  /** User bấm hành động HOẶC bỏ qua → ghi cooldown + chốt 1/ngày. */
  ack: (id: string, dateKey: string, nowISO: string) => void;
  clearAll: () => void;
}

export const useCareStore = create<CareState>()(
  persist(
    (set) => ({
      handled: {},
      lastActionDateKey: null,
      ack: (id, dateKey, nowISO) =>
        set((s) => ({
          handled: { ...s.handled, [id]: nowISO },
          lastActionDateKey: dateKey,
        })),
      clearAll: () => set({ handled: {}, lastActionDateKey: null }),
    }),
    {
      name: CARE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Kịch bản còn trong cooldown (vừa xử lý/bỏ qua gần đây) → tạm ẩn. */
export function isCareInCooldown(handledAtISO: string | undefined, now: number): boolean {
  if (!handledAtISO) return false;
  const t = new Date(handledAtISO).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t < CARE_COOLDOWN_DAYS * 86_400_000;
}
