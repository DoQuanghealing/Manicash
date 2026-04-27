/* ═══ Auth Store — Zustand ═══
 * Quản lý UserProfile + XP infrastructure (awardXP, updateStreak).
 * XP grant là single source of truth — mọi nơi muốn grant phải đi qua awardXP.
 */
'use client';

import { create } from 'zustand';
import type { UserProfile, FirebaseUserMinimal, UserRank } from '@/types/user';
import type { XPAction } from '@/types/gamification';
import { calculateXP, applyPenalty, getTotalXPForRank } from '@/lib/xpEngine';
import { useTaskStore } from '@/stores/useTaskStore';
import { emitXPGranted } from '@/lib/xpEvents';

const RANK_ORDER: UserRank[] = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond'];

/** Rank tương ứng với tổng XP — cao → thấp, lấy match đầu tiên. */
function rankFromXP(xp: number): UserRank {
  for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
    if (xp >= getTotalXPForRank(RANK_ORDER[i])) return RANK_ORDER[i];
  }
  return 'iron';
}

/** Local YYYY-MM-DD — dùng local date của user, KHÔNG UTC. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Số ngày giữa 2 ISO date (YYYY-MM-DD). Negative nếu a > b. */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

interface AuthStore {
  user: UserProfile | null;
  firebaseUser: FirebaseUserMinimal | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;

  setFirebaseUser: (user: FirebaseUserMinimal | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setDemoMode: (isDemo: boolean) => void;
  logout: () => void;

  /**
   * Single entry point để grant XP. Tự apply task penalty multiplier (nếu có).
   * Trả về số XP thực tế đã cộng (đã round + penalty); 0 nếu user null hoặc XP = 0.
   * No-op khi user null (demo mode chưa init profile).
   */
  awardXP: (action: XPAction) => number;

  /**
   * Cập nhật streak khi user log transaction. Idempotent trong cùng ngày.
   * Trả về { streakAdvanced, currentStreak, xpAwarded } — caller dùng để show feedback.
   */
  updateStreak: () => { streakAdvanced: boolean; currentStreak: number; xpAwarded: number };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  isDemoMode: false,

  setFirebaseUser: (firebaseUser) =>
    set({
      firebaseUser,
      isAuthenticated: !!firebaseUser,
    }),

  setUserProfile: (user) =>
    set({ user }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setDemoMode: (isDemoMode) =>
    set({ isDemoMode }),

  logout: () =>
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: false,
      isDemoMode: false,
    }),

  awardXP: (action) => {
    const user = get().user;
    if (!user) return 0;

    const baseXP = calculateXP(action);
    if (baseXP === 0) return 0;

    // Apply penalty multiplier from overdue tasks (only for positive XP).
    const multiplier = useTaskStore.getState().getActiveXPMultiplier();
    const granted = baseXP > 0 ? applyPenalty(baseXP, multiplier) : baseXP;
    if (granted === 0) return 0;

    const newXP = Math.max(0, user.xp + granted);
    set({
      user: {
        ...user,
        xp: newXP,
        rank: rankFromXP(newXP),
        updatedAt: new Date().toISOString(),
      },
    });

    // Emit cho XPToastHost — listener mount ở app shell.
    emitXPGranted({ type: action.type, amount: granted, totalXp: newXP });

    return granted;
  },

  updateStreak: () => {
    const user = get().user;
    if (!user) return { streakAdvanced: false, currentStreak: 0, xpAwarded: 0 };

    const today = todayLocal();
    const last = (user.lastActiveDate || '').slice(0, 10);

    // Đã log hôm nay → no-op (per spec: không grant lần 2 trong ngày).
    if (last === today) {
      return { streakAdvanced: false, currentStreak: user.streak, xpAwarded: 0 };
    }

    // Tính streak mới: liên tiếp (gap = 1) → +1, gap > 1 hoặc không có lastActive → reset về 1.
    const gap = last ? daysBetween(last, today) : Infinity;
    const newStreak = gap === 1 ? user.streak + 1 : 1;

    // Update profile trước (để rank tier-XP grant tính đúng).
    set({
      user: {
        ...user,
        streak: newStreak,
        lastActiveDate: today,
        updatedAt: new Date().toISOString(),
      },
    });

    // Grant XP base + bonus mốc 7-day là 2 awardXP riêng → 2 toast event riêng.
    const baseAwarded = get().awardXP({ type: 'DAILY_STREAK', days: newStreak });
    const bonusAwarded = newStreak > 0 && newStreak % 7 === 0
      ? get().awardXP({ type: 'STREAK_BONUS' })
      : 0;

    return {
      streakAdvanced: true,
      currentStreak: newStreak,
      xpAwarded: baseAwarded + bonusAwarded,
    };
  },
}));
