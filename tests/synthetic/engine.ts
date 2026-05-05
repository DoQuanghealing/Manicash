import type {
  AppSnapshot,
  CategoryBudgetSnapshot,
  FixedBillSnapshot,
  FundContributionSnapshot,
  LedgerState,
  PersonaProfile,
  PhaseId,
  PhaseRunResult,
  SimulationState,
  SyntheticAction,
  SyntheticTransaction,
} from './types';
import { monthKey, testDateForDay, testDayFromDateKey } from './dates';
import {
  SAVINGS_FUNDS,
  cloneSnapshot,
  getActiveBillsTotal,
  sum,
  toComparableSnapshot,
  upsertBillSnapshot,
  upsertMonthlySnapshot,
} from './math';
import { checkInvariants } from './invariants';

function createEmptyLedger(): LedgerState {
  return {
    transactions: [],
    splits: [],
    billPayments: [],
    deletedTransactionIds: [],
  };
}

function emptyContributions(): Record<(typeof SAVINGS_FUNDS)[number], FundContributionSnapshot[]> {
  return {
    reserve: [],
    goals: [],
    investment: [],
  };
}

function buildOverview(app: AppSnapshot): AppSnapshot['overview'] {
  const currentMonth = monthKey(app.currentDateKey);
  const currentTransactions = app.transactions.filter((txn) => monthKey(txn.dateKey) === currentMonth);
  const monthlyIncome = sum(currentTransactions.filter((txn) => txn.type === 'income').map((txn) => txn.amount));
  const monthlyExpense = sum(currentTransactions.filter((txn) => txn.type === 'expense').map((txn) => txn.amount));
  const spendingLimit = sum(
    app.categoryBudgets
      .filter((budget) => budget.month === currentMonth)
      .map((budget) => budget.monthlyLimit),
  );
  const fixedBillsFundingTarget = getActiveBillsTotal(app.fixedBills);
  const monthlySavings = sum(
    SAVINGS_FUNDS.flatMap((fund) =>
      app.monthlyContributions[fund]
        .filter((contribution) => contribution.month === currentMonth)
        .map((contribution) => contribution.amount),
    ),
  );

  return {
    safeToSpendLabel: 'Chi tieu an toan',
    expenseFundingLabel: 'Can nap vao tai khoan chi tieu',
    monthlyIncome,
    monthlyExpense,
    spendingLimit,
    fixedBillsFundingTarget,
    monthlySavings,
    safeToSpend: monthlyIncome - spendingLimit - fixedBillsFundingTarget - monthlySavings,
    expenseFundingTarget: spendingLimit + fixedBillsFundingTarget,
  };
}

function syncDerivedSnapshots(app: AppSnapshot, touchedDateKey: string): void {
  app.currentDateKey = touchedDateKey;
  upsertMonthlySnapshot(app, monthKey(touchedDateKey));
  app.overview = buildOverview(app);
}

function makeBills(persona: PersonaProfile): FixedBillSnapshot[] {
  return persona.bills
    .map((bill) => ({
      ...bill,
      isPaid: false,
    }))
    .sort((a, b) => a.dueDay - b.dueDay);
}

function makeBudgets(persona: PersonaProfile, dateKey: string): CategoryBudgetSnapshot[] {
  const month = monthKey(dateKey);
  return persona.budgets.map((budget) => ({
    ...budget,
    spent: 0,
    month,
  }));
}

function createEmptyApp(dateKey: string): AppSnapshot {
  const app: AppSnapshot = {
    currentDateKey: dateKey,
    mainBalance: 0,
    emergencyBalance: 0,
    billFundBalance: 0,
    fixedBills: [],
    transactions: [],
    categoryBudgets: [],
    monthlySnapshots: [],
    billSnapshots: [],
    fundBalances: {
      reserve: 0,
      goals: 0,
      investment: 0,
    },
    monthlyContributions: emptyContributions(),
    overview: {
      safeToSpendLabel: 'Chi tieu an toan',
      expenseFundingLabel: 'Can nap vao tai khoan chi tieu',
      monthlyIncome: 0,
      monthlyExpense: 0,
      spendingLimit: 0,
      fixedBillsFundingTarget: 0,
      monthlySavings: 0,
      safeToSpend: 0,
      expenseFundingTarget: 0,
    },
  };

  syncDerivedSnapshots(app, dateKey);
  return app;
}

