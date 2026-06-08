/* TDD — moneyBrain/normalize.ts (category aliases) */
import { CATEGORY_ALIASES, normalizeCategoryId } from '@/lib/moneyBrain/normalize';

type TestFn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
function eq<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

describe('normalizeCategoryId');
it('entertain -> entertainment', () => { eq(normalizeCategoryId('entertain'), 'entertainment'); });
it('food giữ nguyên', () => { eq(normalizeCategoryId('food'), 'food'); });
it('undefined giữ nguyên undefined', () => { eq(normalizeCategoryId(undefined), undefined); });
it('alias map có entertain', () => { eq(CATEGORY_ALIASES.entertain, 'entertainment'); });

console.log('\nmoneyBrain normalize test complete.');
