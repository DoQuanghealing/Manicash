import type {
  AccountId,
  CreateExpenseEvent,
  CreateIncomeEvent,
  FinanceMetadataValue,
  TransferMoneyEvent,
} from './types';

interface EventFactoryBase {
  id: string;
  amount: number;
  occurredAt: string;
  description?: string;
  metadata?: Record<string, FinanceMetadataValue>;
}

export function createIncomeEvent(
  input: EventFactoryBase & { targetAccountId: AccountId },
): CreateIncomeEvent {
  return {
    ...input,
    type: 'CREATE_INCOME',
  };
}

export function createExpenseEvent(
  input: EventFactoryBase & { sourceAccountId: AccountId },
): CreateExpenseEvent {
  return {
    ...input,
    type: 'CREATE_EXPENSE',
  };
}

export function createTransferMoneyEvent(
  input: EventFactoryBase & {
    sourceAccountId: AccountId;
    targetAccountId: AccountId;
  },
): TransferMoneyEvent {
  return {
    ...input,
    type: 'TRANSFER_MONEY',
  };
}
