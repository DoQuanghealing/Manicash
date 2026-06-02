import { MAIN_BANK_ACCOUNT_ID } from '@/core/finance/accounts';
import {
  EXPENSE_KEYWORD_RULES,
  INCOME_KEYWORD_RULES,
  type CategoryKeywordRule,
} from './categoryKeywords';
import {
  DEFAULT_EXPENSE_CATEGORY_ID,
  DEFAULT_INCOME_CATEGORY_ID,
  getCategoryDisplayName,
} from './taxonomy';
import type {
  MoneyIntentConfidence,
  ParsedMoneyCategory,
  ParsedMoneyIntent,
} from './types';
import type { TxnType } from '@/stores/useFinanceStore';

const INCOME_HINTS = [
  'ban duoc',
  'chot don',
  'duoc tra',
  'duoc chuyen',
  'duoc nhan',
  'khach tra',
  'luong',
  'nhan',
  'thu',
  'thuong',
];

const EXPENSE_HINTS = [
  'chi',
  'dong',
  'het',
  'mua',
  'nap',
  'thanh toan',
  'tra tien',
  'ton',
];

const TRANSFER_HINTS = [
  'bo vao quy',
  'chuyen',
  'chia tien',
  'de danh',
  'tiet kiem',
];

interface AmountParseResult {
  value: number;
  rawText: string;
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text: string, hints: string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

function parseNumber(raw: string): number {
  const clean = raw.replace(/\s/g, '').replace(/,/g, '.');
  if (clean.includes('.')) {
    const parts = clean.split('.');
    const allThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    if (allThousands) {
      return Number(parts.join(''));
    }
    return Number(clean);
  }
  return Number(clean);
}

function parseAmount(input: string): AmountParseResult | undefined {
  const text = normalizeText(input);

  const compactMillionMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(tr|trieu)\s*(\d{1,3})?\b/);
  if (compactMillionMatch) {
    const major = parseNumber(compactMillionMatch[1]);
    const minorRaw = compactMillionMatch[3];
    const minor = minorRaw ? Number(minorRaw) * 100_000 : 0;
    return {
      value: Math.round(major * 1_000_000 + minor),
      rawText: compactMillionMatch[0],
    };
  }

  const thousandMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan)\b/);
  if (thousandMatch) {
    return {
      value: Math.round(parseNumber(thousandMatch[1]) * 1_000),
      rawText: thousandMatch[0],
    };
  }

  const plainMoneyMatch = text.match(/\b\d{1,3}(?:[.,]\d{3}){1,3}\b|\b\d{5,12}\b/);
  if (plainMoneyMatch) {
    return {
      value: Math.round(parseNumber(plainMoneyMatch[0])),
      rawText: plainMoneyMatch[0],
    };
  }

  return undefined;
}

function detectType(text: string): { type?: TxnType; reasons: string[] } {
  const reasons: string[] = [];
  const hasIncome = hasAny(text, INCOME_HINTS);
  const hasExpense = hasAny(text, EXPENSE_HINTS);
  const hasTransfer = hasAny(text, TRANSFER_HINTS);

  if (hasTransfer && !hasExpense && !hasIncome) {
    reasons.push('Matched transfer/saving keywords.');
    return { type: 'transfer', reasons };
  }

  if (hasIncome && !hasExpense) {
    reasons.push('Matched income keywords.');
    return { type: 'income', reasons };
  }

  if (hasExpense && !hasIncome) {
    reasons.push('Matched expense keywords.');
    return { type: 'expense', reasons };
  }

  if (hasIncome && hasExpense) {
    reasons.push('Both income and expense keywords were present.');
    return { reasons };
  }

  return { reasons };
}

