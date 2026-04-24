/* ═══ Goals Store — CRUD Goals + Milestones ═══ */
'use client';

import { create } from 'zustand';
import type { Goal, Milestone } from '@/types/budget';

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const SEED_GOALS: Goal[] = [
  {
    id: 'goal-house', name: 'Mua nhà', icon: '🏠',
    targetAmount: 6_000_000_000, currentAmount: 120_000_000,
    deadline: '2035-12-31', color: '#7C3AED',
    milestones: [
      { id: 'ms-h1', name: 'Đặt cọc 500 triệu', amount: 500_000_000, targetDate: '2028-06-01', isCompleted: false },
      { id: 'ms-h2', name: 'Tích lũy 2 tỷ', amount: 2_000_000_000, targetDate: '2031-12-01', isCompleted: false },
    ],
    createdAt: '2025-01-01',
  },
  {
    id: 'goal-emergency', name: 'Quỹ khẩn cấp', icon: '🛡️',
    targetAmount: 50_000_000, currentAmount: 12_500_000,
    deadline: '2026-12-31', color: '#22C55E',
    milestones: [
      { id: 'ms-e1', name: '25 triệu', amount: 25_000_000, targetDate: '2026-06-01', isCompleted: false },
    ],
    createdAt: '2025-03-01',
  },
  {
    id: 'goal-car', name: 'Xe ô tô', icon: '🚗',
    targetAmount: 800_000_000, currentAmount: 35_000_000,
    deadline: '2029-12-31', color: '#3B82F6',
    milestones: [
      { id: 'ms-c1', name: 'Đặt cọc 100 triệu', amount: 100_000_000, targetDate: '2027-06-01', isCompleted: false },
    ],
    createdAt: '2025-02-01',
  },
  {
    id: 'goal-invest', name: 'Vốn đầu tư', icon: '📈',
    targetAmount: 200_000_000, currentAmount: 45_000_000,
    deadline: '2027-12-31', color: '#F97316',
    milestones: [
      { id: 'ms-i1', name: '100 triệu đầu tiên', amount: 100_000_000, targetDate: '2026-12-01', isCompleted: false },
    ],
    createdAt: '2025-01-15',
  },
];

interface GoalsState {
  goals: Goal[];

  // CRUD
  addGoal: (data: Omit<Goal, 'id' | 'milestones' | 'createdAt'>) => void;
  updateGoal: (id: string, data: Partial<Pick<Goal, 'name' | 'icon' | 'targetAmount' | 'deadline' | 'color'>>) => void;
  deleteGoal: (id: string) => void;
  addFundsToGoal: (id: string, amount: number) => void;

  // Milestones
  addMilestone: (goalId: string, data: Omit<Milestone, 'id' | 'isCompleted'>) => void;
  completeMilestone: (goalId: string, milestoneId: string) => void;

  // Computed
  getGoalProgress: (id: string) => number;
  getNextMilestone: (id: string) => Milestone | null;
  getTotalSaved: () => number;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: SEED_GOALS,

  addGoal: (data) =>
    set((s) => ({
      goals: [...s.goals, { ...data, id: genId('goal'), milestones: [], createdAt: new Date().toISOString() }],
    })),

  updateGoal: (id, data) =>
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...data } : g)),
    })),

  deleteGoal: (id) =>
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

  addFundsToGoal: (id, amount) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g
      ),
    })),

  addMilestone: (goalId, data) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId
          ? { ...g, milestones: [...g.milestones, { ...data, id: genId('ms'), isCompleted: false }] }
          : g
      ),
    })),

  completeMilestone: (goalId, milestoneId) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              milestones: g.milestones.map((m) =>
                m.id === milestoneId ? { ...m, isCompleted: true, completedAt: new Date().toISOString() } : m
              ),
            }
          : g
      ),
    })),

  getGoalProgress: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal || goal.targetAmount === 0) return 0;
    return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
  },

  getNextMilestone: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return null;
    return goal.milestones.find((m) => !m.isCompleted) || null;
  },

  getTotalSaved: () => get().goals.reduce((sum, g) => sum + g.currentAmount, 0),
}));
