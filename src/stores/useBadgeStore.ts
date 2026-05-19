import { create } from 'zustand';
import { BADGES, type BadgeDefinition } from '@/data/badgeDefinitions';
import { computeAllMetrics, getCurrentLevel } from '@/lib/badgeMetrics';
import { useAuthStore } from './useAuthStore';
import { useTaskStore } from './useTaskStore';
import { useFinanceStore } from './useFinanceStore';
import { useBudgetStore } from './useBudgetStore';
import { useGoalsStore } from './useGoalsStore';

export interface BadgeWithLevel {
  badge: BadgeDefinition;
  level: number;       // 0-5
  value: number;       // current metric value
  nextThreshold: number;
  progress: number;    // 0-1 progress to next level
}

interface BadgeState {
  /**
   * Re-compute all badge levels from current store state
   */
  computeBadges: () => BadgeWithLevel[];
  
  /**
   * Check if any badge newly unlocked compared to cached previous levels.
   * previous map: { badgeId: level }
   */
  checkNewUnlocks: (previous: Record<string, number>) => BadgeWithLevel[];
}

export const useBadgeStore = create<BadgeState>((set, get) => ({
  computeBadges: () => {
    // Collect snapshots from all related stores
    const snapshot = {
      auth: { user: useAuthStore.getState().user },
      tasks: { tasks: useTaskStore.getState().tasks },
      finance: { transactions: useFinanceStore.getState().transactions },
      budget: { 
        monthlySnapshots: useBudgetStore.getState().monthlySnapshots,
        categoryBudgets: useBudgetStore.getState().categoryBudgets 
      },
      goals: { goals: useGoalsStore.getState().goals },
    };

    const metrics = computeAllMetrics(snapshot);

    const result: BadgeWithLevel[] = BADGES.map((badge) => {
      const value = metrics[badge.metric] || 0;
      const level = getCurrentLevel(value, badge.thresholds, badge.metric);
      
      const prevThreshold = level === 0 ? 0 : badge.thresholds[level - 1] || 0;
      const nextThreshold = level >= 5 ? badge.thresholds[4] : badge.thresholds[level];
      
      let progress = 0;
      if (level >= 5) {
        progress = 1;
      } else {
        const range = nextThreshold - prevThreshold;
        if (range > 0) {
          progress = Math.max(0, Math.min(1, (value - prevThreshold) / range));
        }
      }

      return {
        badge,
        level,
        value,
        nextThreshold,
        progress,
      };
    });

    return result;
  },

  checkNewUnlocks: (previous) => {
    const currentBadges = get().computeBadges();
    return currentBadges.filter((b) => {
      const prevLevel = previous[b.badge.id] || 0;
      return b.level > prevLevel;
    });
  },
}));
