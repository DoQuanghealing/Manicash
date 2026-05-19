/* ═══ Dashboard Store — 6-Account Financial Intelligence System ═══ */
'use client';

import { create } from 'zustand';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';
import {
  BILL_FUND_ACCOUNT_ID,
  EMERGENCY_FUND_ACCOUNT_ID,
  GOAL_FUND_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  MAIN_BANK_ACCOUNT_ID,
} from '@/core/finance/accounts';
import { getMonthKeyFromDate, getCurrentMonthKey, isInCurrentWeek } from '@/lib/dateHelpers';

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
  sourceTransactionId?: string;
  occurredAt?: Date;
}

export interface SplitResult {
  billAmount: number;
  reserveAmount: number;
  goalsAmount: number;
  investmentAmount: number;
  totalDeducted: number;
  remaining: number;
  sourceAmount: number;
  splitTransactionId: string;
}

export type SavingsPeriod = 'week' | 'month' | 'year';
export type SavingsFund = 'reserve' | 'goals' | 'investment';
const DEFAULT_ACCOUNT_IDS = {
  MAIN_BANK: MAIN_BANK_ACCOUNT_ID,
  BILL_FUND: BILL_FUND_ACCOUNT_ID,
  EMERGENCY_FUND: EMERGENCY_FUND_ACCOUNT_ID,
  GOAL_FUND: GOAL_FUND_ACCOUNT_ID,
  INVESTMENT_FUND: INVESTMENT_FUND_ACCOUNT_ID,
} as const;

export interface FundContribution {
  month: string;
  amount: number;
  createdAt?: string;
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
  /** Tích lũy cho mỗi quỹ — legacy key month giữ lại, createdAt dùng cho tuần. */
  monthlyContributions: Record<string, FundContribution[]>;

  // Computed
  getSafeBalance: () => number;
  getGrossBalance: () => number;
  getFinancialHealth: () => number; // 0-100 ratio
  isSpendingOverLimit: () => boolean;
  /** Tổng tiết kiệm tháng hiện tại (dự phòng + mục tiêu + đầu tư) */
  getTotalMonthlySavings: () => number;
  /** Tích lũy tháng hiện tại cho 1 quỹ */
  getMonthlyFundTotal: (fund: SavingsFund) => number;
  /** Tích lũy năm cho 1 quỹ */
  getYearlyFundTotal: (fund: SavingsFund) => number;
  /** Tích lũy tuần hiện tại cho 1 quỹ. Dữ liệu cũ chưa có createdAt sẽ không được tính. */
  getWeeklyFundTotal: (fund: SavingsFund) => number;
  /** Tích lũy theo kỳ cho 1 quỹ */
  getFundTotalByPeriod: (fund: SavingsFund, period: SavingsPeriod) => number;
  /** Tổng tiết kiệm theo kỳ */
  getTotalSavingsByPeriod: (period: SavingsPeriod) => number;
  /** Chi tiết tích lũy theo tháng cho 1 quỹ (12 tháng) */
  getYearlyFundBreakdown: (fund: SavingsFund) => { month: string; amount: number }[];

  // Actions
  setAutoSplit: (value: boolean) => void;
  updateAccountBalance: (key: keyof DashboardAccounts, amount: number) => void;
  splitIncome: (splits: Partial<Record<keyof DashboardAccounts, number>>) => void;
  addFundContribution: (fund: SavingsFund, amount: number, occurredAt?: Date) => void;
  /** Atomic split — updates FinanceStore + DashboardStore in one call */
  splitFunds: (params: SplitFundsParams) => SplitResult;
}


