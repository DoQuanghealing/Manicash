import {
  BILL_FUND_ACCOUNT_ID,
  MAIN_BANK_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from './accounts';
import { executeFinanceEvent } from './engine';
import { getAccountBalance } from './selectors';
import type { FinanceEvent, LedgerEntry } from './types';

function assertEqual(actual: number, expected: number, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, got ${actual}.`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
  } catch {
    return;
  }

  throw new Error(`${message}. Expected function to throw.`);
}

function execute(event: FinanceEvent, ledgerEntries: LedgerEntry[] = []): LedgerEntry[] {
  return executeFinanceEvent({ event, ledgerEntries }).allLedgerEntries;
}

export function runFinanceEngineSmokeTest(): void {
  const occurredAt = '2026-05-12T00:00:00.000Z';

  const incomeLedger = execute({
    id: 'evt-income-main',
    type: 'CREATE_INCOME',
    amount: 1_000_000,
    occurredAt,
    targetAccountId: MAIN_BANK_ACCOUNT_ID,
  });

  assertEqual(
    getAccountBalance(incomeLedger, MAIN_BANK_ACCOUNT_ID),
    1_000_000,
    'CREATE_INCOME should increase main_bank balance',
  );

  const spendingSeedLedger = execute({
    id: 'evt-income-spending',
    type: 'CREATE_INCOME',
    amount: 500_000,
    occurredAt,
    targetAccountId: SPENDING_ACCOUNT_ID,
  });

  const expenseLedger = execute(
    {
      id: 'evt-expense-spending',
      type: 'CREATE_EXPENSE',
      amount: 200_000,
      occurredAt,
      sourceAccountId: SPENDING_ACCOUNT_ID,
    },
    spendingSeedLedger,
  );

  assertEqual(
    getAccountBalance(expenseLedger, SPENDING_ACCOUNT_ID),
    300_000,
    'CREATE_EXPENSE should decrease spending balance after funding',
  );

  const transferLedger = execute(
    {
      id: 'evt-transfer-main-bill',
      type: 'TRANSFER_MONEY',
      amount: 250_000,
      occurredAt,
      sourceAccountId: MAIN_BANK_ACCOUNT_ID,
      targetAccountId: BILL_FUND_ACCOUNT_ID,
    },
    incomeLedger,
  );

  assertEqual(
    getAccountBalance(transferLedger, MAIN_BANK_ACCOUNT_ID),
    750_000,
    'TRANSFER_MONEY should decrease source balance',
  );
  assertEqual(
    getAccountBalance(transferLedger, BILL_FUND_ACCOUNT_ID),
    250_000,
    'TRANSFER_MONEY should increase target balance',
  );

  assertThrows(
    () => {
      execute({
        id: 'evt-invalid-zero',
        type: 'CREATE_INCOME',
        amount: 0,
        occurredAt,
        targetAccountId: MAIN_BANK_ACCOUNT_ID,
      });
    },
    'amount <= 0 should be rejected',
  );

  assertThrows(
    () => {
      execute({
        id: 'evt-invalid-same-transfer',
        type: 'TRANSFER_MONEY',
        amount: 100_000,
        occurredAt,
        sourceAccountId: MAIN_BANK_ACCOUNT_ID,
        targetAccountId: MAIN_BANK_ACCOUNT_ID,
      });
    },
    'transfer with same source and target should be rejected',
  );

  assertThrows(
    () => {
      executeFinanceEvent({
        event: {
          id: 'evt-invalid-overdraw',
          type: 'CREATE_EXPENSE',
          amount: 100_000,
          occurredAt,
          sourceAccountId: SPENDING_ACCOUNT_ID,
        },
        ledgerEntries: [],
        options: { allowNegativeBalance: false },
      });
    },
    'expense over balance should be rejected when allowNegativeBalance=false',
  );
}
