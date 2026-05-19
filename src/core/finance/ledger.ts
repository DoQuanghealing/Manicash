import {
  EXPENSE_CLEARING_ACCOUNT_ID,
  INCOME_CLEARING_ACCOUNT_ID,
} from './accounts';
import type { FinanceEvent, LedgerDirection, LedgerEntry } from './types';
import { FinanceValidationError } from './validators';

function createEntry(
  event: FinanceEvent,
  accountId: string,
  direction: LedgerDirection,
  index: number,
): LedgerEntry {
  return {
    id: `${event.id}:${index}`,
    eventId: event.id,
    eventType: event.type,
    accountId,
    amount: event.amount,
    direction,
    occurredAt: event.occurredAt,
    description: event.description,
    metadata: event.metadata,
  };
}

export function createLedgerEntriesForEvent(event: FinanceEvent): LedgerEntry[] {
  if (event.type === 'CREATE_INCOME') {
    return [
      createEntry(event, event.targetAccountId, 'debit', 1),
      createEntry(event, INCOME_CLEARING_ACCOUNT_ID, 'credit', 2),
    ];
  }

  if (event.type === 'CREATE_EXPENSE') {
    return [
      createEntry(event, EXPENSE_CLEARING_ACCOUNT_ID, 'debit', 1),
      createEntry(event, event.sourceAccountId, 'credit', 2),
    ];
  }

  return [
    createEntry(event, event.targetAccountId, 'debit', 1),
    createEntry(event, event.sourceAccountId, 'credit', 2),
  ];
}

export function assertLedgerEntriesBalance(entries: LedgerEntry[]): void {
  const debitTotal = entries
    .filter((entry) => entry.direction === 'debit')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const creditTotal = entries
    .filter((entry) => entry.direction === 'credit')
    .reduce((sum, entry) => sum + entry.amount, 0);

  if (debitTotal !== creditTotal) {
    throw new FinanceValidationError(
      `Ledger entries are not balanced. Debits ${debitTotal}, credits ${creditTotal}.`,
    );
  }
}
