import { createMoneyReaction } from '@/lib/aiMoneyChat/moneyReaction';

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

function expectContains(actual: string | undefined, expected: string): void {
  if (!actual?.includes(expected)) {
    throw new Error(`Expected "${actual ?? ''}" to include "${expected}"`);
  }
}

const goals = [
  { name: 'Mua xe', targetAmount: 800_000_000, currentAmount: 120_000_000 },
  { name: 'Quỹ dự phòng', targetAmount: 50_000_000, currentAmount: 20_000_000 },
];

describe('Money Reaction Engine', () => {
  it('celebrates income and suggests saving first', () => {
    const reaction = createMoneyReaction({
      type: 'income',
      amount: 20_000_000,
      categoryId: 'salary',
      goals,
    });

    expectEqual(reaction.tone, 'celebrate');
    expectEqual(reaction.severity, 'positive');
    expectContains(reaction.actionHint, '4.000.000 VND');
    expectContains(reaction.actionHint, 'Quỹ dự phòng');
  });

  it('nudges emotional spending toward wishlist cooldown', () => {
    const reaction = createMoneyReaction({
      type: 'expense',
      amount: 350_000,
      categoryId: 'shopping',
      goals,
    });

    expectEqual(reaction.tone, 'sarcastic');
    expectEqual(reaction.severity, 'watch');
    expectContains(reaction.text, 'bay màu');
    expectContains(reaction.actionHint, 'wishlist');
  });

  it('warns on large expenses and links the nearest goal', () => {
    const reaction = createMoneyReaction({
      type: 'expense',
      amount: 2_500_000,
      categoryId: 'home',
      goals,
    });

    expectEqual(reaction.tone, 'discipline');
    expectEqual(reaction.severity, 'warning');
    expectEqual(reaction.relatedGoalName, 'Quỹ dự phòng');
    expectContains(reaction.text, 'Quỹ dự phòng');
  });

  it('keeps normal expenses as a light nudge', () => {
    const reaction = createMoneyReaction({
      type: 'expense',
      amount: 80_000,
      categoryId: 'food',
      goals: [],
    });

    expectEqual(reaction.tone, 'nudge');
    expectEqual(reaction.severity, 'neutral');
    expectContains(reaction.actionHint, 'Cuối ngày');
  });

  it('celebrates transfers as savings behavior', () => {
    const reaction = createMoneyReaction({
      type: 'transfer',
      amount: 1_000_000,
      categoryId: 'savings',
      goals,
    });

    expectEqual(reaction.tone, 'celebrate');
    expectEqual(reaction.severity, 'positive');
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
