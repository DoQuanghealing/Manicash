import type { InvariantDefinition, InvariantViolation, SimulationState } from './types';
import {
  SAVINGS_FUNDS,
  comparableSnapshotsEqual,
  formatVnd,
  getActiveBillsTotal,
  getExpectedBillFundBalance,
  getExpectedMainBalance,
  getExpectedSavingsByFund,
  getExpectedSavingsTotal,
  getExpectedSystemTotal,
  isCloseMoney,
  sum,
  toComparableSnapshot,
} from './math';

export const INVARIANT_DEFINITIONS: InvariantDefinition[] = [
  {
    id: 1,
    name: 'main-balance-ledger-match',
    description: 'Finance mainBalance must equal main income minus main expenses and all split deductions.',
  },
  {
    id: 2,
    name: 'bill-fund-ledger-match',
    description: 'Bill fund balance must equal bill-fund income plus split bill contributions minus paid bills.',
  },
  {
    id: 3,
    name: 'savings-funds-ledger-match',
    description: 'Reserve + goals + investment balances must equal savings contributions from split flows.',
  },
  {
    id: 4,
    name: 'system-total-conservation',
    description: 'All money in the system must equal total income minus non-bill expenses minus paid bills.',
  },
  {
    id: 5,
    name: 'fixed-bills-target-active-bills',
    description: 'Overview fixedBillsFundingTarget must be the sum of active fixed bills.',
  },
  {
    id: 6,
    name: 'safe-labels-not-duplicated',
    description: 'SafeToSpend and expense-funding cards must not both use the same safe/an-toan label.',
  },
  {
    id: 7,
    name: 'backdate-recalculates-month-snapshot',
    description: 'After a backdated transaction, that month snapshot must be recalculated from transactions.',
  },
  {
    id: 8,
    name: 'delete-transaction-rolls-back',
    description: 'Deleted transactions must leave no balance, budget, or snapshot residue.',
  },
  {
    id: 9,
    name: 'split-records-fund-contributions',
    description: 'Every split savings amount must be recorded into monthly fund contributions for charts.',
  },
  {
    id: 10,
    name: 'reload-state-identical',
    description: 'Reloading mid-test must preserve the app state exactly.',
  },
];

const definitionsById = new Map(INVARIANT_DEFINITIONS.map((definition) => [definition.id, definition]));

function violation(
  state: SimulationState,
  invariantId: number,
  expected: string,
  actual: string,
): InvariantViolation {
  const definition = definitionsById.get(invariantId);
  return {
    personaId: state.persona.id,
    day: state.day,
    invariantId,
    invariantName: definition?.name ?? `invariant-${invariantId}`,
    expected,
    actual,
    dateKey: state.app.currentDateKey,
  };
}

function compareMoney(
  state: SimulationState,
  invariantId: number,
  expected: number,
  actual: number,
): InvariantViolation | null {
  if (isCloseMoney(expected, actual)) return null;
  return violation(state, invariantId, formatVnd(expected), formatVnd(actual));
}

function checkMainBalance(state: SimulationState): InvariantViolation | null {
  return compareMoney(state, 1, getExpectedMainBalance(state.ledger), state.app.mainBalance);
}

function checkBillFundBalance(state: SimulationState): InvariantViolation | null {
  return compareMoney(state, 2, getExpectedBillFundBalance(state.ledger), state.app.billFundBalance);
}

function checkSavingsFunds(state: SimulationState): InvariantViolation | null {
  for (const fund of SAVINGS_FUNDS) {
    const expected = getExpectedSavingsByFund(state.ledger, fund);
    const actual = state.app.fundBalances[fund];
    if (!isCloseMoney(expected, actual)) {
      return violation(state, 3, `${fund}=${formatVnd(expected)}`, `${fund}=${formatVnd(actual)}`);
    }
  }

  const expectedTotal = getExpectedSavingsTotal(state.ledger);
  const actualTotal = sum(SAVINGS_FUNDS.map((fund) => state.app.fundBalances[fund]));
  return compareMoney(state, 3, expectedTotal, actualTotal);
}

