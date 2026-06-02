import { MAIN_BANK_ACCOUNT_ID } from '@/core/finance/accounts';
import type { TxnType } from '@/stores/useFinanceStore';
import {
  getCategoryDisplayName,
  isKnownAppCategory,
  isKnownTaxonomyCategory,
} from './taxonomy';
import type {
  MoneyIntentConfidence,
  ParsedMoneyAmount,
  ParsedMoneyIntent,
} from './types';

export interface AiFallbackCandidate {
  type?: unknown;
  amount?: unknown;
  categoryId?: unknown;
  note?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

export interface AiFallbackValidationResult {
  intent: ParsedMoneyIntent | null;
  reason: string;
}

export interface AiFallbackRequestPayload {
  rawText: string;
  localIntent: {
    type?: TxnType;
    amount?: number;
    categoryId?: string;
    confidence?: MoneyIntentConfidence;
  };
}

function makeIntentId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeType(value: unknown, fallback?: TxnType): TxnType | undefined {
  if (value === 'income' || value === 'expense' || value === 'transfer') return value;
  return fallback;
}

function normalizeConfidence(value: unknown): MoneyIntentConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function normalizeAmount(value: unknown, fallback?: number): number | undefined {
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(amount) && amount > 0 && amount <= 2_000_000_000) {
    return Math.round(amount);
  }
  return fallback && fallback > 0 ? fallback : undefined;
}

function normalizeCategoryId(value: unknown, fallback?: string): string | undefined {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (candidate && isKnownTaxonomyCategory(candidate) && isKnownAppCategory(candidate)) {
    return candidate;
  }

  if (fallback && isKnownTaxonomyCategory(fallback) && isKnownAppCategory(fallback)) {
    return fallback;
  }

  return undefined;
}

function buildAccountMapping(type?: TxnType) {
  if (!type) return undefined;
  return {
    legacyWallet: 'main' as const,
    coreSourceAccountId: type === 'expense' ? MAIN_BANK_ACCOUNT_ID : undefined,
    coreTargetAccountId: type === 'income' ? MAIN_BANK_ACCOUNT_ID : undefined,
    coreEventType: type === 'income'
      ? 'CREATE_INCOME' as const
      : type === 'expense'
        ? 'CREATE_EXPENSE' as const
        : undefined,
  };
}

export function validateAiFallbackCandidate(
  candidate: AiFallbackCandidate,
  payload: AiFallbackRequestPayload,
): AiFallbackValidationResult {
  const type = normalizeType(candidate.type, payload.localIntent.type);
  if (!type || type === 'transfer') {
    return { intent: null, reason: 'AI fallback did not return a supported income/expense type.' };
  }

  const amountValue = normalizeAmount(candidate.amount, payload.localIntent.amount);
  if (!amountValue) {
    return { intent: null, reason: 'AI fallback did not return a valid amount.' };
  }

  const categoryId = normalizeCategoryId(candidate.categoryId, payload.localIntent.categoryId);
  if (!categoryId) {
    return { intent: null, reason: 'AI fallback did not return a known category.' };
  }

  const confidence = normalizeConfidence(candidate.confidence);
  const amount: ParsedMoneyAmount = {
    value: amountValue,
    currency: 'VND',
    rawText: String(candidate.amount ?? payload.localIntent.amount ?? amountValue),
  };

  const note = typeof candidate.note === 'string' && candidate.note.trim()
    ? candidate.note.trim().slice(0, 120)
    : payload.rawText.trim().slice(0, 120);

  return {
    intent: {
      id: makeIntentId(),
      kind: 'transaction',
      source: 'ai_fallback',
      rawText: payload.rawText,
      normalizedText: payload.rawText.toLowerCase().trim(),
      confidence,
      type,
      amount,
      category: {
        categoryId,
        categoryName: getCategoryDisplayName(categoryId),
        confidence,
        alternatives: payload.localIntent.categoryId && payload.localIntent.categoryId !== categoryId
          ? [
              {
                categoryId: payload.localIntent.categoryId,
                categoryName: getCategoryDisplayName(payload.localIntent.categoryId),
                reason: 'Local parser suggestion before AI fallback.',
              },
            ]
          : undefined,
      },
      note,
      occurredAt: new Date().toISOString(),
      accountMapping: buildAccountMapping(type),
      tags: [],
      needsConfirmation: true,
      reasons: [
        `AI fallback accepted category ${categoryId}.`,
        typeof candidate.reason === 'string' ? candidate.reason.slice(0, 160) : 'AI fallback returned valid JSON.',
      ],
    },
    reason: 'AI fallback candidate validated.',
  };
}

export function shouldRequestAiFallback(intent: ParsedMoneyIntent): boolean {
  if (!intent.amount) return false;
  if (!intent.type || intent.type === 'transfer') return false;
  if (intent.source === 'memory') return false;
  if (intent.confidence !== 'low') return false;
  return true;
}

