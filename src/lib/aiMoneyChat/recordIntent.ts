'use client';

import { MAIN_BANK_ACCOUNT_ID } from '@/core/finance/accounts';
import { calculateXP } from '@/lib/xpEngine';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';
import { useFinanceStore, type Transaction } from '@/stores/useFinanceStore';
import type { ConfirmedMoneyIntent } from './types';

export interface RecordConfirmedMoneyIntentResult {
  transaction: Transaction;
  financeCoreMirrored: boolean;
}

export function recordConfirmedMoneyIntent(
  intent: ConfirmedMoneyIntent,
): RecordConfirmedMoneyIntentResult {
  if (intent.type === 'transfer') {
    throw new Error('Chat transfer confirmation is not supported yet.');
  }

  const transaction = useFinanceStore.getState().addTransaction({
    transactionDate: new Date(intent.occurredAt),
    type: intent.type,
    amount: intent.amount,
    categoryId: intent.categoryId,
    note: intent.note,
    wallet: intent.wallet,
  });

  let financeCoreMirrored = false;
  const userId = useAuthStore.getState().user?.uid ?? 'local_user';

  try {
    const baseEvent = {
      id: `chat-${transaction.id}`,
      amount: intent.amount,
      occurredAt: transaction.date,
      description: transaction.note,
      metadata: {
        userId,
        categoryId: transaction.categoryId,
        legacyTransactionId: transaction.id,
        source: 'ai_money_chat',
        parsedIntentId: intent.parsedIntentId,
      },
    };

    if (intent.type === 'income') {
      useFinanceCoreStore.getState().execute({
        ...baseEvent,
        type: 'CREATE_INCOME',
        targetAccountId: MAIN_BANK_ACCOUNT_ID,
      });
      financeCoreMirrored = true;
    }

    if (intent.type === 'expense') {
      useFinanceCoreStore.getState().execute({
        ...baseEvent,
        type: 'CREATE_EXPENSE',
        sourceAccountId: MAIN_BANK_ACCOUNT_ID,
      });
      financeCoreMirrored = true;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ai-money-chat] failed to mirror transaction to finance core', error);
    }
  }

  const xpAction = intent.type === 'income'
    ? { type: 'INCOME_LOGGED' as const, earnedAmount: intent.amount }
    : { type: 'EXPENSE_LOGGED' as const };
  useAuthStore.getState().awardXP(xpAction);

  return {
    transaction,
    financeCoreMirrored,
  };
}

