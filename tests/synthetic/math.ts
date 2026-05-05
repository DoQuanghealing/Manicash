import type {
  AppComparableSnapshot,
  AppSnapshot,
  FixedBillSnapshot,
  LedgerState,
  MonthlySnapshot,
  SavingsFund,
  SyntheticTransaction,
} from './types';
import { monthKey } from './dates';

export const SAVINGS_FUNDS: SavingsFund[] = ['reserve', 'goals', 'investment'];
export const MONEY_TOLERANCE = 1;

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function isCloseMoney(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_TOLERANCE;
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}d`;
}

export function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getActiveBillsTotal(bills: FixedBillSnapshot[]): number {
  return sum(bills.map((bill) => bill.amount));
}

export function getMonthlyTransactions(transactions: SyntheticTransaction[], month: string): SyntheticTransaction[] {
  return transactions.filter((txn) => monthKey(txn.dateKey) === month);
}

export function calculateMonthlySnapshot(app: AppSnapshot, month: string): MonthlySnapshot {
  const txns = getMonthlyTransactions(app.transactions, month);
  const incomeTotal = sum(txns.filter((txn) => txn.type === 'income').map((txn) => txn.amount));
  const expenseTotal = sum(txns.filter((txn) => txn.type === 'expense').map((txn) => txn.amount));
  const savingTotal = sum(
    SAVINGS_FUNDS.flatMap((fund) =>
      app.monthlyContributions[fund]
        .filter((contribution) => contribution.month === month)
        .map((contribution) => contribution.amount),
    ),
  );

  return { month, incomeTotal, expenseTotal, savingTotal };
}

export function upsertMonthlySnapshot(app: AppSnapshot, month: string): void {
  const snapshot = calculateMonthlySnapshot(app, month);
  const existingIndex = app.monthlySnapshots.findIndex((item) => item.month === month);
  if (existingIndex >= 0) {
    app.monthlySnapshots[existingIndex] = snapshot;
    return;
  }
  app.monthlySnapshots.push(snapshot);
}

export function upsertBillSnapshot(app: AppSnapshot, month: string): void {
  const snapshot = {
    month,
    totalAmount: getActiveBillsTotal(app.fixedBills),
    bills: cloneSnapshot(app.fixedBills),
  };
  const existingIndex = app.billSnapshots.findIndex((item) => item.month === month);
  if (existingIndex >= 0) {
    app.billSnapshots[existingIndex] = snapshot;
    return;
  }
  app.billSnapshots.push(snapshot);
}

export function getExpectedMainBalance(ledger: LedgerState): number {
  const mainIncome = sum(
    ledger.transactions
      .filter((txn) => txn.type === 'income' && txn.wallet === 'main')
      .map((txn) => txn.amount),
  );
  const mainExpense = sum(
    ledger.transactions
      .filter((txn) => txn.type === 'expense' && txn.wallet === 'main')
      .map((txn) => txn.amount),
  );
  const splitDeducted = sum(ledger.splits.map((split) => split.totalDeducted));

  return mainIncome - mainExpense - splitDeducted;
}

export function getExpectedBillFundBalance(ledger: LedgerState): number {
  const directIncome = sum(
    ledger.transactions
      .filter((txn) => txn.type === 'income' && txn.wallet === 'bill-fund')
      .map((txn) => txn.amount),
  );
  const splitContributions = sum(ledger.splits.map((split) => split.billAmount));
  const paidBills = sum(ledger.billPayments.map((payment) => payment.amount));

  return directIncome + splitContributions - paidBills;
}

export function getExpectedSavingsByFund(ledger: LedgerState, fund: SavingsFund): number {
  const field = `${fund}Amount` as const;
  return sum(ledger.splits.map((split) => split[field]));
}

export function getExpectedSavingsTotal(ledger: LedgerState): number {
  return SAVINGS_FUNDS.reduce((total, fund) => total + getExpectedSavingsByFund(ledger, fund), 0);
}

export function getExpectedSystemTotal(ledger: LedgerState): number {
  const incomeTotal = sum(ledger.transactions.filter((txn) => txn.type === 'income').map((txn) => txn.amount));
  const nonBillExpenses = sum(
    ledger.transactions
      .filter((txn) => txn.type === 'expense' && !txn.isBillPayment)
      .map((txn) => txn.amount),
  );
  const paidBills = sum(ledger.billPayments.map((payment) => payment.amount));

  return incomeTotal - nonBillExpenses - paidBills;
}

export function toComparableSnapshot(app: AppSnapshot): AppComparableSnapshot {
  return {
    mainBalance: app.mainBalance,
    emergencyBalance: app.emergencyBalance,
    billFundBalance: app.billFundBalance,
    fixedBills: cloneSnapshot(app.fixedBills),
    transactions: cloneSnapshot(app.transactions),
    categoryBudgets: cloneSnapshot(app.categoryBudgets),
    monthlySnapshots: cloneSnapshot(app.monthlySnapshots),
    billSnapshots: cloneSnapshot(app.billSnapshots),
    fundBalances: cloneSnapshot(app.fundBalances),
    monthlyContributions: cloneSnapshot(app.monthlyContributions),
    overview: cloneSnapshot(app.overview),
  };
}

export function comparableSnapshotsEqual(a: AppComparableSnapshot, b: AppComparableSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
