/* Account Overview Store - canonical 3-account read model */
'use client';

import { create } from 'zustand';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useWalletBankStore, type WalletGroupData } from '@/stores/useWalletBankStore';
import {
  buildCoreDashboardBalances,
  type CoreDashboardBalances,
} from '@/core/finance/dashboardSelectors';
import {
  calculateSafeToSpend,
  getSafeToSpendStatus,
  type SafeToSpendStatus,
} from '@/lib/accountOverviewMath';
import { getMonthKeyFromDate } from '@/lib/dateHelpers';
import { isThreeAccountModelEnabled } from '@/lib/featureFlags';

export type OverviewAccountId = 'income' | 'expense' | 'saving';

export interface OverviewSubAccount {
  id: string;
  label: string;
  amount: number;
  limit?: number;
  color?: string;
  isPaid?: boolean;
  source: string;
}

export interface ExpenseFundingMonth {
  month: string;
  dailyTotal: number;
  fixedTotal: number;
  dailyItems: OverviewSubAccount[];
  fixedItems: OverviewSubAccount[];
  hasFixedSnapshot: boolean;
}

export interface ExpenseFundingComparison {
  increased: OverviewSubAccount[];
  decreased: OverviewSubAccount[];
  topDaily?: OverviewSubAccount;
  topFixed?: OverviewSubAccount;
  previousMonth?: string;
}

export interface ExpenseFundingOverview {
  target: number;
  dailyLimit: number;
  fixedBillsTotal: number;
  monthlyExpense: number;
  billFundBalance: number;
  remainingDaily: number;
  fixedBillsOverfunded?: number;
  fixedBillsProgress?: number;
  months: ExpenseFundingMonth[];
  comparison: ExpenseFundingComparison;
}

export interface OverviewAccount {
  id: OverviewAccountId;
  label: string;
  amount: number;
  wallet?: WalletGroupData;
  source: string;
  subAccounts: OverviewSubAccount[];
  meta: Record<string, number | string | boolean>;
  expenseFunding?: ExpenseFundingOverview;
}

export interface SafeToSpendSnapshot {
  amount: number;
  monthlyIncome: number;
  carryOver: number;
  spendingLimit: number;
  fixedBills: number;
  monthlySavings: number;
  monthlyExpense: number;
  spentPercent: number;
  status: SafeToSpendStatus;
}

export interface AccountOverviewSnapshot {
  accounts: Record<OverviewAccountId, OverviewAccount>;
  safeToSpend: SafeToSpendSnapshot;
  coreBalances: CoreDashboardBalances;
  sourceMap: Record<OverviewAccountId, string[]>;
}

type FinanceSource = ReturnType<typeof useFinanceStore.getState>;
type BudgetSource = ReturnType<typeof useBudgetStore.getState>;
type DashboardSource = ReturnType<typeof useDashboardStore.getState>;
type WalletBankSource = ReturnType<typeof useWalletBankStore.getState>;

interface BuildSnapshotParams {
  finance: FinanceSource;
  budget: BudgetSource;
  dashboard: DashboardSource;
  walletBank: WalletBankSource;
  coreBalances: CoreDashboardBalances;
  hasCoreLedgerEntries: boolean;
}

interface AccountOverviewState {
  getSnapshot: () => AccountOverviewSnapshot;
  getAccount: (id: OverviewAccountId) => OverviewAccount;
  getSafeToSpend: () => SafeToSpendSnapshot;
}

const SOURCE_MAP: Record<OverviewAccountId, string[]> = {
  income: ['useFinanceStore.transactions[type=income]', 'useWalletBankStore.wallets[income]'],
  expense: [
    'useFinanceStore.transactions[type=expense]',
    'useBudgetStore.categoryBudgets',
    'useFinanceStore.fixedBills',
    'useFinanceStore.billFundBalance',
    'useWalletBankStore.wallets[expense]',
  ],
  saving: [
    'useDashboardStore.accounts.reserve',
    'useDashboardStore.accounts.goals',
    'useDashboardStore.accounts.investment',
    'useDashboardStore.monthlyContributions',
    'useWalletBankStore.wallets[saving]',
  ],
};

let lastFinanceMismatchKey: string | null = null;

