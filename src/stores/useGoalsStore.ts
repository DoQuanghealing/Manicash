/* ═══ Goals Store — CRUD Goals + Milestones + Deposits + Bank Link ═══ */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Goal, Milestone, GoalDeposit, GoalDepositSource, GoalBankInfo } from '@/types/budget';
import { useAuthStore } from '@/stores/useAuthStore';
import { STORE_KEYS, STORE_VERSIONS, onRehydrateMark } from '@/stores/persistConfig';

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const SEED_GOALS: Goal[] = [
  {
    id: 'goal-house', name: 'Mua nhà', icon: '🏠',
    targetAmount: 6_000_000_000, currentAmount: 120_000_000,
    deadline: '2035-12-31', color: '#7C3AED',
    /** Phase 1: khoản tiết kiệm đều mỗi tháng cho mục tiêu mua nhà */
    monthlyContributionTarget: 5_000_000,
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
    /** Phase 1: 2M/tháng để hoàn thành quỹ khẩn cấp trong thời hạn */
    monthlyContributionTarget: 2_000_000,
    milestones: [
      { id: 'ms-e1', name: '25 triệu', amount: 25_000_000, targetDate: '2026-06-01', isCompleted: false },
    ],
    createdAt: '2025-03-01',
  },
  {
    id: 'goal-car', name: 'Xe ô tô', icon: '🚗',
    targetAmount: 800_000_000, currentAmount: 35_000_000,
    deadline: '2029-12-31', color: '#3B82F6',
    /** Phase 1: 3M/tháng tích lũy mua xe */
    monthlyContributionTarget: 3_000_000,
    milestones: [
      { id: 'ms-c1', name: 'Đặt cọc 100 triệu', amount: 100_000_000, targetDate: '2027-06-01', isCompleted: false },
    ],
    createdAt: '2025-02-01',
  },
  {
    id: 'goal-invest', name: 'Vốn đầu tư', icon: '📈',
    targetAmount: 200_000_000, currentAmount: 45_000_000,
    deadline: '2027-12-31', color: '#F97316',
    /** Phase 1: 1.5M/tháng tích lũy vốn đầu tư */
    monthlyContributionTarget: 1_500_000,
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

  // Deposits
  /**
   * Nạp tiền vào 1 mục tiêu. Tự ghi vào deposits[] và update currentAmount.
   * Nếu là amount > 0 → grant SAVINGS_DEPOSIT XP.
   * `source` mặc định 'manual' (giữ backward-compat với caller cũ).
   */
  addFundsToGoal: (id: string, amount: number, source?: GoalDepositSource, note?: string) => string;
  /** Phase 5 (undo): xóa 1 deposit + trừ lại currentAmount. Trả false nếu không tìm thấy. */
  removeGoalDeposit: (goalId: string, depositId: string) => boolean;

  // Bank linking
  linkBankAccount: (goalId: string, info: Omit<GoalBankInfo, 'linkedAt'>) => void;
  unlinkBankAccount: (goalId: string) => void;

  // Photo + Why note (sticky)
  setPhoto: (goalId: string, dataUrl: string | undefined) => void;
  setWhyNote: (goalId: string, note: string) => void;

  // Milestone tracking (cho confetti)
  markMilestoneCelebrated: (goalId: string, milestone: 25 | 50 | 75 | 100) => void;

  // Milestones
  addMilestone: (goalId: string, data: Omit<Milestone, 'id' | 'isCompleted'>) => void;
  completeMilestone: (goalId: string, milestoneId: string) => void;

  // Computed
  getGoalProgress: (id: string) => number;
  getNextMilestone: (id: string) => Milestone | null;
  getTotalSaved: () => number;
  getDeposits: (id: string) => GoalDeposit[];
}

const isDemoSeed = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
  goals: isDemoSeed ? SEED_GOALS : [],

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

  addFundsToGoal: (id, amount, source = 'manual', note) => {
    const deposit: GoalDeposit = {
      id: genId('dep'),
      amount,
      source,
      note,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === id
          ? {
              ...g,
              currentAmount: g.currentAmount + amount,
              deposits: [...(g.deposits || []), deposit],
            }
          : g
      ),
    }));
    // SAVINGS_DEPOSIT XP — chỉ grant khi deposit dương.
    if (amount > 0) {
      useAuthStore.getState().awardXP({ type: 'SAVINGS_DEPOSIT', amount });
    }
    return deposit.id;
  },

  removeGoalDeposit: (goalId, depositId) => {
    const goal = get().goals.find((g) => g.id === goalId);
    const deposit = goal?.deposits?.find((d) => d.id === depositId);
    if (!goal || !deposit) return false;
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              currentAmount: g.currentAmount - deposit.amount,
              deposits: (g.deposits || []).filter((d) => d.id !== depositId),
            }
          : g
      ),
    }));
    // Lưu ý Phase 5: KHÔNG đảo XP SAVINGS_DEPOSIT (chưa có XP-reversal API).
    return true;
  },

  linkBankAccount: (goalId, info) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId
          ? { ...g, bankInfo: { ...info, linkedAt: new Date().toISOString() } }
          : g
      ),
    })),

  unlinkBankAccount: (goalId) =>
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const { bankInfo: _omit, ...rest } = g;
        void _omit;
        return rest;
      }),
    })),

  setPhoto: (goalId, dataUrl) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId ? { ...g, photoUrl: dataUrl } : g
      ),
    })),

  setWhyNote: (goalId, note) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId ? { ...g, whyNote: note } : g
      ),
    })),

  markMilestoneCelebrated: (goalId, milestone) =>
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === goalId ? { ...g, lastCelebratedMilestone: milestone } : g
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

  getDeposits: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return [];
    // Reverse để mới nhất lên đầu
    return [...(goal.deposits || [])].reverse();
  },
    }),
    {
      name: STORE_KEYS.goals,
      version: STORE_VERSIONS.goals,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ goals: s.goals }),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<GoalsState>;
        return { ...p, goals: Array.isArray(p.goals) ? p.goals : [] } as GoalsState;
      },
      onRehydrateStorage: onRehydrateMark('goals'),
    },
  ),
);
