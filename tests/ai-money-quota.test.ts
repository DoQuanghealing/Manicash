import {
  evaluateQuota,
  getCurrentAiMoneyMonthKey,
  getMonthlyCreditLimit,
  resolveAiMoneyPlan,
  type AiMoneyQuotaConfig,
} from '@/lib/aiMoneyChat/quotaCore';

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

const config: AiMoneyQuotaConfig = {
  freeMonthlyCredits: 0,
  proMonthlyCredits: 1500,
  hardMonthlyCredits: 1200,
  fallbackParseCredits: 1,
  cfoNarrationCredits: 8,
};

describe('AI Money Chat quota', () => {
  it('uses UTC month key', () => {
    expectEqual(getCurrentAiMoneyMonthKey(new Date('2026-06-02T12:00:00Z')), '2026-06');
  });

  it('resolves premium/pro profiles as pro while valid', () => {
    const now = new Date('2026-06-02T00:00:00Z');
    expectEqual(resolveAiMoneyPlan({ tier: 'pro' }, now), 'pro');
    expectEqual(resolveAiMoneyPlan({ plan: 'premium', premiumExpiresAt: '2026-07-01T00:00:00Z' }, now), 'pro');
    expectEqual(resolveAiMoneyPlan({ isPremium: true, premiumExpiresAt: '2026-01-01T00:00:00Z' }, now), 'free');
  });

  it('applies hard cap even when pro limit is higher', () => {
    expectEqual(getMonthlyCreditLimit('pro', config), 1200);
    expectEqual(getMonthlyCreditLimit('free', config), 0);
  });

  it('blocks free users by default', () => {
    const quota = evaluateQuota({
      uid: 'u1',
      monthKey: '2026-06',
      plan: 'free',
      usedCredits: 0,
      chargeCredits: 1,
    }, config);

    expectEqual(quota.allowed, false);
    expectEqual(quota.reason, 'AI fallback is a Pro feature.');
  });

  it('allows pro users until monthly hard cap', () => {
    const allowed = evaluateQuota({
      uid: 'u1',
      monthKey: '2026-06',
      plan: 'pro',
      usedCredits: 1199,
      chargeCredits: 1,
    }, config);
    const blocked = evaluateQuota({
      uid: 'u1',
      monthKey: '2026-06',
      plan: 'pro',
      usedCredits: 1200,
      chargeCredits: 1,
    }, config);

    expectEqual(allowed.allowed, true);
    expectEqual(allowed.remainingCredits, 1);
    expectEqual(blocked.allowed, false);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
