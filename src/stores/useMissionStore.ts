/* ═══ Mission Store — Track completed mission IDs + grant XP ═══
 * Lift state từ MissionChecklist (was local Set) lên store để:
 *   - Idempotent XP grant: hoàn thành mission lần 1 → +50 XP, lần 2+ → no-op
 *   - Cross-component visibility: future Phần khác có thể check completion
 *   - Persist across remount (in-memory; future có thể wrap zustand persist)
 */
'use client';

import { create } from 'zustand';
import { useAuthStore } from '@/stores/useAuthStore';

interface MissionState {
  completedMissionIds: string[];

  /** Đánh dấu mission đã hoàn thành. Idempotent — grant XP duy nhất 1 lần. */
  completeMission: (id: string) => { granted: boolean; xpAwarded: number };
  /** Bỏ tick (toggle). Không hoàn lại XP — đã grant là giữ. */
  uncompleteMission: (id: string) => void;
  /** Check tiện ích cho UI. */
  isCompleted: (id: string) => boolean;
}

export const useMissionStore = create<MissionState>((set, get) => ({
  completedMissionIds: [],

  completeMission: (id) => {
    if (get().completedMissionIds.includes(id)) {
      return { granted: false, xpAwarded: 0 };
    }
    set((s) => ({ completedMissionIds: [...s.completedMissionIds, id] }));
    const xpAwarded = useAuthStore.getState().awardXP({ type: 'MISSION_COMPLETE' });
    return { granted: true, xpAwarded };
  },

  uncompleteMission: (id) =>
    set((s) => ({
      completedMissionIds: s.completedMissionIds.filter((x) => x !== id),
    })),

  isCompleted: (id) => get().completedMissionIds.includes(id),
}));