function warnFinanceMismatchIfNeeded(params: {
  legacy: { mainBalance: number; billFundBalance: number; savingsBalance: number };
  core: { mainBankBalance: number; billFundBalance: number; totalSavingsBalance: number };
}): void {
  if (process.env.NODE_ENV !== 'development') return;

  const { legacy, core } = params;
  const hasMismatch =
    Math.abs(legacy.mainBalance - core.mainBankBalance) > 1 ||
    Math.abs(legacy.billFundBalance - core.billFundBalance) > 1 ||
    Math.abs(legacy.savingsBalance - core.totalSavingsBalance) > 1;

  if (!hasMismatch) {
    lastFinanceMismatchKey = null;
    return;
  }

  const payload = {
    type: 'FINANCE_MISMATCH',
    legacy,
    core,
  };
  const nextKey = JSON.stringify(payload);
  if (nextKey === lastFinanceMismatchKey) return;

  lastFinanceMismatchKey = nextKey;
  console.warn('[finance-core] dashboard balance mismatch', payload);
}

function findWallet(walletBank: WalletBankSource, id: OverviewAccountId): WalletGroupData | undefined {
  return walletBank.wallets.find((wallet) => wallet.id === id);
}

function getRecentMonthKeys(count: number): string[] {
  const now = new Date();
  const months: string[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    // Generate dates using UTC to stay consistent with dateHelpers
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(getMonthKeyFromDate(date));
  }

  return months;
}

