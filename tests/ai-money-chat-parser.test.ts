import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/data/categories';
import {
  EXPENSE_KEYWORD_RULES,
  INCOME_KEYWORD_RULES,
} from '@/lib/aiMoneyChat/categoryKeywords';
import { parseMoneyText, normalizeMoneyTextForMemory } from '@/lib/aiMoneyChat/parser';
import {
  AI_MONEY_CHAT_TAXONOMY,
  getDefaultCategoryId,
  getTaxonomyByDirection,
  isKnownAppCategory,
  isKnownTaxonomyCategory,
} from '@/lib/aiMoneyChat/taxonomy';

type TestFn = () => void;

function describe(name: string, fn: TestFn): void {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectDefined<T>(actual: T | undefined, label: string): T {
  if (actual === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return actual;
}

describe('AI Money Chat parser - VND amount parsing', () => {
  it('parses expense shorthand 50k', () => {
    const intent = parseMoneyText('mua tra sua 50k');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 50_000);
    expectEqual(intent.category?.categoryId, 'food');
    expectEqual(intent.confidence, 'high');
    expectEqual(intent.needsConfirmation, false);
  });

  it('parses supermarket expense 1300k', () => {
    const intent = parseMoneyText('di sieu thi het 1300k');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 1_300_000);
    expectEqual(intent.category?.categoryId, 'groceries');
  });

  it('parses income shorthand 20tr', () => {
    const intent = parseMoneyText('nhan luong 20tr');

    expectEqual(intent.type, 'income');
    expectEqual(expectDefined(intent.amount, 'amount').value, 20_000_000);
    expectEqual(intent.category?.categoryId, 'salary');
    expectEqual(intent.accountMapping?.coreEventType, 'CREATE_INCOME');
  });

  it('parses compact million phrase 1tr3', () => {
    const intent = parseMoneyText('di cho 1tr3');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 1_300_000);
    expectEqual(intent.category?.categoryId, 'groceries');
  });

  it('parses dotted VND amount', () => {
    const intent = parseMoneyText('mua shopee 2.500.000');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 2_500_000);
    expectEqual(intent.category?.categoryId, 'shopping');
  });
});

describe('AI Money Chat parser - category and safety', () => {
  it('normalizes Vietnamese text for memory', () => {
    expectEqual(normalizeMoneyTextForMemory('Mua \u0111\u1eadu h\u0169 20k'), 'mua dau hu 20k');
  });

  it('classifies tofu as food', () => {
    const intent = parseMoneyText('mua \u0111\u1eadu h\u0169 20k');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 20_000);
    expectEqual(intent.category?.categoryId, 'food');
  });

  it('classifies traditional medicine as health', () => {
    const intent = parseMoneyText('mua thu\u1ed1c \u0111\u00f4ng y 350k');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 350_000);
    expectEqual(intent.category?.categoryId, 'health');
  });

  it('falls back to other with confirmation when category is unclear', () => {
    const intent = parseMoneyText('mua do la la 99k');

    expectEqual(intent.type, 'expense');
    expectEqual(expectDefined(intent.amount, 'amount').value, 99_000);
    expectEqual(intent.category?.categoryId, 'other');
    expectEqual(intent.confidence, 'low');
    expectEqual(intent.needsConfirmation, true);
  });

  it('does not invent a transaction without amount', () => {
    const intent = parseMoneyText('hom nay an gi day');

    expectEqual(intent.kind, 'unknown');
    expectEqual(intent.amount, undefined);
    expectEqual(intent.needsConfirmation, true);
  });
});

describe('AI Money Chat taxonomy - consistency', () => {
  it('covers all app categories', () => {
    for (const category of [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]) {
      if (!isKnownTaxonomyCategory(category.id)) {
        throw new Error(`Missing taxonomy category: ${category.id}`);
      }
    }
  });

  it('does not point keyword rules to unknown categories', () => {
    for (const rule of [...EXPENSE_KEYWORD_RULES, ...INCOME_KEYWORD_RULES]) {
      if (!isKnownTaxonomyCategory(rule.categoryId)) {
        throw new Error(`Keyword rule points to unknown taxonomy category: ${rule.categoryId}`);
      }
      if (!isKnownAppCategory(rule.categoryId)) {
        throw new Error(`Keyword rule points to unknown app category: ${rule.categoryId}`);
      }
    }
  });

  it('keeps default category IDs valid', () => {
    expectEqual(getDefaultCategoryId('expense'), 'other');
    expectEqual(getDefaultCategoryId('income'), 'other-in');
    expectEqual(isKnownAppCategory(getDefaultCategoryId('expense')), true);
    expectEqual(isKnownAppCategory(getDefaultCategoryId('income')), true);
  });

  it('keeps taxonomy compact enough for consumer finance', () => {
    expectEqual(getTaxonomyByDirection('expense').length <= 16, true);
    expectEqual(getTaxonomyByDirection('income').length <= 8, true);
    expectEqual(AI_MONEY_CHAT_TAXONOMY.every((category) => category.allowAsUserCategory), true);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

