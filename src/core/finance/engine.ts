import { DEFAULT_FINANCE_ACCOUNTS } from './accounts';
import { createLedgerEntriesForEvent, assertLedgerEntriesBalance } from './ledger';
import { getAccountBalances } from './selectors';
import type {
  ExecuteFinanceEventInput,
  ExecuteFinanceEventResult,
  FinanceEvent,
  LedgerEntry,
} from './types';
import {
  validateFinanceEvent,
  validateSufficientSourceBalance,
} from './validators';

function getSourceAccountForBalanceCheck(event: FinanceEvent): string | null {
  if (event.type === 'CREATE_EXPENSE') return event.sourceAccountId;
  if (event.type === 'TRANSFER_MONEY') return event.sourceAccountId;
  return null;
}

export function executeFinanceEvent({
  event,
  ledgerEntries = [],
  accounts = DEFAULT_FINANCE_ACCOUNTS,
  options = {},
}: ExecuteFinanceEventInput): ExecuteFinanceEventResult {
  validateFinanceEvent(event, accounts);

  const allowNegativeBalance = options.allowNegativeBalance ?? false;
  const sourceAccountId = getSourceAccountForBalanceCheck(event);

  if (!allowNegativeBalance && sourceAccountId) {
    validateSufficientSourceBalance(ledgerEntries, sourceAccountId, event.amount);
  }

  const newLedgerEntries = createLedgerEntriesForEvent(event);
  assertLedgerEntriesBalance(newLedgerEntries);

  const allLedgerEntries: LedgerEntry[] = [
    ...ledgerEntries,
    ...newLedgerEntries,
  ];

  return {
    event,
    ledgerEntries: newLedgerEntries,
    allLedgerEntries,
    balances: getAccountBalances(allLedgerEntries),
  };
}

export type {
  AccountBalances,
  AccountId,
  ExecuteFinanceEventInput,
  ExecuteFinanceEventResult,
  FinanceAccount,
  FinanceEngineOptions,
  FinanceEvent,
  LedgerEntry,
} from './types';
