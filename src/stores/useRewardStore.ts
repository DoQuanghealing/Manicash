/* ═══ Reward Store — Tracking các item đã unlock ═══
 *
 * Single source of truth cho:
 *   - unlockedIds: danh sách reward đã mở khóa
 *   - activeZodiac: con giáp đang hiển thị trên header runner (user chọn)
 *   - activeTheme: theme đang dùng
 *   - activeTitle: title hiển thị sau tên
 *   - viewedRewards: id reward user đã xem trong tủ sưu tầm (để hiện badge "MỚI")
 *
 * Mọi nơi grant reward phải đi qua `unlockReward(id)` — idempotent.
 * Mệnh chủ (zodiac theo yearOfBirth) auto-unlock bằng `unlockMenhChu()`.
 */
'use client';

import { create } from 'zustand';
import { getRewardById, getZodiacByChiIndex } from '@/data/rewardCatalog';
import { getBanMenh } from '@/lib/banMenh';
import { useAuthStore } from './useAuthStore';

export interface RewardUnlock {
  id: string;
  unlockedAt: string; // ISO
}

interface RewardState {
  unlocked: RewardUnlock[];      // append-only
  viewedIds: string[];           // marked seen in collection drawer
  activeZodiac: string | null;   // reward id (zodiac-*)
  activeTheme: string;           // reward id, default 'theme-default'
  activeTitle: string | null;    // reward id
  activeButler: string;          // reward id, default 'butler-default'

  /**
   * Unlock 1 reward. Idempotent — đã unlock thì no-op trả về { granted: false }.
   * Returns { granted, item } để caller fire toast/celebration.
   */
  unlockReward: (id: string) => { granted: boolean; item: ReturnType<typeof getRewardById> };

  /** Bulk unlock (cho seed demo hoặc seasonal event). */
  unlockMany: (ids: string[]) => string[]; // returns ids newly unlocked

  /** Auto-unlock zodiac theo yearOfBirth (gọi khi user lưu profile có yearOfBirth). */
  unlockMenhChu: () => string | null; // returns id zodiac unlocked or null

  /** User chọn zodiac active (chạy header). Chỉ chấp nhận id đã unlock. */
  setActiveZodiac: (id: string | null) => void;
  setActiveTheme: (id: string) => void;
  setActiveTitle: (id: string | null) => void;
  setActiveButler: (id: string) => void;

  /** Đánh dấu user đã xem trong tủ sưu tầm. */
  markViewed: (ids: string[]) => void;

  /** Helpers. */
  isUnlocked: (id: string) => boolean;
  countUnlockedByType: (type: string) => number;
}

const DEFAULT_THEME = 'theme-default';
const DEFAULT_BUTLER = 'butler-default';

export const useRewardStore = create<RewardState>((set, get) => ({
  unlocked: [
    // Seed: theme default + butler default đã có sẵn
    { id: DEFAULT_THEME, unlockedAt: new Date().toISOString() },
    { id: DEFAULT_BUTLER, unlockedAt: new Date().toISOString() },
  ],
  viewedIds: [DEFAULT_THEME, DEFAULT_BUTLER],
  activeZodiac: null,
  activeTheme: DEFAULT_THEME,
  activeTitle: null,
  activeButler: DEFAULT_BUTLER,

  unlockReward: (id) => {
    const item = getRewardById(id);
    if (!item) return { granted: false, item: undefined };
    if (get().unlocked.some((u) => u.id === id)) {
      return { granted: false, item };
    }
    set((s) => ({
      unlocked: [...s.unlocked, { id, unlockedAt: new Date().toISOString() }],
    }));
    return { granted: true, item };
  },

  unlockMany: (ids) => {
    const existing = new Set(get().unlocked.map((u) => u.id));
    const fresh = ids.filter((id) => !existing.has(id) && getRewardById(id));
    if (fresh.length === 0) return [];
    const now = new Date().toISOString();
    set((s) => ({
      unlocked: [...s.unlocked, ...fresh.map((id) => ({ id, unlockedAt: now }))],
    }));
    return fresh;
  },

  unlockMenhChu: () => {
    const yearOfBirth = useAuthStore.getState().user?.yearOfBirth;
    const menh = getBanMenh(yearOfBirth);
    if (!menh) return null;
    const zodiac = getZodiacByChiIndex(menh.chiIndex);
    if (!zodiac) return null;
    const result = get().unlockReward(zodiac.id);
    if (result.granted) {
      // Auto-set làm active zodiac nếu chưa có
      if (!get().activeZodiac) {
        set({ activeZodiac: zodiac.id });
      }
      return zodiac.id;
    }
    return null;
  },

  setActiveZodiac: (id) => {
    if (id === null) {
      set({ activeZodiac: null });
      return;
    }
    if (!get().unlocked.some((u) => u.id === id)) return; // chưa unlock thì bỏ qua
    set({ activeZodiac: id });
  },
  setActiveTheme: (id) => {
    if (!get().unlocked.some((u) => u.id === id)) return;
    set({ activeTheme: id });
  },
  setActiveTitle: (id) => {
    if (id === null) {
      set({ activeTitle: null });
      return;
    }
    if (!get().unlocked.some((u) => u.id === id)) return;
    set({ activeTitle: id });
  },
  setActiveButler: (id) => {
    if (!get().unlocked.some((u) => u.id === id)) return;
    set({ activeButler: id });
  },

  markViewed: (ids) =>
    set((s) => ({
      viewedIds: Array.from(new Set([...s.viewedIds, ...ids])),
    })),

  isUnlocked: (id) => get().unlocked.some((u) => u.id === id),
  countUnlockedByType: (type) =>
    get().unlocked.filter((u) => {
      const item = getRewardById(u.id);
      return item?.type === type;
    }).length,
}));
