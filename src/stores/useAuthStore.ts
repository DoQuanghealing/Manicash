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
import { getDateKey, daysBetween } from '@/lib/dateHelpers';

const RANK_ORDER: UserRank[] = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond'];

/** Rank tương ứng với tổng XP — cao → thấp, lấy match đầu tiên. */
function rankFromXP(xp: number): UserRank {
  for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
    if (xp >= getTotalXPForRank(RANK_ORDER[i])) return RANK_ORDER[i];
  }
  return 'iron';
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

  /**
   * Tăng biến đếm resist và số tiền tiết kiệm được khi user từ chối mua sắm.
   */
  incrementResist: (savedAmount: number) => void;

  /**
   * Patch các trường identity/profile của user (displayName, email, photoURL,
   * yearOfBirth, ...). Không sửa rank/xp/streak — gọi action chuyên dụng cho
   * gamification. No-op khi user null.
   */
  updateUserProfile: (updates: Partial<UserProfile>) => void;
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

    const today = getDateKey(new Date());
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

  incrementResist: (savedAmount) => {
    const user = get().user;
    if (!user) return;
    const now = new Date();
    const today = getDateKey(now);

    // Trim resistByDate giữ last 30 ngày
    const prev = user.resistByDate || {};
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffKey = getDateKey(cutoff);
    const trimmed: Record<string, number> = {};
    for (const [k, v] of Object.entries(prev)) {
      if (k >= cutoffKey) trimmed[k] = v;
    }
    trimmed[today] = (trimmed[today] || 0) + 1;

    set({
      user: {
        ...user,
        resistCount: user.resistCount + 1,
        totalResistSaved: user.totalResistSaved + savedAmount,
        lastResistAt: now.toISOString(),
        resistByDate: trimmed,
        updatedAt: now.toISOString(),
      },
    });
  },

  updateUserProfile: (updates) => {
    const user = get().user;
    if (!user) return;
    // Guard: never let caller overwrite stats via this action.
    const safeUpdates: Partial<UserProfile> = { ...updates };
    delete safeUpdates.xp;
    delete safeUpdates.rank;
    delete safeUpdates.streak;
    delete safeUpdates.resistCount;
    delete safeUpdates.totalResistSaved;
    delete safeUpdates.uid;
    delete safeUpdates.createdAt;
    set({
      user: {
        ...user,
        ...safeUpdates,
        updatedAt: new Date().toISOString(),
      },
    });
  },
}));
