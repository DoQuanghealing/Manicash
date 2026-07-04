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

/** Hint mạnh (≥2 từ) → thắng ngay cả khi có EXPENSE hint đi kèm */
const STRONG_INCOME_HINTS = [
  'nhan tien', 'nhan duoc', 'nhan luong', 'nhan thuong',
  'duoc tra', 'duoc chuyen', 'duoc nhan', 'duoc tang', 'duoc bieu', 'duoc thuong', 'duoc trao',
  'ban duoc', 'chot don', 'khach tra', 'thu tien',
  'tien ve', 'tien vao', 'rap vao',
  'chong cho', 'vo cho', 'bo cho', 'me cho', 'cha cho', 'ba cho',
  'anh cho', 'em cho', 'ban cho', 'cho minh', 'cho toi',
  'hoa hong', 'thu nhap', 'hoan tien', 'hoan tra', 'cashback', 'refund',
];

/** Hint yếu (1 từ) — chỉ dùng khi không có EXPENSE hint */
const WEAK_INCOME_HINTS = ['nhan', 'thu', 'luong', 'thuong'];

const INCOME_HINTS = [...STRONG_INCOME_HINTS, ...WEAK_INCOME_HINTS];

const EXPENSE_HINTS = [
  // Cụm cụ thể — tránh khớp "chị" (chi = older sister)
  'chi tieu', 'chi phi', 'chi cho',
  // Bill/đóng tiền
  'dong tien', 'dong bill', 'dong phi', 'dong hoc phi',
  'tra tien', 'thanh toan',
  // Mua sắm / tiêu
  'mua', 'nap', 'het', 'ton', 'tieu',
  // Từ "dong" trần — vẫn giữ vì "đóng tiền điện" rất phổ biến
  'dong',
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

  const compactMillionMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(tr|trieu|m)\s*(\d{1,3})?\b/);
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
  const hasStrongIncome = hasAny(text, STRONG_INCOME_HINTS);
  const hasIncome = hasStrongIncome || hasAny(text, WEAK_INCOME_HINTS);
  const hasExpense = hasAny(text, EXPENSE_HINTS);
  const hasTransfer = hasAny(text, TRANSFER_HINTS);

  if (hasTransfer && !hasExpense && !hasIncome) {
    reasons.push('Matched transfer/saving keywords.');
    return { type: 'transfer', reasons };
  }

  // Strong income hint (cụm ≥2 từ) thắng ngay cả khi có expense hint đi kèm
  // VD: "nhan tien chi trang" — "chi trang" khớp expense nhưng "nhan tien" là signal mạnh
  if (hasStrongIncome) {
    reasons.push('Strong income keyword matched — overrides ambiguity.');
    return { type: 'income', reasons };
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
    reasons.push('Both income and expense keywords — defaulting to expense.');
    return { type: 'expense', reasons };
  }

  return { reasons };
}

const keywordMatcherCache = new Map<string, RegExp>();

/**
 * Khớp keyword theo RANH GIỚI TỪ thay vì substring thuần — tránh match nhầm
 * (vd "be" không còn dính "benh vien", "an" không dính "ban"). Cho phép nạp
 * bộ keyword phong phú mà không loạn chéo danh mục.
 */
function keywordMatches(text: string, keyword: string): boolean {
  let matcher = keywordMatcherCache.get(keyword);
  if (!matcher) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matcher = new RegExp(`\\b${escaped}\\b`);
    keywordMatcherCache.set(keyword, matcher);
  }
  return matcher.test(text);
}

function scoreCategory(text: string, rules: CategoryKeywordRule[]): Array<CategoryKeywordRule & { score: number }> {
  return rules
    .map((rule) => ({
      ...rule,
      score: rule.keywords.reduce((score, keyword) => (
        keywordMatches(text, keyword) ? score + keyword.split(' ').length : score
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
    ? { legacyWallet: 'main' as const }
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