function checkSystemTotal(state: SimulationState): InvariantViolation | null {
  const expected = getExpectedSystemTotal(state.ledger);
  const actual =
    state.app.mainBalance +
    state.app.billFundBalance +
    sum(SAVINGS_FUNDS.map((fund) => state.app.fundBalances[fund]));

  return compareMoney(state, 4, expected, actual);
}

function checkFixedBillsTarget(state: SimulationState): InvariantViolation | null {
  const expected = getActiveBillsTotal(state.app.fixedBills);
  const actual = state.app.overview.fixedBillsFundingTarget;
  return compareMoney(state, 5, expected, actual);
}

function checkSafeLabels(state: SimulationState): InvariantViolation | null {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('vi-VN');
  const safeLabel = normalize(state.app.overview.safeToSpendLabel);
  const fundingLabel = normalize(state.app.overview.expenseFundingLabel);
  const bothLookSafe =
    safeLabel.includes('an toan') &&
    fundingLabel.includes('an toan') &&
    safeLabel === fundingLabel;

  if (!bothLookSafe) return null;
  return violation(state, 6, 'distinct safe-to-spend and funding labels', `${safeLabel} / ${fundingLabel}`);
}

function checkBackdateSnapshot(state: SimulationState): InvariantViolation | null {
  const month = state.app.lastBackdateMonth;
  if (!month) return null;

  const expectedExpense = sum(
    state.app.transactions
      .filter((txn) => txn.type === 'expense' && txn.dateKey.startsWith(month))
      .map((txn) => txn.amount),
  );
  const snapshot = state.app.monthlySnapshots.find((item) => item.month === month);
  const actualExpense = snapshot?.expenseTotal ?? 0;
  return compareMoney(state, 7, expectedExpense, actualExpense);
}

function checkDeleteRollback(state: SimulationState): InvariantViolation | null {
  const deletedId = state.app.lastDeletedTransactionId;
  if (!deletedId) return null;

  const appResidue = state.app.transactions.some((txn) => txn.id === deletedId);
  const ledgerResidue = state.ledger.transactions.some((txn) => txn.id === deletedId);
  if (!appResidue && !ledgerResidue) return null;

  return violation(state, 8, `transaction ${deletedId} removed everywhere`, 'deleted transaction still present');
}

function checkFundContributions(state: SimulationState): InvariantViolation | null {
  for (const fund of SAVINGS_FUNDS) {
    const expected = getExpectedSavingsByFund(state.ledger, fund);
    const actual = sum(state.app.monthlyContributions[fund].map((contribution) => contribution.amount));
    if (!isCloseMoney(expected, actual)) {
      return violation(state, 9, `${fund} contributions=${formatVnd(expected)}`, `${fund} contributions=${formatVnd(actual)}`);
    }
  }

  return null;
}

function checkReloadIdentity(state: SimulationState): InvariantViolation | null {
  const beforeReload = state.app.lastReloadSnapshot;
  if (!beforeReload) return null;

  const current = toComparableSnapshot(state.app);
  if (comparableSnapshotsEqual(beforeReload, current)) return null;
  return violation(state, 10, 'state before reload equals state after reload', 'state changed across reload');
}

export function checkInvariants(state: SimulationState): InvariantViolation[] {
  const checks = [
    checkMainBalance,
    checkBillFundBalance,
    checkSavingsFunds,
    checkSystemTotal,
    checkFixedBillsTarget,
    checkSafeLabels,
    checkBackdateSnapshot,
    checkDeleteRollback,
    checkFundContributions,
    checkReloadIdentity,
  ];

  return checks.flatMap((check) => {
    const result = check(state);
    return result ? [result] : [];
  });
}
