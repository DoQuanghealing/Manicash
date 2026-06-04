import {
  resolveTier,
  isProActive,
  getProStatus,
  computeProExpiry,
} from '@/lib/monetization/entitlement';
import type { UserProfile } from '@/types/user';

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

const NOW = new Date('2026-06-03T00:00:00.000Z').getTime();
const future = new Date(NOW + 10 * 86_400_000).toISOString();
const past = new Date(NOW - 10 * 86_400_000).toISOString();

function profile(overrides: Partial<UserProfile>): Partial<UserProfile> {
  return overrides;
}

describe('Entitlement - kill-switch OFF (default demo)', () => {
  // NEXT_PUBLIC_MONETIZATION_ENABLED is unset in test env → everyone Pro.
  it('treats everyone as Pro when monetization disabled', () => {
    expectEqual(resolveTier(null, NOW), 'pro');
    expectEqual(resolveTier(profile({ plan: 'free' }), NOW), 'pro');
    expectEqual(isProActive(profile({ tier: 'free' }), NOW), true);
  });
});

describe('Entitlement - logic with explicit enable', () => {
  // Simulate enabled by toggling env for the duration of this block.
  it('free profile resolves to free when enabled', () => {
    process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = 'true';
    try {
      expectEqual(resolveTier(null, NOW), 'free');
      expectEqual(resolveTier(profile({ plan: 'free' }), NOW), 'free');
      expectEqual(resolveTier(profile({ tier: 'pro', premiumExpiresAt: future }), NOW), 'pro');
      expectEqual(resolveTier(profile({ isPremium: true, premiumExpiresAt: past }), NOW), 'free');
      expectEqual(resolveTier(profile({ tier: 'pro', premiumExpiresAt: null }), NOW), 'pro');
    } finally {
      delete process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
    }
  });

  it('getProStatus reports expiry and days remaining', () => {
    process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = 'true';
    try {
      const active = getProStatus(profile({ tier: 'pro', premiumExpiresAt: future }), NOW);
      expectEqual(active.isPro, true);
      expectEqual(active.daysRemaining, 10);
      expectEqual(active.enforced, true);

      const expired = getProStatus(profile({ isPremium: true, premiumExpiresAt: past }), NOW);
      expectEqual(expired.isPro, false);
      expectEqual(expired.isExpired, true);
    } finally {
      delete process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
    }
  });
});

describe('Entitlement - computeProExpiry', () => {
  it('stacks onto remaining time when still active', () => {
    const result = computeProExpiry(future, 30, NOW);
    const expected = new Date(new Date(future).getTime() + 30 * 86_400_000).toISOString();
    expectEqual(result, expected);
  });

  it('starts from now when expired or missing', () => {
    const fromExpired = computeProExpiry(past, 30, NOW);
    const expected = new Date(NOW + 30 * 86_400_000).toISOString();
    expectEqual(fromExpired, expected);
    expectEqual(computeProExpiry(null, 30, NOW), expected);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
