import { evaluateTrialEligibility } from '@/lib/monetization/trialEligibility';
import {
  getPlanCard,
  canAddEntity,
  getEntityLimit,
  FREE_LIMITS,
  getProSku,
  PRO_SKUS,
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
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

const NOW = new Date('2026-06-14T00:00:00.000Z').getTime();
const future = new Date(NOW + 20 * 86_400_000).toISOString();
const past = new Date(NOW - 5 * 86_400_000).toISOString();

describe('Trial eligibility (pure)', () => {
  it('allows when nothing used', () => {
    const r = evaluateTrialEligibility({ alreadyPro: false, uidTrialed: false, emailTrialed: false, deviceTrialed: false });
    expectEqual(r.allowed, true);
    expectEqual(r.reason, 'ok');
  });
  it('blocks when already Pro (highest priority)', () => {
    const r = evaluateTrialEligibility({ alreadyPro: true, uidTrialed: true, emailTrialed: true, deviceTrialed: true });
    expectEqual(r.allowed, false);
    expectEqual(r.reason, 'already_pro');
  });
  it('blocks by uid ledger', () => {
    expectEqual(evaluateTrialEligibility({ alreadyPro: false, uidTrialed: true, emailTrialed: false, deviceTrialed: false }).reason, 'uid_used');
  });
  it('blocks by email ledger (survives account deletion)', () => {
    expectEqual(evaluateTrialEligibility({ alreadyPro: false, uidTrialed: false, emailTrialed: true, deviceTrialed: false }).reason, 'email_used');
  });
  it('blocks by device ledger (reinstall same machine)', () => {
    expectEqual(evaluateTrialEligibility({ alreadyPro: false, uidTrialed: false, emailTrialed: false, deviceTrialed: true }).reason, 'device_used');
  });
});

describe('getPlanCard (monetization enforced)', () => {
  function withEnforced(fn: TestFn): void {
    process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = 'true';
    try { fn(); } finally { delete process.env.NEXT_PUBLIC_MONETIZATION_ENABLED; }
  }
  function p(o: Partial<UserProfile>): Partial<UserProfile> { return o; }

  it('free user → base card, trial not used', () => withEnforced(() => {
    const c = getPlanCard(p({ plan: 'free' }), NOW);
    expectEqual(c.active, 'base');
    expectEqual(c.trialUsed, false);
    expectEqual(c.isOnTrial, false);
  }));
  it('paid pro (payos) → pro card', () => withEnforced(() => {
    const c = getPlanCard(p({ tier: 'pro', billingProvider: 'payos', premiumExpiresAt: future }), NOW);
    expectEqual(c.active, 'pro');
    expectEqual(c.isOnTrial, false);
    expectEqual(c.daysRemaining, 20);
  }));
  it('trial pro → trial card + trialUsed locked', () => withEnforced(() => {
    const c = getPlanCard(p({ tier: 'pro', billingProvider: 'trial', premiumExpiresAt: future, trialUsedAt: past }), NOW);
    expectEqual(c.active, 'trial');
    expectEqual(c.isOnTrial, true);
    expectEqual(c.trialUsed, true);
  }));
  it('expired trial → base card but trial still locked', () => withEnforced(() => {
    const c = getPlanCard(p({ tier: 'pro', billingProvider: 'trial', premiumExpiresAt: past, trialUsedAt: past }), NOW);
    expectEqual(c.active, 'base');
    expectEqual(c.trialUsed, true);
  }));
});

describe('Free entity limits', () => {
  it('free caps wishlist=3, bigGoal=1, earningTask=3', () => {
    expectEqual(FREE_LIMITS.wishlist, 3);
    expectEqual(canAddEntity('wishlist', 2, 'free'), true);
    expectEqual(canAddEntity('wishlist', 3, 'free'), false);
    expectEqual(canAddEntity('bigGoal', 0, 'free'), true);
    expectEqual(canAddEntity('bigGoal', 1, 'free'), false);
    expectEqual(canAddEntity('earningTask', 3, 'free'), false);
  });
  it('pro is unlimited', () => {
    expectEqual(getEntityLimit('wishlist', 'pro'), Number.POSITIVE_INFINITY);
    expectEqual(canAddEntity('bigGoal', 999, 'pro'), true);
  });
});

describe('PRO_SKUS', () => {
  it('has 3 kỳ hạn with correct amounts', () => {
    expectEqual(PRO_SKUS.monthly.amount, 49_000);
    expectEqual(PRO_SKUS.half_year.amount, 280_000);
    expectEqual(PRO_SKUS.yearly.amount, 539_000);
    expectEqual(PRO_SKUS.yearly.periodDays, 365);
  });
  it('getProSku validates id', () => {
    expectEqual(getProSku('monthly')?.amount, 49_000);
    expectEqual(getProSku('bogus'), null);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