export function createInitialState(persona: PersonaProfile, dateKey = testDateForDay(1)): SimulationState {
  return {
    persona,
    app: createEmptyApp(dateKey),
    ledger: createEmptyLedger(),
    day: 1,
    violations: [],
  };
}

function applyOnboarding(state: SimulationState, dateKey: string): void {
  state.app.fixedBills = makeBills(state.persona);
  state.app.categoryBudgets = makeBudgets(state.persona, dateKey);
  upsertBillSnapshot(state.app, monthKey(dateKey));
  syncDerivedSnapshots(state.app, dateKey);
}

function recordTransaction(state: SimulationState, transaction: SyntheticTransaction): void {
  state.app.transactions.unshift(transaction);
  state.ledger.transactions.push(cloneSnapshot(transaction));

  if (transaction.type === 'income') {
    if (transaction.wallet === 'main') state.app.mainBalance += transaction.amount;
    if (transaction.wallet === 'emergency') state.app.emergencyBalance += transaction.amount;
    if (transaction.wallet === 'bill-fund') state.app.billFundBalance += transaction.amount;
  }

  if (transaction.type === 'expense') {
    if (transaction.wallet === 'main') state.app.mainBalance -= transaction.amount;
    if (transaction.wallet === 'emergency') state.app.emergencyBalance -= transaction.amount;

    state.app.categoryBudgets = state.app.categoryBudgets.map((budget) =>
      budget.categoryId === transaction.categoryId && budget.month === monthKey(transaction.dateKey)
        ? { ...budget, spent: budget.spent + transaction.amount }
        : budget,
    );
  }

  syncDerivedSnapshots(state.app, transaction.dateKey);
}

function applySplitFunds(state: SimulationState, action: Extract<SyntheticAction, { kind: 'split-funds' }>): void {
  const billAmount = Math.round(action.sourceAmount * (action.billPercent / 100));
  const savingsTotal = Math.round(action.sourceAmount * (action.savingsPercent / 100));
  const reserveAmount = Math.round(savingsTotal * (action.savingsBreakdown.reserve / 100));
  const goalsAmount = Math.round(savingsTotal * (action.savingsBreakdown.goals / 100));
  const investmentAmount = savingsTotal - reserveAmount - goalsAmount;
  const totalDeducted = billAmount + savingsTotal;
  const month = monthKey(action.dateKey);

  state.app.mainBalance -= totalDeducted;
  state.app.billFundBalance += billAmount;
  state.app.fundBalances.reserve += reserveAmount;
  state.app.fundBalances.goals += goalsAmount;
  state.app.fundBalances.investment += investmentAmount;

  const contributions = {
    reserve: reserveAmount,
    goals: goalsAmount,
    investment: investmentAmount,
  };

  for (const fund of SAVINGS_FUNDS) {
    const amount = contributions[fund];
    if (amount <= 0) continue;
    state.app.monthlyContributions[fund].push({
      month,
      amount,
      createdAt: `${action.dateKey}T09:00:00.000Z`,
    });
  }

  state.ledger.splits.push({
    id: action.id,
    dateKey: action.dateKey,
    sourceAmount: action.sourceAmount,
    billAmount,
    reserveAmount,
    goalsAmount,
    investmentAmount,
    totalDeducted,
  });

  syncDerivedSnapshots(state.app, action.dateKey);
}

function applyBillPayment(state: SimulationState, action: Extract<SyntheticAction, { kind: 'pay-bill' }>): void {
  const bill = state.app.fixedBills.find((item) => item.id === action.billId);
  if (!bill || bill.isPaid) {
    syncDerivedSnapshots(state.app, action.dateKey);
    return;
  }

  bill.isPaid = true;
  state.app.billFundBalance -= bill.amount;
  state.ledger.billPayments.push({
    id: action.id,
    dateKey: action.dateKey,
    billId: bill.id,
    amount: bill.amount,
  });

  syncDerivedSnapshots(state.app, action.dateKey);
}

function applyBillUpdate(state: SimulationState, action: Extract<SyntheticAction, { kind: 'update-bill' }>): void {
  state.app.fixedBills = state.app.fixedBills.map((bill) =>
    bill.id === action.billId ? { ...bill, amount: action.amount } : bill,
  );
  upsertBillSnapshot(state.app, monthKey(action.dateKey));
  syncDerivedSnapshots(state.app, action.dateKey);
}

