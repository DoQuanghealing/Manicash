/* ═══ Dashboard Store — 6-Account Financial Intelligence System ═══ */
'use client';

import { create } from 'zustand';

export interface AccountData {
  balance: number;
  icon: string; // Lucide icon name
}

export interface IncomeAccount extends AccountData {
  icon: 'Wallet';
}

export interface SpendingAccount extends AccountData {
  limit: number;
  icon: 'ShoppingBag';
}

export interface FixedBillsAccount extends AccountData {
  pending_count: number;
  icon: 'CreditCard';
}

export interface ReserveAccount extends AccountData {
  is_locked: boolean;
  icon: 'Lock';
}

export interface GoalsAccount extends AccountData {
  target: number;
  icon: 'Target';
}

export interface InvestmentAccount extends AccountData {
  growth: string;
  icon: 'TrendingUp';
}

export interface DashboardAccounts {
  income: IncomeAccount;
  spending: SpendingAccount;
  fixed_bills: FixedBillsAccount;
  reserve: ReserveAccount;
  goals: GoalsAccount;
  investment: InvestmentAccount;
}

interface DashboardState {
  accounts: DashboardAccounts;
  auto_split: boolean;
  /** Tích lũy tháng cho mỗi quỹ — key: 'reserve'|'goals'|'investment', value: amount trong tháng */
  monthlyContributions: Record<string, { month: string; amount: number }[]>;

  // Computed
  getSafeBalance: () => number;
  getGrossBalance: () => number;
  getFinancialHealth: () => number; // 0-100 ratio
  isSpendingOverLimit: () => boolean;
  /** Tổng tiết kiệm tháng hiện tại (dự phòng + mục tiêu + đầu tư) */
  getTotalMonthlySavings: () => number;
  /** Tích lũy tháng hiện tại cho 1 quỹ */
  getMonthlyFundTotal: (fund: 'reserve' | 'goals' | 'investment') => number;
  /** Tích lũy năm cho 1 quỹ */
  getYearlyFundTotal: (fund: 'reserve' | 'goals' | 'investment') => number;
  /** Chi tiết tích lũy theo tháng cho 1 quỹ (12 tháng) */
  getYearlyFundBreakdown: (fund: 'reserve' | 'goals' | 'investment') => { month: string; amount: number }[];

  // Actions
  setAutoSplit: (value: boolean) => void;
  updateAccountBalance: (key: keyof DashboardAccounts, amount: number) => void;
  splitIncome: (splits: Partial<Record<keyof DashboardAccounts, number>>) => void;
  addFundContribution: (fund: 'reserve' | 'goals' | 'investment', amount: number) => void;
}

// Helper: current month string
function getCurMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Demo monthly contributions
const curM = getCurMonth();
const SEED_CONTRIBUTIONS: Record<string, { month: string; amount: number }[]> = {
  reserve: [
    { month: curM, amount: 500_000 },
    { month: curM, amount: 300_000 },
  ],
  goals: [
    { month: curM, amount: 400_000 },
    { month: curM, amount: 200_000 },
  ],
  investment: [
    { month: curM, amount: 300_000 },
  ],
};

// Realistic demo seed data (VND)
const SEED_ACCOUNTS: DashboardAccounts = {
  income: {
    balance: 15_000_000,
    icon: 'Wallet',
  },
  spending: {
    balance: 7_800_000,
    limit: 11_000_000,
    icon: 'ShoppingBag',
  },
  fixed_bills: {
    balance: 3_500_000, // Adjusted for new bill totals
    pending_count: 3,
    icon: 'CreditCard',
  },
  reserve: {
    balance: 3_000_000, // Tổng tích lũy mọi tháng
    is_locked: true,
    icon: 'Lock',
  },
  goals: {
    balance: 2_500_000,
    target: 100_000_000,
    icon: 'Target',
  },
  investment: {
    balance: 1_200_000,
    growth: '+5.2%',
    icon: 'TrendingUp',
  },
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  accounts: SEED_ACCOUNTS,
  auto_split: false,
  monthlyContributions: SEED_CONTRIBUTIONS,

  getSafeBalance: () => {
    const { income, reserve, goals, investment, fixed_bills } = get().accounts;
    return income.balance - (reserve.balance + goals.balance + investment.balance + fixed_bills.balance);
  },

  getGrossBalance: () => {
    const accs = get().accounts;
    return (
      accs.income.balance +
      accs.spending.balance +
      accs.fixed_bills.balance +
      accs.reserve.balance +
      accs.goals.balance +
      accs.investment.balance
    );
  },

  getFinancialHealth: () => {
    const safe = get().getSafeBalance();
    const income = get().accounts.income.balance;
    if (income === 0) return 0;
    return Math.min(100, Math.max(0, (safe / income) * 100));
  },

  isSpendingOverLimit: () => {
    const { spending } = get().accounts;
    return spending.balance > spending.limit;
  },

  /** Tổng tiết kiệm tháng hiện tại */
  getTotalMonthlySavings: () => {
    const funds: ('reserve' | 'goals' | 'investment')[] = ['reserve', 'goals', 'investment'];
    return funds.reduce((sum, f) => sum + get().getMonthlyFundTotal(f), 0);
  },

  /** Tích lũy tháng hiện tại cho 1 quỹ */
  getMonthlyFundTotal: (fund) => {
    const month = getCurMonth();
    const contribs = get().monthlyContributions[fund] || [];
    return contribs
      .filter((c) => c.month === month)
      .reduce((sum, c) => sum + c.amount, 0);
  },

  /** Tích lũy cả năm cho 1 quỹ */
  getYearlyFundTotal: (fund) => {
    const year = new Date().getFullYear().toString();
    const contribs = get().monthlyContributions[fund] || [];
    return contribs
      .filter((c) => c.month.startsWith(year))
      .reduce((sum, c) => sum + c.amount, 0);
  },

  /** Breakdown 12 tháng */
  getYearlyFundBreakdown: (fund) => {
    const year = new Date().getFullYear();
    const contribs = get().monthlyContributions[fund] || [];
    const monthlyMap: Record<string, number> = {};

    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }

    for (const c of contribs) {
      if (c.month.startsWith(String(year)) && monthlyMap[c.month] !== undefined) {
        monthlyMap[c.month] += c.amount;
      }
    }

    return Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));
  },

  setAutoSplit: (value) => set({ auto_split: value }),

  updateAccountBalance: (key, amount) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [key]: {
          ...state.accounts[key],
          balance: state.accounts[key].balance + amount,
        },
      },
    })),

  splitIncome: (splits) =>
    set((state) => {
      const newAccounts = JSON.parse(JSON.stringify(state.accounts)) as typeof state.accounts;
      let totalSplit = 0;

      for (const [key, amount] of Object.entries(splits)) {
        if (amount && key in newAccounts) {
          const acc = newAccounts[key as keyof DashboardAccounts];
          acc.balance += amount;
          totalSplit += amount;
        }
      }

      newAccounts.income.balance = Math.max(0, newAccounts.income.balance - totalSplit);
      return { accounts: newAccounts };
    }),

  /** Ghi nhận 1 lần tích lũy vào quỹ */
  addFundContribution: (fund, amount) =>
    set((state) => {
      const month = getCurMonth();
      const existing = { ...state.monthlyContributions };
      if (!existing[fund]) existing[fund] = [];
      existing[fund] = [...existing[fund], { month, amount }];
      return { monthlyContributions: existing };
    }),
}));
