/**
 * Tests cho src/lib/featureFlags.ts
 *
 * Acceptance: LA1 (flag OFF behavior), LA10 (flag ON/OFF test coverage)
 *
 * Strategy: Test pure `readFlag(envValue)` semantics directly. FLAGS object
 * itself is a thin wrapper over readFlag + process.env lookups; trusted by
 * inspection. Avoids cache-busting tricks that fight jiti's module cache.
 */

import { FLAGS, isFeatureEnabled, readFlag, type FeatureFlag } from '@/lib/featureFlags';
import { describe, expectEqual, expectFalse, expectTrue, it } from './harness';

describe('readFlag — exact string match semantics', () => {
  it('undefined → false (default safe)', () => {
    expectFalse(readFlag(undefined));
  });

  it('empty string → false', () => {
    expectFalse(readFlag(''));
  });

  it('"true" (exact) → true', () => {
    expectTrue(readFlag('true'));
  });

  it('"TRUE" (uppercase) → false', () => {
    expectFalse(readFlag('TRUE'));
  });

  it('"True" (mixed) → false', () => {
    expectFalse(readFlag('True'));
  });

  it('"1" → false', () => {
    expectFalse(readFlag('1'));
  });

  it('"yes" → false', () => {
    expectFalse(readFlag('yes'));
  });

  it('"false" → false', () => {
    expectFalse(readFlag('false'));
  });

  it('"true " (trailing space) → false', () => {
    expectFalse(readFlag('true '));
  });

  it('" true" (leading space) → false', () => {
    expectFalse(readFlag(' true'));
  });
});

describe('FLAGS object shape', () => {
  it('exposes exactly 3 flag keys', () => {
    const keys = Object.keys(FLAGS).sort();
    expectEqual(keys.length, 3);
    expectEqual(keys[0], 'NEW_ALLOCATION_FLOW');
    expectEqual(keys[1], 'NEW_OVERVIEW_UI');
    expectEqual(keys[2], 'NEW_THREE_ACCOUNT_MODEL');
  });

  it('all flag values are boolean', () => {
    const allBool = (Object.values(FLAGS) as unknown[]).every((v) => typeof v === 'boolean');
    expectTrue(allBool);
  });
});

describe('isFeatureEnabled helper', () => {
  it('returns boolean for known flag', () => {
    const result = isFeatureEnabled('NEW_THREE_ACCOUNT_MODEL');
    expectTrue(typeof result === 'boolean');
  });

  it('mirrors FLAGS[flag] value', () => {
    const flags: FeatureFlag[] = [
      'NEW_THREE_ACCOUNT_MODEL',
      'NEW_OVERVIEW_UI',
      'NEW_ALLOCATION_FLOW',
    ];
    for (const flag of flags) {
      expectEqual(isFeatureEnabled(flag), FLAGS[flag]);
    }
  });
});
