import {
  shouldRequestAiFallback,
  validateAiFallbackCandidate,
  type AiFallbackRequestPayload,
} from '@/lib/aiMoneyChat/aiFallback';
import { parseMoneyText } from '@/lib/aiMoneyChat/parser';

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

function makePayload(): AiFallbackRequestPayload {
  return {
    rawText: 'mua do phong thuy 500k',
    localIntent: {
      type: 'expense',
      amount: 500_000,
      categoryId: 'other',
      confidence: 'low',
    },
  };
}

describe('AI Money Chat fallback validation', () => {
  it('accepts a valid AI candidate and keeps confirmation required', () => {
    const result = validateAiFallbackCandidate(
      {
        type: 'expense',
        amount: 500_000,
        categoryId: 'shopping',
        note: 'mua do phong thuy',
        confidence: 'medium',
        reason: 'Do phong thuy is a shopping-like item.',
      },
      makePayload(),
    );

    expectEqual(Boolean(result.intent), true);
    expectEqual(result.intent?.source, 'ai_fallback');
    expectEqual(result.intent?.category?.categoryId, 'shopping');
    expectEqual(result.intent?.needsConfirmation, true);
  });

  it('rejects unknown category IDs', () => {
    const result = validateAiFallbackCandidate(
      {
        type: 'expense',
        amount: 500_000,
        categoryId: 'spiritual-items',
        confidence: 'high',
      },
      { ...makePayload(), localIntent: { type: 'expense', amount: 500_000, confidence: 'low' } },
    );

    expectEqual(result.intent, null);
  });

  it('falls back to local amount when AI amount is invalid', () => {
    const result = validateAiFallbackCandidate(
      {
        type: 'expense',
        amount: 'not-a-number',
        categoryId: 'shopping',
        confidence: 'medium',
      },
      makePayload(),
    );

    expectEqual(result.intent?.amount?.value, 500_000);
  });

  it('requests AI only for low-confidence local income/expense intents', () => {
    expectEqual(shouldRequestAiFallback(parseMoneyText('mua do la la 99k')), true);
    expectEqual(shouldRequestAiFallback(parseMoneyText('mua tra sua 50k')), false);
    expectEqual(shouldRequestAiFallback(parseMoneyText('hom nay an gi day')), false);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

