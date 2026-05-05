export type PersonaId = 'minh' | 'huong' | 'tuan';
export type PhaseId = 'setup' | 'phase-0-1' | 'phase-2' | 'phase-3';
export type WalletType = 'main' | 'emergency' | 'bill-fund';
export type TransactionType = 'income' | 'expense';
export type SavingsFund = 'reserve' | 'goals' | 'investment';

export interface PersonaBill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  categoryId: string;
}

export interface PersonaBudget {
  categoryId: string;
  monthlyLimit: number;
}

export interface PersonaGoal {
  id: string;
  name: string;
  targetAmount: number;
  deadline: string;
}

export interface SplitDefaults {
  billPercent: number;
  savingsPercent: number;
  savingsBreakdown: Record<SavingsFund, number>;
}

export interface PersonaProfile {
  id: PersonaId;
  displayName: string;
  age: number;
  role: string;
  voice: string;
  income: {
    pattern: 'fixed' | 'variable';
    monthlyAmount?: number;
    monthlyRange?: [number, number];
    payDays: number[];
    notes: string;
  };
  dailySpendingLimit: number;
  bills: PersonaBill[];
  budgets: PersonaBudget[];
  goals: PersonaGoal[];
  splitDefaults: SplitDefaults;
  habits: Record<string, unknown>;
  uxRisk: string;
}

export interface SyntheticTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note: string;
  wallet: WalletType;
  dateKey: string;
  isBillPayment?: boolean;
}

export interface FixedBillSnapshot {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  categoryId: string;
  isPaid: boolean;
}

export interface BillMonthSnapshot {
  month: string;
  totalAmount: number;
  bills: FixedBillSnapshot[];
}

export interface CategoryBudgetSnapshot {
  categoryId: string;
  monthlyLimit: number;
  spent: number;
  month: string;
}

export interface MonthlySnapshot {
  month: string;
  incomeTotal: number;
  expenseTotal: number;
  savingTotal: number;
}

export interface FundContributionSnapshot {
  month: string;
  amount: number;
  createdAt: string;
}

export interface SplitLedgerEntry {
  id: string;
  dateKey: string;
  sourceAmount: number;
  billAmount: number;
  reserveAmount: number;
  goalsAmount: number;
  investmentAmount: number;
  totalDeducted: number;
}

export interface BillPaymentLedgerEntry {
  id: string;
  dateKey: string;
  billId: string;
  amount: number;
}

export interface LedgerState {
  transactions: SyntheticTransaction[];
  splits: SplitLedgerEntry[];
  billPayments: BillPaymentLedgerEntry[];
  deletedTransactionIds: string[];
}

export interface OverviewSnapshot {
  safeToSpendLabel: string;
  expenseFundingLabel: string;
  monthlyIncome: number;
  monthlyExpense: number;
  spendingLimit: number;
  fixedBillsFundingTarget: number;
  monthlySavings: number;
  safeToSpend: number;
  expenseFundingTarget: number;
}

export interface AppSnapshot {
  currentDateKey: string;
  mainBalance: number;
  emergencyBalance: number;
  billFundBalance: number;
  fixedBills: FixedBillSnapshot[];
  transactions: SyntheticTransaction[];
  categoryBudgets: CategoryBudgetSnapshot[];
  monthlySnapshots: MonthlySnapshot[];
  billSnapshots: BillMonthSnapshot[];
  fundBalances: Record<SavingsFund, number>;
  monthlyContributions: Record<SavingsFund, FundContributionSnapshot[]>;
  overview: OverviewSnapshot;
  lastReloadSnapshot?: AppComparableSnapshot;
  lastBackdateMonth?: string;
  lastDeletedTransactionId?: string;
}

export interface AppComparableSnapshot {
  mainBalance: number;
  emergencyBalance: number;
  billFundBalance: number;
  fixedBills: FixedBillSnapshot[];
  transactions: SyntheticTransaction[];
  categoryBudgets: CategoryBudgetSnapshot[];
  monthlySnapshots: MonthlySnapshot[];
  billSnapshots: BillMonthSnapshot[];
  fundBalances: Record<SavingsFund, number>;
  monthlyContributions: Record<SavingsFund, FundContributionSnapshot[]>;
  overview: OverviewSnapshot;
}

export interface SimulationState {
  persona: PersonaProfile;
  app: AppSnapshot;
  ledger: LedgerState;
  day: number;
  violations: InvariantViolation[];
}

export interface SavingsBreakdownInput {
  reserve: number;
  goals: number;
  investment: number;
}

export type SyntheticAction =
  | { kind: 'onboard'; dateKey: string }
  | {
      kind: 'record-income';
      id: string;
      dateKey: string;
      amount: number;
      categoryId: string;
      note: string;
      wallet?: WalletType;
      transactionDateKey?: string;
    }
  | {
      kind: 'record-expense';
      id: string;
      dateKey: string;
      amount: number;
      categoryId: string;
      note: string;
      wallet?: WalletType;
      transactionDateKey?: string;
      isBackdated?: boolean;
    }
  | {
      kind: 'split-funds';
      id: string;
      dateKey: string;
      sourceAmount: number;
      billPercent: number;
      savingsPercent: number;
      savingsBreakdown: SavingsBreakdownInput;
    }
  | { kind: 'pay-bill'; id: string; dateKey: string; billId: string }
  | { kind: 'update-bill'; dateKey: string; billId: string; amount: number }
  | { kind: 'add-bill'; dateKey: string; bill: PersonaBill }
  | { kind: 'delete-transaction'; dateKey: string; transactionId: string }
  | { kind: 'reload'; dateKey: string }
  | { kind: 'view-overview'; dateKey: string };

export interface InvariantDefinition {
  id: number;
  name: string;
  description: string;
}

export interface InvariantViolation {
  personaId: PersonaId;
  day: number;
  invariantId: number;
  invariantName: string;
  expected: string;
  actual: string;
  dateKey: string;
}

export interface PhaseRunResult {
  personaId: PersonaId;
  phase: PhaseId;
  daysRun: number;
  violations: InvariantViolation[];
  finalState: SimulationState;
}
