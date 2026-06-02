import type { TxnType, WalletType } from '@/stores/useFinanceStore';
import type { AccountId, FinanceEventType } from '@/core/finance/types';

export type MoneyIntentKind =
  | 'transaction'
  | 'fund_transfer'
  | 'earning_task'
  | 'goal_update'
  | 'unknown';

export type MoneyIntentConfidence = 'high' | 'medium' | 'low';

export type MoneyIntentSource = 'local_parser' | 'memory' | 'ai_fallback' | 'manual';

export interface ParsedMoneyAmount {
  value: number;
  currency: 'VND';
  rawText: string;
}

export interface ParsedMoneyCategory {
  categoryId: string;
  categoryName?: string;
  confidence: MoneyIntentConfidence;
  alternatives?: Array<{
    categoryId: string;
    categoryName?: string;
    reason?: string;
  }>;
}

export interface ParsedMoneyAccountMapping {
  legacyWallet: WalletType;
  coreSourceAccountId?: AccountId;
  coreTargetAccountId?: AccountId;
  coreEventType?: FinanceEventType;
}

export interface ParsedMoneyIntent {
  id: string;
  kind: MoneyIntentKind;
  source: MoneyIntentSource;
  rawText: string;
  normalizedText: string;
  confidence: MoneyIntentConfidence;
  type?: TxnType;
  amount?: ParsedMoneyAmount;
  category?: ParsedMoneyCategory;
  note?: string;
  occurredAt?: string;
  accountMapping?: ParsedMoneyAccountMapping;
  tags?: string[];
  needsConfirmation: boolean;
  reasons: string[];
}

export interface ConfirmedMoneyIntent {
  parsedIntentId: string;
  type: TxnType;
  amount: number;
  categoryId: string;
  note: string;
  wallet: WalletType;
  occurredAt: string;
  tags?: string[];
}

