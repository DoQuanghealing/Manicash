/**
 * Lightweight test harness for Phase 1 three-account suites.
 * Mirrors convention used by `tests/phase1-foundation.test.ts` so we can
 * run via the existing `node + jiti` runner without needing Jest.
 */

type TestFn = () => void | Promise<void>;

const indentByDepth = ['', '  ', '    ', '      '];

let currentDepth = 0;
let failedCount = 0;
let passedCount = 0;

export function describe(name: string, fn: TestFn): void {
  console.log(`${indentByDepth[currentDepth] ?? ''}${name}`);
  currentDepth += 1;
  try {
    const result = fn();
    if (result instanceof Promise) {
      throw new Error(`describe callbacks must be synchronous (${name})`);
    }
  } finally {
    currentDepth -= 1;
  }
}

export function it(name: string, fn: TestFn): void {
  const indent = indentByDepth[currentDepth] ?? '';
  try {
    const result = fn();
    if (result instanceof Promise) {
      throw new Error(`it callbacks must be synchronous in this harness (${name})`);
    }
    passedCount += 1;
    console.log(`${indent}PASS ${name}`);
  } catch (error) {
    failedCount += 1;
    console.error(`${indent}FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

export function expectEqual<T>(actual: T, expected: T, label?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function expectDeepEqual<T>(actual: T, expected: T, label?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(
      `${label ? label + ': ' : ''}Expected ${b}, got ${a}`,
    );
  }
}

export function expectTrue(value: unknown, label?: string): void {
  if (value !== true) {
    throw new Error(`${label ? label + ': ' : ''}Expected true, got ${String(value)}`);
  }
}

export function expectFalse(value: unknown, label?: string): void {
  if (value !== false) {
    throw new Error(`${label ? label + ': ' : ''}Expected false, got ${String(value)}`);
  }
}

export function expectThrows(fn: () => unknown, pattern?: RegExp, label?: string): void {
  try {
    fn();
  } catch (error) {
    if (pattern) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!pattern.test(msg)) {
        throw new Error(
          `${label ? label + ': ' : ''}Expected error matching ${pattern}, got "${msg}"`,
        );
      }
    }
    return;
  }
  throw new Error(`${label ? label + ': ' : ''}Expected function to throw`);
}

export function summary(): void {
  console.log('');
  console.log(`──────────────────────────────────`);
  console.log(`  Passed: ${passedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`──────────────────────────────────`);
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}
