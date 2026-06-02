import { sanitizeEventParams } from '@/lib/analytics/events';

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

describe('Analytics - sanitizeEventParams', () => {
  it('keeps primitives and drops null/undefined', () => {
    const out = sanitizeEventParams({ a: 'x', b: 5, c: true, d: null, e: undefined });
    expectEqual(out.a, 'x');
    expectEqual(out.b, 5);
    expectEqual(out.c, true);
    expectEqual('d' in out, false);
    expectEqual('e' in out, false);
  });

  it('trims long strings to 100 chars', () => {
    const long = 'a'.repeat(250);
    const out = sanitizeEventParams({ note: long });
    expectEqual((out.note as string).length, 100);
  });

  it('drops non-finite numbers and objects', () => {
    const out = sanitizeEventParams({
      bad: Number.NaN,
      inf: Number.POSITIVE_INFINITY,
      // @ts-expect-error testing runtime guard
      obj: { nested: true },
    });
    expectEqual('bad' in out, false);
    expectEqual('inf' in out, false);
    expectEqual('obj' in out, false);
  });

  it('returns empty object for no params', () => {
    expectEqual(Object.keys(sanitizeEventParams()).length, 0);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
