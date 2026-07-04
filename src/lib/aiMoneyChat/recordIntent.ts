'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore, type Transaction } from '@/stores/useFinanceStore';
import { emitMoneyRecorded } from '@/lib/moneyEvents';
import type { ConfirmedMoneyIntent } from './types';

export interface RecordConfirmedMoneyIntentResult {
  transaction: Transaction;
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

  const xpAction = intent.type === 'income'
    ? { type: 'INCOME_LOGGED' as const, earnedAmount: intent.amount }
    : { type: 'EXPENSE_LOGGED' as const };
  useAuthStore.getState().awardXP(xpAction);

  // Reaction popup toàn app (chúc mừng thu / cằn nhằn chi). No-op trong SSR.
  emitMoneyRecorded({
    type: intent.type,
    amount: intent.amount,
    categoryId: intent.categoryId,
    transactionId: transaction.id,
  });

  return {
    transaction,
  };
}

