import type { AccountId, FinanceAccount, FinanceEvent, LedgerEntry } from './types';
import { getAccountBalance } from './selectors';

export class FinanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceValidationError';
  }
}

export function validateAmount(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new FinanceValidationError('Amount must be an integer VND value.');
  }

  if (amount <= 0) {
    throw new FinanceValidationError('Amount must be greater than 0.');
  }
}

export function validateAccountExists(
  accountId: AccountId,
  accounts: FinanceAccount[],
): void {
  if (!accounts.some((account) => account.id === accountId)) {
    throw new FinanceValidationError(`Unknown account: ${accountId}`);
  }
}

export function validateFinanceEvent(
  event: FinanceEvent,
  accounts: FinanceAccount[],
): void {
  if (!event.id.trim()) {
    throw new FinanceValidationError('Event id is required.');
  }

  if (!event.occurredAt.trim()) {
    throw new FinanceValidationError('Event occurredAt is required.');
  }

  validateAmount(event.amount);

  if (event.type === 'CREATE_INCOME') {
    validateAccountExists(event.targetAccountId, accounts);
    return;
  }

  if (event.type === 'CREATE_EXPENSE') {
    validateAccountExists(event.sourceAccountId, accounts);
    return;
  }

  validateAccountExists(event.sourceAccountId, accounts);
  validateAccountExists(event.targetAccountId, accounts);

  if (event.sourceAccountId === event.targetAccountId) {
    throw new FinanceValidationError('Transfer source and target accounts must differ.');
  }
}

export function validateSufficientSourceBalance(
  ledgerEntries: LedgerEntry[],
  sourceAccountId: AccountId,
  amount: number,
): void {
  const sourceBalance = getAccountBalance(ledgerEntries, sourceAccountId);

  if (sourceBalance < amount) {
    throw new FinanceValidationError(
      `Insufficient balance in ${sourceAccountId}. Available ${sourceBalance}, required ${amount}.`,
    );
  }
}