// Demo monthly contributions
const curM = getCurrentMonthKey();
const SEED_CONTRIBUTIONS: Record<string, FundContribution[]> = {
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
    const funds: SavingsFund[] = ['reserve', 'goals', 'investment'];
    return funds.reduce((sum, f) => sum + get().getMonthlyFundTotal(f), 0);
  },

  /** Tích lũy tháng hiện tại cho 1 quỹ */
  getMonthlyFundTotal: (fund) => {
    const month = getCurrentMonthKey();
    const contribs = get().monthlyContributions[fund] || [];
    return contribs
      .filter((c) => c.month === month)
      .reduce((sum, c) => sum + c.amount, 0);
  },

  /** Tích lũy tuần hiện tại cho 1 quỹ. Seed cũ thiếu createdAt nên trả 0. */
  getWeeklyFundTotal: (fund) => {
    const contribs = get().monthlyContributions[fund] || [];
    return contribs
      .filter((c) => c.createdAt && isInCurrentWeek(c.createdAt))
      .reduce((sum, c) => sum + c.amount, 0);
  },

  /** Tích lũy cả năm cho 1 quỹ */
  getYearlyFundTotal: (fund) => {
    const year = getCurrentMonthKey().split('-')[0];
    const contribs = get().monthlyContributions[fund] || [];
    return contribs
      .filter((c) => c.month.startsWith(year))
      .reduce((sum, c) => sum + c.amount, 0);
  },

  getFundTotalByPeriod: (fund, period) => {
    if (period === 'week') return get().getWeeklyFundTotal(fund);
    if (period === 'year') return get().getYearlyFundTotal(fund);
    return get().getMonthlyFundTotal(fund);
  },

  getTotalSavingsByPeriod: (period) => {
    const funds: SavingsFund[] = ['reserve', 'goals', 'investment'];
    return funds.reduce((sum, f) => sum + get().getFundTotalByPeriod(f, period), 0);
  },

  /** Breakdown 12 tháng */
  getYearlyFundBreakdown: (fund) => {
    const year = getCurrentMonthKey().split('-')[0];
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
  addFundContribution: (fund, amount, occurredAt) => {
    set((state) => {
      const date = occurredAt ?? new Date();
      const month = getMonthKeyFromDate(date.toISOString());
      const createdAt = date.toISOString();
      const existing = { ...state.monthlyContributions };
      if (!existing[fund]) existing[fund] = [];
      existing[fund] = [...existing[fund], { month, amount, createdAt }];
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
    const { sourceAmount, billPercent, savingsPercent, savingsBreakdown, sourceTransactionId, occurredAt } = params;

    // ── Validation (defense layer — UI should prevent these) ──

    // sourceAmount must be positive
    if (sourceAmount <= 0) {
      throw new Error(`Số tiền chia phải > 0 (hiện ${sourceAmount})`);
    }

    // No individual percent may be negative
    if (billPercent < 0) {
      throw new Error(`billPercent không được âm (${billPercent}%)`);
    }
    if (savingsPercent < 0) {
      throw new Error(`savingsPercent không được âm (${savingsPercent}%)`);
    }
    if (savingsBreakdown.reserve < 0) {
      throw new Error(`reserve không được âm (${savingsBreakdown.reserve}%)`);
    }
    if (savingsBreakdown.goals < 0) {
      throw new Error(`goals không được âm (${savingsBreakdown.goals}%)`);
    }
    if (savingsBreakdown.investment < 0) {
      throw new Error(`investment không được âm (${savingsBreakdown.investment}%)`);
    }

    // Bill + Savings must not exceed 100 (tolerance 0.01 for float rounding)
    const totalPercent = billPercent + savingsPercent;
    if (totalPercent > 100.01) {
      throw new Error(`Tổng % vượt 100 (${totalPercent}%)`);
    }
    if (totalPercent < 0) {
      throw new Error(`Tổng % âm (${totalPercent}%)`);
    }

    // Sub-savings must sum to 100 when savings > 0 (tolerance 0.1)
    if (savingsPercent > 0) {
      const subTotal = savingsBreakdown.reserve + savingsBreakdown.goals + savingsBreakdown.investment;
      if (Math.abs(subTotal - 100) > 0.1) {
        throw new Error(`Sub-percent tiết kiệm phải = 100% (hiện ${subTotal}%)`);
      }
    }

    const splitOccurredAt = occurredAt ?? (() => {
      if (sourceTransactionId) {
        const txn = useFinanceStore.getState().transactions.find(t => t.id === sourceTransactionId);
        if (txn) return new Date(txn.date);
      }
      return new Date();
    })();

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
    const prevAccounts = get().accounts;

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

    let splitTransactionId: string;
    try {
      const splitTransaction = useFinanceStore.getState().addSplitTransaction({
        splitBreakdown: {
          billFund: billAmount,
          reserve: reserveAmount,
          goals: goalsAmount,
          investment: investmentAmount,
        },
        sourceTransactionId,
        occurredAt: splitOccurredAt,
      });
      splitTransactionId = splitTransaction.id;
    } catch (error) {
      useFinanceStore.setState({
        mainBalance: prevMainBalance,
        billFundBalance: prevBillFundBalance,
      });
      set({ accounts: prevAccounts });
      throw error;
    }

    // 5. Record monthly contributions (for charts) + award XP per fund
    const addContrib = get().addFundContribution;
    if (reserveAmount > 0) addContrib('reserve', reserveAmount, splitOccurredAt);
    if (goalsAmount > 0) addContrib('goals', goalsAmount, splitOccurredAt);
    if (investmentAmount > 0) addContrib('investment', investmentAmount, splitOccurredAt);

    try {
      const coreStore = useFinanceCoreStore.getState();
      const baseEvent = {
        occurredAt: splitOccurredAt.toISOString(),
        description: 'Legacy split funds mirror',
        metadata: {
          legacySplitTransactionId: splitTransactionId,
          sourceTransactionId: sourceTransactionId ?? null,
        },
      };
      const transfers = [
        { id: 'bill', amount: billAmount, targetAccountId: DEFAULT_ACCOUNT_IDS.BILL_FUND },
        { id: 'reserve', amount: reserveAmount, targetAccountId: DEFAULT_ACCOUNT_IDS.EMERGENCY_FUND },
        { id: 'goals', amount: goalsAmount, targetAccountId: DEFAULT_ACCOUNT_IDS.GOAL_FUND },
        { id: 'investment', amount: investmentAmount, targetAccountId: DEFAULT_ACCOUNT_IDS.INVESTMENT_FUND },
      ];

      for (const transfer of transfers) {
        if (transfer.amount <= 0) continue;
        coreStore.execute({
          ...baseEvent,
          id: `legacy-${splitTransactionId}-${transfer.id}`,
          type: 'TRANSFER_MONEY',
          amount: transfer.amount,
          sourceAccountId: DEFAULT_ACCOUNT_IDS.MAIN_BANK,
          targetAccountId: transfer.targetAccountId,
        });
      }
    } catch (error) {
      // TODO: make legacy split + finance core transfers atomic and rollback together.
      if (process.env.NODE_ENV === 'development') {
        console.warn('[finance-core] failed to mirror split funds', error);
      }
    }

    return {
      billAmount,
      reserveAmount,
      goalsAmount,
      investmentAmount,
      totalDeducted,
      remaining,
      sourceAmount,
      splitTransactionId,
    };
  },
}));