function compareSubAccounts(
  current: OverviewSubAccount[],
  previous: OverviewSubAccount[],
): Pick<ExpenseFundingComparison, 'increased' | 'decreased'> {
  const previousMap = new Map(previous.map((item) => [item.id, item.amount]));

  const deltas = current
    .map((item) => ({
      ...item,
      amount: item.amount - (previousMap.get(item.id) || 0),
    }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return {
    increased: deltas.filter((item) => item.amount > 0).slice(0, 3),
    decreased: deltas.filter((item) => item.amount < 0).map((item) => ({
      ...item,
      amount: Math.abs(item.amount),
    })).slice(0, 3),
  };
}

function buildExpenseFundingOverview(
  finance: FinanceSource,
  budget: BudgetSource,
  spendingLimit: number,
  fixedBills: number,
  monthlyExpense: number,
  billFundBalance: number,
): ExpenseFundingOverview {
  const monthKeys = getRecentMonthKeys(6);
  const currentMonth = budget.currentMonth;
  const currentDailyItems: OverviewSubAccount[] = budget.categoryBudgets
    .filter((item) => item.month === currentMonth && (item.monthlyLimit > 0 || item.spent > 0))
    .map((item) => ({
      id: item.categoryId,
      label: item.categoryId,
      amount: item.spent,
      limit: item.monthlyLimit,
      source: 'useBudgetStore.categoryBudgets',
    }));

  const currentFixedItems: OverviewSubAccount[] = finance.fixedBills.map((bill) => ({
    id: bill.id,
    label: bill.name,
    amount: bill.amount,
    isPaid: bill.isPaid,
    source: 'useFinanceStore.fixedBills',
  }));

  const months: ExpenseFundingMonth[] = monthKeys.map((month) => {
    if (month === currentMonth) {
      return {
        month,
        dailyTotal: currentDailyItems.reduce((sum, item) => sum + item.amount, 0),
        fixedTotal: fixedBills,
        dailyItems: currentDailyItems,
        fixedItems: currentFixedItems,
        hasFixedSnapshot: true, // Current month always has live data
      };
    }

    const dailyMap = new Map<string, number>();
    finance.transactions.forEach((txn) => {
      if (txn.type !== 'expense') return;
      if (getMonthKeyFromDate(txn.date) !== month) return;
      dailyMap.set(txn.categoryId, (dailyMap.get(txn.categoryId) || 0) + txn.amount);
    });

    const dailyItems = Array.from(dailyMap.entries()).map(([categoryId, amount]) => ({
      id: categoryId,
      label: categoryId,
      amount,
      source: 'useFinanceStore.transactions',
    }));

    const snapshot = finance.billSnapshots.find((s) => s.month === month);
    const hasFixedSnapshot = !!snapshot;
    const fixedItems: OverviewSubAccount[] = snapshot
      ? snapshot.bills.map((bill) => ({
          id: bill.id,
          label: bill.name,
          amount: bill.amount,
          isPaid: bill.isPaid,
          source: 'useFinanceStore.billSnapshots',
        }))
      : [];

    return {
      month,
      dailyTotal: dailyItems.reduce((sum, item) => sum + item.amount, 0),
      fixedTotal: snapshot ? snapshot.totalFixedBills : 0,
      dailyItems,
      fixedItems,
      hasFixedSnapshot,
    };
  });

  const current = months.find((month) => month.month === currentMonth) || months[months.length - 1];
  const currentIndex = months.findIndex((month) => month.month === current.month);
  const previous = currentIndex > 0 ? months[currentIndex - 1] : undefined;
  const dailyComparison = previous ? compareSubAccounts(current.dailyItems, previous.dailyItems) : { increased: [], decreased: [] };
  const topDaily = [...current.dailyItems].sort((a, b) => b.amount - a.amount)[0];
  const topFixed = [...current.fixedItems].sort((a, b) => b.amount - a.amount)[0];

  const overfunded = Math.max(0, billFundBalance - fixedBills);
  const progress = fixedBills > 0 ? Math.min(billFundBalance / fixedBills, 1) : 1;

  return {
    target: spendingLimit + fixedBills,
    dailyLimit: spendingLimit,
    fixedBillsTotal: fixedBills,
    monthlyExpense,
    billFundBalance,
    remainingDaily: Math.max(0, spendingLimit - monthlyExpense),
    fixedBillsOverfunded: overfunded,
    fixedBillsProgress: progress,
    months,
    comparison: {
      increased: dailyComparison.increased,
      decreased: dailyComparison.decreased,
      topDaily,
      topFixed,
      previousMonth: previous?.month,
    },
  };
}

export function buildAccountOverviewSnapshot({
  finance,
  budget,
  dashboard,
  walletBank,
  coreBalances,
  hasCoreLedgerEntries,
}: BuildSnapshotParams): AccountOverviewSnapshot {
  const currentMonth = finance.getCurrentMonthKey();
  const monthlyIncome = finance.getIncomeForMonth(currentMonth);
  const monthlyExpense = finance.getExpenseForMonth(currentMonth);
  const spendingLimit = budget.getTotalCategoryLimits();
  const fixedBills = finance.getTotalFixedBillsAmount();
  const fixedBillsFundingTarget = fixedBills;
  const monthlySavings = dashboard.getTotalMonthlySavings();
  const carryOver = budget.carryOver;

  const safeToSpend = calculateSafeToSpend({
    monthlyIncome,
    carryOver,
    spendingLimit,
    fixedBills,
    monthlySavings,
  });
  const spentPercent = Math.min(100, Math.round((monthlyExpense / Math.max(spendingLimit, 1)) * 100));

  const reserveMonthly = dashboard.getMonthlyFundTotal('reserve');
  const goalsMonthly = dashboard.getMonthlyFundTotal('goals');
  const investmentMonthly = dashboard.getMonthlyFundTotal('investment');
  const legacySavingsBalance =
    dashboard.accounts.reserve.balance +
    dashboard.accounts.goals.balance +
    dashboard.accounts.investment.balance;
  const reserveBalance = hasCoreLedgerEntries
    ? coreBalances.emergencyFundBalance
    : dashboard.accounts.reserve.balance;
  const goalsBalance = hasCoreLedgerEntries
    ? coreBalances.goalFundBalance
    : dashboard.accounts.goals.balance;
  const investmentBalance = hasCoreLedgerEntries
    ? coreBalances.investmentFundBalance
    : dashboard.accounts.investment.balance;
  const savingsBalance = hasCoreLedgerEntries
    ? coreBalances.totalSavingsBalance
    : reserveBalance + goalsBalance + investmentBalance;
  const mainBalance = hasCoreLedgerEntries
    ? coreBalances.mainBankBalance
    : finance.mainBalance;
  const billFundBalance = hasCoreLedgerEntries
    ? coreBalances.billFundBalance
    : finance.billFundBalance;

  warnFinanceMismatchIfNeeded({
    legacy: {
      mainBalance: finance.mainBalance,
      billFundBalance: finance.billFundBalance,
      savingsBalance: legacySavingsBalance,
    },
    core: {
      mainBankBalance: coreBalances.mainBankBalance,
      billFundBalance: coreBalances.billFundBalance,
      totalSavingsBalance: coreBalances.totalSavingsBalance,
    },
  });

  const expenseFunding = buildExpenseFundingOverview(
    finance,
    budget,
    spendingLimit,
    fixedBillsFundingTarget,
    monthlyExpense,
    billFundBalance,
  );

  const income: OverviewAccount = {
    id: 'income',
    label: 'Thu nhập',
    amount: monthlyIncome,
    wallet: findWallet(walletBank, 'income'),
    source: 'Monthly income transactions',
    subAccounts: [
      {
        id: 'main-income',
        label: 'Thu nhập tháng',
        amount: monthlyIncome,
        source: 'useFinanceStore.getIncomeForMonth(currentMonth)',
      },
    ],
    meta: {
      mainBalance,
      transactionCount: finance.transactions.filter((txn) => txn.type === 'income').length,
    },
  };

  const expense: OverviewAccount = {
    id: 'expense',
    label: 'Chi tiêu',
    amount: monthlyExpense,
    wallet: findWallet(walletBank, 'expense'),
    source: 'Monthly expense transactions plus budget and bills',
    subAccounts: [
      {
        id: 'daily-expense',
        label: 'Chi tiêu tháng',
        amount: monthlyExpense,
        source: 'useFinanceStore.getExpenseForMonth(currentMonth)',
      },
      {
        id: 'fixed-bills',
        label: 'Bill cố định',
        amount: fixedBills,
        source: 'useFinanceStore.getTotalFixedBillsAmount()',
      },
      {
        id: 'bill-fund',
        label: 'Tài khoản chi tiêu hiện có',
        amount: billFundBalance,
        source: 'useFinanceStore.billFundBalance',
      },
    ],
    meta: {
      spendingLimit,
      fundingTarget: expenseFunding.target,
      remainingToSpend: Math.max(0, spendingLimit - monthlyExpense),
      billFundBalance,
      unpaidBills: finance.fixedBills.filter((bill) => !bill.isPaid).length,
    },
    expenseFunding,
  };

  const saving: OverviewAccount = {
    id: 'saving',
    label: 'Tiết kiệm',
    amount: monthlySavings,
    wallet: findWallet(walletBank, 'saving'),
    source: 'Dashboard savings funds',
    subAccounts: [
      {
        id: 'reserve',
        label: 'Dự phòng',
        amount: reserveMonthly,
        source: 'useDashboardStore.getMonthlyFundTotal(reserve)',
      },
      {
        id: 'goals',
        label: 'Mục tiêu',
        amount: goalsMonthly,
        source: 'useDashboardStore.getMonthlyFundTotal(goals)',
      },
      {
        id: 'investment',
        label: 'Đầu tư',
        amount: investmentMonthly,
        source: 'useDashboardStore.getMonthlyFundTotal(investment)',
      },
    ],
    meta: {
      savingsBalance,
      reserveBalance,
      goalsBalance,
      investmentBalance,
    },
  };

  return {
    accounts: { income, expense, saving },
    safeToSpend: {
      amount: safeToSpend,
      monthlyIncome,
      carryOver,
      spendingLimit,
      fixedBills,
      monthlySavings,
      monthlyExpense,
      spentPercent,
      status: getSafeToSpendStatus(safeToSpend),
    },
    coreBalances,
    sourceMap: SOURCE_MAP,
  };
}

export function getAccountOverviewSnapshot(): AccountOverviewSnapshot {
  const ledgerEntries = useFinanceCoreStore.getState().ledgerEntries;
  const coreBalances = buildCoreDashboardBalances(ledgerEntries);
  // Gate sau flag: mô hình core chưa persist/hydrate nên ledger chỉ chứa delta
  // của phiên hiện tại. Nếu đọc theo ledger, số dư sẽ lật sai sau giao dịch đầu.
  const hasCoreLedgerEntries = isThreeAccountModelEnabled() && ledgerEntries.length > 0;

  return buildAccountOverviewSnapshot({
    finance: useFinanceStore.getState(),
    budget: useBudgetStore.getState(),
    dashboard: useDashboardStore.getState(),
    walletBank: useWalletBankStore.getState(),
    coreBalances,
    hasCoreLedgerEntries,
  });
}

export const useAccountOverviewStore = create<AccountOverviewState>(() => ({
  getSnapshot: getAccountOverviewSnapshot,
  getAccount: (id) => getAccountOverviewSnapshot().accounts[id],
  getSafeToSpend: () => getAccountOverviewSnapshot().safeToSpend,
}));

// React components should use this hook so they subscribe to every source store.
// useAccountOverviewStore methods are imperative snapshots for non-rendering code.
export function useAccountOverviewSnapshot(): AccountOverviewSnapshot {
  const finance = useFinanceStore();
  const budget = useBudgetStore();
  const dashboard = useDashboardStore();
  const walletBank = useWalletBankStore();
  const ledgerEntries = useFinanceCoreStore((s) => s.ledgerEntries);
  const coreBalances = buildCoreDashboardBalances(ledgerEntries);
  // Xem chú thích ở getAccountOverviewSnapshot: gate sau flag (mặc định OFF).
  const hasCoreLedgerEntries = isThreeAccountModelEnabled() && ledgerEntries.length > 0;

  return buildAccountOverviewSnapshot({
    finance,
    budget,
    dashboard,
    walletBank,
    coreBalances,
    hasCoreLedgerEntries,
  });
}
