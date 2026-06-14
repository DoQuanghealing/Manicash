/* AI Quota Policy — free/pro per-feature daily+monthly limits */
import {
  evaluateAiQuota,
  getAiQuotaLimits,
  resolveAiTier,
  describeAiQuota,
  DEFAULT_AI_QUOTA,
} from '@/lib/aiMoneyChat/aiQuotaPolicy';
import type { UserProfile } from '@/types/user';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

function main() {
  console.log('\naiQuotaPolicy');

  it('limits match defaults (free 1/1, pro report 3/60, pro chat 20/300)', () => {
    eq(getAiQuotaLimits('free', 'report').perDay, 1);
    eq(getAiQuotaLimits('free', 'chat').perDay, 1);
    eq(getAiQuotaLimits('pro', 'report').perDay, 3);
    eq(getAiQuotaLimits('pro', 'report').perMonth, 60);
    eq(getAiQuotaLimits('pro', 'chat').perDay, 20);
    eq(getAiQuotaLimits('pro', 'chat').perMonth, 300);
    eq(DEFAULT_AI_QUOTA.free.report.perDay, 1);
  });

  it('free report: first of day allowed, second blocked (daily)', () => {
    const first = evaluateAiQuota({ tier: 'free', feature: 'report', usage: { usedToday: 0, usedThisMonth: 0 } });
    ok(first.allowed, 'first allowed');
    eq(first.remainingToday, 1, 'remaining 1 before use');

    const second = evaluateAiQuota({ tier: 'free', feature: 'report', usage: { usedToday: 1, usedThisMonth: 1 } });
    ok(!second.allowed, 'second blocked');
    eq(second.reason, 'daily_exceeded', 'daily');
    eq(second.remainingToday, 0, 'no remaining today');
  });

  it('free chat: same 1/day rule, separate pool', () => {
    const r = evaluateAiQuota({ tier: 'free', feature: 'chat', usage: { usedToday: 1, usedThisMonth: 1 } });
    ok(!r.allowed, 'blocked after 1');
    eq(r.reason, 'daily_exceeded');
  });

  it('pro report: 3/day allowed up to 3rd, 4th blocked', () => {
    ok(evaluateAiQuota({ tier: 'pro', feature: 'report', usage: { usedToday: 2, usedThisMonth: 10 } }).allowed, '3rd allowed');
    const fourth = evaluateAiQuota({ tier: 'pro', feature: 'report', usage: { usedToday: 3, usedThisMonth: 10 } });
    ok(!fourth.allowed, '4th blocked');
    eq(fourth.reason, 'daily_exceeded');
    eq(fourth.remainingToday, 0);
  });

  it('pro report: monthly cap (60) blocks even with daily room', () => {
    const r = evaluateAiQuota({ tier: 'pro', feature: 'report', usage: { usedToday: 0, usedThisMonth: 60 } });
    ok(!r.allowed, 'blocked at monthly cap');
    eq(r.reason, 'monthly_exceeded', 'monthly precedence');
    eq(r.remainingThisMonth, 0);
  });

  it('pro chat: 20/day, 300/month', () => {
    ok(evaluateAiQuota({ tier: 'pro', feature: 'chat', usage: { usedToday: 19, usedThisMonth: 100 } }).allowed, '20th allowed');
    ok(!evaluateAiQuota({ tier: 'pro', feature: 'chat', usage: { usedToday: 20, usedThisMonth: 100 } }).allowed, '21st blocked daily');
    const monthly = evaluateAiQuota({ tier: 'pro', feature: 'chat', usage: { usedToday: 0, usedThisMonth: 300 } });
    ok(!monthly.allowed, 'monthly blocked');
    eq(monthly.reason, 'monthly_exceeded');
  });

  it('monthly_exceeded takes precedence over daily_exceeded', () => {
    const r = evaluateAiQuota({ tier: 'pro', feature: 'report', usage: { usedToday: 3, usedThisMonth: 60 } });
    eq(r.reason, 'monthly_exceeded', 'monthly wins when both exhausted');
  });

  it('remaining counts are clamped at 0 (never negative)', () => {
    const r = evaluateAiQuota({ tier: 'free', feature: 'report', usage: { usedToday: 5, usedThisMonth: 99 } });
    eq(r.remainingToday, 0);
    eq(r.remainingThisMonth, 0);
  });

  it('resolveAiTier: free profile → free, premium → pro', () => {
    const freeUser = { uid: 'u', tier: 'free', plan: 'free', isPremium: false } as Partial<UserProfile>;
    eq(resolveAiTier(freeUser), 'free');
    const proUser = { uid: 'u', tier: 'pro', plan: 'premium', isPremium: true, premiumExpiresAt: null } as Partial<UserProfile>;
    eq(resolveAiTier(proUser), 'pro');
    eq(resolveAiTier(null), 'free', 'null → free');
  });

  it('describeAiQuota: ok / daily / monthly messages', () => {
    const okMsg = describeAiQuota(evaluateAiQuota({ tier: 'pro', feature: 'report', usage: { usedToday: 1, usedThisMonth: 5 } }));
    ok(okMsg.includes('Còn') && okMsg.includes('hôm nay'), 'ok message shows remaining');
    const daily = describeAiQuota(evaluateAiQuota({ tier: 'free', feature: 'report', usage: { usedToday: 1, usedThisMonth: 1 } }));
    ok(daily.includes('Hết lượt') && daily.includes('hôm nay'), 'daily message');
    const monthly = describeAiQuota(evaluateAiQuota({ tier: 'pro', feature: 'chat', usage: { usedToday: 0, usedThisMonth: 300 } }));
    ok(monthly.includes('hết') || monthly.includes('hết') || monthly.includes('tháng này'), 'monthly message mentions month');
  });

  console.log('\naiQuotaPolicy test complete.');
}

main();
