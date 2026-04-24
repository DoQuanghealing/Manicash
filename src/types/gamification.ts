/* ═══ Gamification Types ═══ */

import type { UserRank } from './user';

export interface RankDefinition {
  id: UserRank;
  name: string;
  icon: string;
  xpRequired: number;
  gradientFrom: string;
  gradientTo: string;
  encouragement: string;
  perkDescription: string;
  unlockedCourse: string | null;
}

export interface XPAction {
  type: XPActionType;
  amount?: number;
  savedAmount?: number;
  earnedAmount?: number;
  daysEarly?: number;
  days?: number;
}

export type XPActionType =
  | 'INCOME_LOGGED'
  | 'EXPENSE_LOGGED'
  | 'RESIST_SPENDING'
  | 'MISSION_COMPLETE'
  | 'DAILY_STREAK'
  | 'BUDGET_ON_TRACK'
  | 'SAVINGS_DEPOSIT'
  | 'TASK_COMPLETE'
  | 'TASK_OVERDUE';
