/* ═══ XP Calculation Engine ═══ */
import type { XPAction } from '@/types/gamification';

const XP_REWARDS: Record<string, (action: XPAction) => number> = {
  INCOME_LOGGED: (action) => {
    const base = 15;
    const bonus = Math.floor((action.earnedAmount || 0) / 1_000_000) * 5;
    return base + Math.min(bonus, 50);
  },

  EXPENSE_LOGGED: () => 10,

  RESIST_SPENDING: (action) => {
    const base = 25;
    const savingsBonus = Math.floor((action.savedAmount || 0) / 500_000) * 10;
    return (base + Math.min(savingsBonus, 50)) * 2; // x2 DISCIPLINE BONUS
  },

  MISSION_COMPLETE: () => 50,

  DAILY_STREAK: (action) => {
    const days = action.days || 1;
    if (days >= 30) return 30;
    if (days >= 14) return 20;
    if (days >= 7) return 15;
    return 10;
  },

  // Mốc 7-day (7, 14, 21, 28...) — emit như XP action riêng để toast hiển thị 🔥.
  STREAK_BONUS: () => 500,

  BUDGET_ON_TRACK: () => 20,

  SAVINGS_DEPOSIT: (action) => {
    const base = 20;
    const bonus = Math.floor((action.amount || 0) / 1_000_000) * 10;
    return base + Math.min(bonus, 100);
  },

  TASK_COMPLETE: (action) => {
    // XP = (Tiền kiếm × Hệ số) + Bonus hoàn thành sớm
    const base = Math.floor((action.earnedAmount || 0) / 500_000) * 10;
    const earlyBonus = (action.daysEarly || 0) * 5; // 5 XP mỗi ngày sớm
    return Math.max(20, base + earlyBonus);
  },

  TASK_OVERDUE: () => -15, // Penalty: trừ XP cố định
};

/** Apply penalty multiplier from overdue tasks */
export function applyPenalty(baseXP: number, multiplier: number): number {
  return Math.round(baseXP * multiplier);
}

export function calculateXP(action: XPAction): number {
  const calculator = XP_REWARDS[action.type];
  if (!calculator) return 0;
  return calculator(action);
}

export function getTotalXPForRank(rank: string): number {
  const thresholds: Record<string, number> = {
    iron: 0,
    bronze: 500,
    silver: 2000,
    gold: 5000,
    platinum: 12000,
    emerald: 25000,
    diamond: 50000,
  };
  return thresholds[rank] || 0;
}
