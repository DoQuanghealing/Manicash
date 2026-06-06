/**
 * exportUserData — collect tất cả dữ liệu người dùng từ local store và tải về JSON.
 * Client-side only — đọc từ Zustand .getState() nên không cần async.
 */

import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';

export interface UserDataExport {
  exportedAt: string;
  appVersion: string;
  profile: {
    uid: string;
    displayName: string;
    email: string;
    rank: string;
    xp: number;
    streak: number;
    isPremium: boolean;
    createdAt: string;
  };
  finance: {
    mainBalance: number;
    emergencyBalance: number;
    billFundBalance: number;
    transactions: unknown[];
    fixedBills: unknown[];
  };
  budgets: {
    carryOver: number;
    categoryBudgets: unknown[];
  };
  goals: unknown[];
  tasks: unknown[];
}

export function collectUserData(): UserDataExport {
  const { user } = useAuthStore.getState();
  const { transactions, mainBalance, emergencyBalance, billFundBalance, fixedBills } =
    useFinanceStore.getState();
  const { carryOver, categoryBudgets } = useBudgetStore.getState();
  const { goals } = useGoalsStore.getState();
  const { tasks } = useTaskStore.getState();

  return {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0',
    profile: user
      ? {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          rank: user.rank,
          xp: user.xp,
          streak: user.streak,
          isPremium: user.isPremium,
          createdAt: user.createdAt,
        }
      : {
          uid: '',
          displayName: '',
          email: '',
          rank: 'iron',
          xp: 0,
          streak: 0,
          isPremium: false,
          createdAt: '',
        },
    finance: {
      mainBalance,
      emergencyBalance,
      billFundBalance,
      transactions,
      fixedBills,
    },
    budgets: {
      carryOver,
      categoryBudgets,
    },
    goals,
    tasks,
  };
}

/** Tải file JSON về thiết bị của người dùng. Chỉ gọi từ browser. */
export function downloadUserDataJSON(): void {
  const data = collectUserData();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `manicash-data-${dateStr}.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
