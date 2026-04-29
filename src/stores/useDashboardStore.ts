/* ═══ Dashboard Store — 6-Account Financial Intelligence System ═══ */
'use client';

import { create } from 'zustand';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';

/* ── Split Funds types (shared across all entry points) ── */
export interface SplitFundsParams {
  sourceAmount: number;       // Total amount to split (e.g. mainBalance or income)
  billPercent: number;        // % allocated to Bill Fund (0-100)
  savingsPercent: number;     // % allocated to total Savings (0-100)
  savingsBreakdown: {         // How savings portion is divided (must sum to 100)
    reserve: number;          // % of savings → Dự phòng
    goals: number;            // % of savings → Mục tiêu
    investment: number;       // % of savings → Đầu tư
  };
}

export interface SplitResult {
  billAmount: number;
  reserveAmount: number;
  goalsAmount: number;
  investmentAmount: number;
  totalDeducted: number;
  remaining: number;
  sourceAmount: number;
}

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
  /** Atomic split — updates FinanceStore + DashboardStore in one call */
  splitFunds: (params: SplitFundsParams) => SplitResult;
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
  addFundContribution: (fund, amount) => {
    set((state) => {
      const month = getCurMonth();
      const existing = { ...state.monthlyContributions };
      if (!existing[fund]) existing[fund] = [];
      existing[fund] = [...existing[fund], { month, amount }];
      return { monthlyContributions: existing };
    });
    // SAVINGS_DEPOSIT XP — reserve/goals/investment đều coi là tiết kiệm.
    if (amount > 0) {
      useAuthStore.getState().awardXP({ type: 'SAVINGS_DEPOSIT', amount });
    }
  },

  /** ═══ Atomic Split — single source of truth for all 3 entry points ═══
   *  Updates BOTH FinanceStore (mainBalance, billFundBalance) and
   *  DashboardStore (reserve, goals, investment) in one atomic call.
   *  Returns SplitResult for the success popup to display breakdown.
   */
  splitFunds: (params) => {
    const { sourceAmount, billPercent, savingsPercent, savingsBreakdown } = params;

    // 1. Calculate amounts
    const billAmount = Math.round(sourceAmount * (billPercent / 100));
    const savingsTotal = Math.round(sourceAmount * (savingsPercent / 100));
    const reserveAmount = Math.round(savingsTotal * (savingsBreakdown.reserve / 100));
    const goalsAmount = Math.round(savingsTotal * (savingsBreakdown.goals / 100));
    // Investment gets the remainder to avoid rounding drift
    const investmentAmount = savingsTotal - reserveAmount - goalsAmount;
    const totalDeducted = billAmount + savingsTotal;
    const remaining = sourceAmount - totalDeducted;

    // 2. Snapshot current balances for rollback
    const finStore = useFinanceStore.getState();
    const prevMainBalance = finStore.mainBalance;
    const prevBillFundBalance = finStore.billFundBalance;

    // 3. Update FinanceStore atomically (mainBalance ↓, billFundBalance ↑)
    useFinanceStore.setState({
      mainBalance: prevMainBalance - totalDeducted,
      billFundBalance: prevBillFundBalance + billAmount,
    });

    // 4. Update DashboardStore accounts (reserve, goals, investment ↑)
    set((state) => {
      const newAccounts = { ...state.accounts };
      newAccounts.reserve = { ...newAccounts.reserve, balance: newAccounts.reserve.balance + reserveAmount };
      newAccounts.goals = { ...newAccounts.goals, balance: newAccounts.goals.balance + goalsAmount };
      newAccounts.investment = { ...newAccounts.investment, balance: newAccounts.investment.balance + investmentAmount };
      return { accounts: newAccounts };
    });

    // 5. Record monthly contributions (for charts) + award XP per fund
    const addContrib = get().addFundContribution;
    if (reserveAmount > 0) addContrib('reserve', reserveAmount);
    if (goalsAmount > 0) addContrib('goals', goalsAmount);
    if (investmentAmount > 0) addContrib('investment', investmentAmount);

    return {
      billAmount,
      reserveAmount,
      goalsAmount,
      investmentAmount,
      totalDeducted,
      remaining,
      sourceAmount,
    };
  },
}));