function applyBillAdd(state: SimulationState, action: Extract<SyntheticAction, { kind: 'add-bill' }>): void {
  state.app.fixedBills = [
    ...state.app.fixedBills,
    {
      ...action.bill,
      isPaid: false,
    },
  ].sort((a, b) => a.dueDay - b.dueDay);
  upsertBillSnapshot(state.app, monthKey(action.dateKey));
  syncDerivedSnapshots(state.app, action.dateKey);
}

function applyDeleteTransaction(
  state: SimulationState,
  action: Extract<SyntheticAction, { kind: 'delete-transaction' }>,
): void {
  const transaction = state.app.transactions.find((item) => item.id === action.transactionId);
  if (!transaction) {
    syncDerivedSnapshots(state.app, action.dateKey);
    return;
  }

  if (transaction.type === 'income') {
    if (transaction.wallet === 'main') state.app.mainBalance -= transaction.amount;
    if (transaction.wallet === 'emergency') state.app.emergencyBalance -= transaction.amount;
    if (transaction.wallet === 'bill-fund') state.app.billFundBalance -= transaction.amount;
  }

  if (transaction.type === 'expense') {
    if (transaction.wallet === 'main') state.app.mainBalance += transaction.amount;
    if (transaction.wallet === 'emergency') state.app.emergencyBalance += transaction.amount;

    state.app.categoryBudgets = state.app.categoryBudgets.map((budget) =>
      budget.categoryId === transaction.categoryId && budget.month === monthKey(transaction.dateKey)
        ? { ...budget, spent: Math.max(0, budget.spent - transaction.amount) }
        : budget,
    );
  }

  state.app.transactions = state.app.transactions.filter((item) => item.id !== action.transactionId);
  state.ledger.transactions = state.ledger.transactions.filter((item) => item.id !== action.transactionId);
  state.ledger.deletedTransactionIds.push(action.transactionId);
  state.app.lastDeletedTransactionId = action.transactionId;

  syncDerivedSnapshots(state.app, transaction.dateKey);
  syncDerivedSnapshots(state.app, action.dateKey);
}

export function applySyntheticAction(state: SimulationState, action: SyntheticAction): SimulationState {
  state.app.currentDateKey = action.dateKey;
  state.day = Math.max(1, testDayFromDateKey(action.dateKey));
  state.app.lastReloadSnapshot = undefined;

  if (action.kind === 'onboard') {
    applyOnboarding(state, action.dateKey);
  }

  if (action.kind === 'record-income') {
    const transactionDateKey = action.transactionDateKey ?? action.dateKey;
    recordTransaction(state, {
      id: action.id,
      type: 'income',
      amount: action.amount,
      categoryId: action.categoryId,
      note: action.note,
      wallet: action.wallet ?? 'main',
      dateKey: transactionDateKey,
    });
  }

  if (action.kind === 'record-expense') {
    const transactionDateKey = action.transactionDateKey ?? action.dateKey;
    recordTransaction(state, {
      id: action.id,
      type: 'expense',
      amount: action.amount,
      categoryId: action.categoryId,
      note: action.note,
      wallet: action.wallet ?? 'main',
      dateKey: transactionDateKey,
    });
    if (action.isBackdated) {
      state.app.lastBackdateMonth = monthKey(transactionDateKey);
      upsertMonthlySnapshot(state.app, monthKey(transactionDateKey));
    }
  }

  if (action.kind === 'split-funds') applySplitFunds(state, action);
  if (action.kind === 'pay-bill') applyBillPayment(state, action);
  if (action.kind === 'update-bill') applyBillUpdate(state, action);
  if (action.kind === 'add-bill') applyBillAdd(state, action);
  if (action.kind === 'delete-transaction') applyDeleteTransaction(state, action);

  if (action.kind === 'reload') {
    state.app.lastReloadSnapshot = toComparableSnapshot(state.app);
    state.app = cloneSnapshot(state.app);
  }

  if (action.kind === 'view-overview') {
    syncDerivedSnapshots(state.app, action.dateKey);
  }

  const violations = checkInvariants(state);
  state.violations.push(...violations);
  return state;
}

export function runActions(persona: PersonaProfile, phase: PhaseId, actions: SyntheticAction[]): PhaseRunResult {
  const state = createInitialState(persona);

  for (const action of actions) {
    applySyntheticAction(state, action);
  }

  return {
    personaId: persona.id,
    phase,
    daysRun: new Set(actions.map((action) => action.dateKey)).size,
    violations: state.violations,
    finalState: state,
  };
}
