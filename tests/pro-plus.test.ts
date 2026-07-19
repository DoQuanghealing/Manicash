/* ═══ Pro Plus (T6) — quota profile + trần fix cứng + tier resolution ═══
 * Chốt: pro_plus mở cấp 3, quota rộng, trần VND 30k đảm bảo margin; free/pro không đổi.
 */
import {
  getUserMonthlyCostCeilingVnd,
  evaluateUserCostCeiling,
} from '@/lib/aiMoneyChat/llm/aiCostCore';
import { resolveAiMoneyPlan, getMonthlyCreditLimit } from '@/lib/aiMoneyChat/quotaCore';
import { getAiQuotaLimits } from '@/lib/aiMoneyChat/aiQuotaPolicy';
import { resolveTier, isProPlusActive, PRO_PLUS_PRICE_VND } from '@/lib/monetization/entitlement';
import { billingLevelCap, resolveButlerLevel } from '@/lib/monetization/butlerFeatures';
import type { UserProfile } from '@/types/user';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, msg?: string): void { if (!v) throw new Error(msg ?? 'expected true'); }
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

console.log('\nPro Plus — trần chi phí fix cứng');

it('trần VND: pro_plus 30k · pro 15k · free vô hạn', () => {
  eq(getUserMonthlyCostCeilingVnd('pro_plus'), 30_000);
  eq(getUserMonthlyCostCeilingVnd('pro'), 15_000);
  eq(getUserMonthlyCostCeilingVnd('free'), Number.POSITIVE_INFINITY);
});

it('evaluateUserCostCeiling: dưới trần allow, chạm/vượt deny; free luôn allow', () => {
  ok(evaluateUserCostCeiling(29_999, 'pro_plus').allowed, 'dưới 30k');
  ok(!evaluateUserCostCeiling(30_000, 'pro_plus').allowed, 'chạm 30k → deny');
  ok(!evaluateUserCostCeiling(50_000, 'pro_plus').allowed, 'vượt → deny');
  ok(evaluateUserCostCeiling(9_999_999, 'free').allowed, 'free vô hạn');
});

console.log('\nPro Plus — quota profile');

it('quota rộng: chat 80/ngày·1200/tháng · report 15/ngày·300/tháng', () => {
  eq(getAiQuotaLimits('pro_plus', 'chat').perDay, 80);
  eq(getAiQuotaLimits('pro_plus', 'chat').perMonth, 1200);
  eq(getAiQuotaLimits('pro_plus', 'report').perDay, 15);
  eq(getAiQuotaLimits('pro_plus', 'report').perMonth, 300);
});

it('credit tháng pro_plus = 4000 (chứa đủ 1200 chat + 300 report)', () => {
  eq(getMonthlyCreditLimit('pro_plus'), 4000);
  ok(getMonthlyCreditLimit('pro_plus') > getMonthlyCreditLimit('pro'), 'cao hơn pro');
});

console.log('\nPro Plus — tier resolution');

it('resolveAiMoneyPlan: tier pro_plus / plan premium_plus → pro_plus; pro giữ pro', () => {
  eq(resolveAiMoneyPlan({ tier: 'pro_plus', premiumExpiresAt: future } as Partial<UserProfile>), 'pro_plus');
  eq(resolveAiMoneyPlan({ plan: 'premium_plus', premiumExpiresAt: future } as Partial<UserProfile>), 'pro_plus');
  eq(resolveAiMoneyPlan({ tier: 'pro', premiumExpiresAt: future } as Partial<UserProfile>), 'pro');
  eq(resolveAiMoneyPlan({ tier: 'pro_plus', premiumExpiresAt: past } as Partial<UserProfile>), 'free', 'hết hạn → free');
});

it('entitlement: pro_plus khi bật monetization; giá 99k', () => {
  eq(PRO_PLUS_PRICE_VND, 99_000);
  const prev = process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
  process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = 'true';
  try {
    eq(resolveTier({ tier: 'pro_plus', premiumExpiresAt: future } as Partial<UserProfile>), 'pro_plus');
    ok(isProPlusActive({ plan: 'premium_plus', premiumExpiresAt: future } as Partial<UserProfile>), 'isProPlusActive');
    eq(resolveTier({ tier: 'pro', premiumExpiresAt: future } as Partial<UserProfile>), 'pro', 'pro vẫn pro');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
    else process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = prev;
  }
});

console.log('\nPro Plus — butler cấp 3');

it('billingLevelCap: khi enforce, pro_plus→3, pro→2, free→1', () => {
  const prev = process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
  process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = 'true';
  try {
    eq(billingLevelCap('pro_plus'), 3);
    eq(billingLevelCap('pro'), 2);
    eq(billingLevelCap('free'), 1);
    eq(billingLevelCap(undefined), 1, 'fail-closed');
    // Sovereign persona + billing pro_plus → cấp 3 hiệu lực.
    eq(resolveButlerLevel({ butlerTier: 'sovereign', billingTier: 'pro_plus' }), 3);
    eq(resolveButlerLevel({ butlerTier: 'sovereign', billingTier: 'pro' }), 2, 'pro cap 2 dù persona sovereign');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
    else process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = prev;
  }
});

console.log('\nPro Plus test suite complete.');