function scoreCategory(text: string, rules: CategoryKeywordRule[]): Array<CategoryKeywordRule & { score: number }> {
  return rules
    .map((rule) => ({
      ...rule,
      score: rule.keywords.reduce((score, keyword) => (
        text.includes(keyword) ? score + keyword.split(' ').length : score
      ), 0),
    }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);
}

function categoryConfidence(topScore: number): MoneyIntentConfidence {
  if (topScore >= 2) return 'high';
  return 'medium';
}

function detectCategory(text: string, type?: TxnType): ParsedMoneyCategory | undefined {
  if (type === 'transfer') return undefined;

  const rules = type === 'income' ? INCOME_KEYWORD_RULES : EXPENSE_KEYWORD_RULES;
  const scored = scoreCategory(text, rules);
  const best = scored[0];

  if (!best) {
    if (type === 'income') {
      return {
        categoryId: DEFAULT_INCOME_CATEGORY_ID,
        categoryName: getCategoryDisplayName(DEFAULT_INCOME_CATEGORY_ID),
        confidence: 'low',
      };
    }
    return {
      categoryId: DEFAULT_EXPENSE_CATEGORY_ID,
      categoryName: getCategoryDisplayName(DEFAULT_EXPENSE_CATEGORY_ID),
      confidence: 'low',
      alternatives: [
        { categoryId: 'shopping', categoryName: getCategoryDisplayName('shopping'), reason: 'Fallback for unclear purchases.' },
        { categoryId: 'groceries', categoryName: getCategoryDisplayName('groceries'), reason: 'Common household spending bucket.' },
      ],
    };
  }

  return {
    categoryId: best.categoryId,
    categoryName: best.categoryName,
    confidence: categoryConfidence(best.score),
    alternatives: scored.slice(1, 3).map((rule) => ({
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
    })),
  };
}

function combineConfidence(parts: Array<MoneyIntentConfidence | undefined>): MoneyIntentConfidence {
  if (parts.includes('low')) return 'low';
  if (parts.includes('medium')) return 'medium';
  return 'high';
}

function makeIntentId(): string {
  return `parsed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseMoneyText(input: string): ParsedMoneyIntent {
  const normalizedText = normalizeText(input);
  const reasons: string[] = [];
  const amount = parseAmount(input);
  const detected = detectType(normalizedText);
  reasons.push(...detected.reasons);

  const type = detected.type ?? (amount ? 'expense' : undefined);
  if (!detected.type && amount) {
    reasons.push('Amount found but no clear intent; defaulted to expense draft.');
  }

  const category = detectCategory(normalizedText, type);
  if (category) {
    reasons.push(`Category candidate: ${category.categoryId}.`);
  }

  if (!amount) {
    reasons.push('No VND amount found.');
  }

  const amountConfidence: MoneyIntentConfidence = amount ? 'high' : 'low';
  const typeConfidence: MoneyIntentConfidence = detected.type ? 'high' : amount ? 'medium' : 'low';
  const confidence = combineConfidence([amountConfidence, typeConfidence, category?.confidence]);

  const accountMapping = type
    ? {
        legacyWallet: 'main' as const,
        coreSourceAccountId: type === 'expense' ? MAIN_BANK_ACCOUNT_ID : undefined,
        coreTargetAccountId: type === 'income' ? MAIN_BANK_ACCOUNT_ID : undefined,
        coreEventType: type === 'income'
          ? 'CREATE_INCOME' as const
          : type === 'expense'
            ? 'CREATE_EXPENSE' as const
            : undefined,
      }
    : undefined;

  return {
    id: makeIntentId(),
    kind: type === 'transfer' ? 'fund_transfer' : type ? 'transaction' : 'unknown',
    source: 'local_parser',
    rawText: input,
    normalizedText,
    confidence,
    type,
    amount: amount
      ? {
          value: amount.value,
          currency: 'VND',
          rawText: amount.rawText,
        }
      : undefined,
    category,
    note: input.trim(),
    occurredAt: new Date().toISOString(),
    accountMapping,
    tags: [],
    needsConfirmation: confidence !== 'high',
    reasons,
  };
}

export function normalizeMoneyTextForMemory(input: string): string {
  return normalizeText(input);
}

/** Public VND amount extractor — reused by the earning planner. Returns undefined if none found. */
export function extractVndAmount(input: string): number | undefined {
  return parseAmount(input)?.value;
}
