export type AccountId = string;

export type FinanceEventType =
  | 'CREATE_INCOME'
  | 'CREATE_EXPENSE'
  | 'TRANSFER_MONEY';

export type LedgerDirection = 'debit' | 'credit';

export type FinanceMetadataValue = string | number | boolean | null;

export interface FinanceAccount {
  id: AccountId;
  name: string;
  kind: 'asset' | 'clearing';
}

export interface FinanceEventBase {
  id: string;
  type: FinanceEventType;
  amount: number;
  occurredAt: string;
  description?: string;
  metadata?: Record<string, FinanceMetadataValue>;
}

export interface CreateIncomeEvent extends FinanceEventBase {
  type: 'CREATE_INCOME';
  targetAccountId: AccountId;
}

export interface CreateExpenseEvent extends FinanceEventBase {
  type: 'CREATE_EXPENSE';
  sourceAccountId: AccountId;
}

export interface TransferMoneyEvent extends FinanceEventBase {
  type: 'TRANSFER_MONEY';
  sourceAccountId: AccountId;
  targetAccountId: AccountId;
}

export type FinanceEvent =
  | CreateIncomeEvent
  | CreateExpenseEvent
  | TransferMoneyEvent;

export interface LedgerEntry {
  id: string;
  eventId: string;
  eventType: FinanceEventType;
  accountId: AccountId;
  amount: number;
  direction: LedgerDirection;
  occurredAt: string;
  description?: string;
  metadata?: Record<string, FinanceMetadataValue>;
}

export type AccountBalances = Record<AccountId, number>;

export interface FinanceEngineOptions {
  allowNegativeBalance?: boolean;
}

export interface ExecuteFinanceEventInput {
  event: FinanceEvent;
  ledgerEntries?: LedgerEntry[];
  accounts?: FinanceAccount[];
  options?: FinanceEngineOptions;
}

export interface ExecuteFinanceEventResult {
  event: FinanceEvent;
  ledgerEntries: LedgerEntry[];
  allLedgerEntries: LedgerEntry[];
  balances: AccountBalances;
}
