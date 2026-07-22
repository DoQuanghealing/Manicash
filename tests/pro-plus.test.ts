/* ═══ Pro Plus (T6) — quota profile + trần fix cứng + tier resolution ═══
 * Chốt: pro_plus mở cấp 3, quota rộng, trần VND 30k đảm bảo margin; free/pro không đổi.
 */
import {
  getUserMonthlyCostCeilingVnd,
  evaluateUserCostCeiling,
} from '@/lib/aiMoneyChat/llm/aiCostCore';
import { resolveAiMoneyPlan, getMonthlyCreditLimit } from '@/lib/aiMoneyChat/quotaCore';
import { getAiQuotaLimits } from '@/lib/aiMoneyChat/aiQuotaPolicy';
import {
  resolveTier,
  isProPlusActive,
  PRO_PLUS_PRICE_VND,
  PRO_SKUS,
  tierForSku,
  tierForProductId,
  entitlementFieldsForTier,
  getPlanCard,
} from '@/lib/monetization/entitlement';
import {
  billingLevelCap,
  resolveButlerLevel,
  evaluateFeatureTaste,
  describeTaste,
  tasteQuotaFor,
} from '@/lib/monetization/butlerFeatures';
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

console.log('\nĐường cấp quyền — SKU quyết định tier (bug: mua Pro Plus vẫn ra Pro)');

it('SKU pro_plus_monthly cấp pro_plus; SKU Pro cấp pro', () => {
  eq(tierForSku('pro_plus_monthly'), 'pro_plus');
  eq(tierForSku('monthly'), 'pro');
  eq(tierForSku('half_year'), 'pro');
  eq(tierForSku('yearly'), 'pro');
  eq(PRO_SKUS.pro_plus_monthly.amount, 99_000, 'giá SKU khớp 99k');
});

it('SKU lạ/thiếu → pro (fail-safe: KHÔNG tự phát nhầm quyền cấp 3)', () => {
  eq(tierForSku('khong-ton-tai'), 'pro');
  eq(tierForSku(null), 'pro');
  eq(tierForSku(undefined), 'pro');
  eq(tierForProductId('san-pham-la'), 'pro');
});

it('tra theo productId của store (Google Play / Apple)', () => {
  eq(tierForProductId(PRO_SKUS.pro_plus_monthly.productId), 'pro_plus');
  eq(tierForProductId(PRO_SKUS.monthly.productId), 'pro');
});

it('entitlementFieldsForTier: hình dạng field ghi lên users/{uid}', () => {
  const plus = entitlementFieldsForTier('pro_plus');
  eq(plus.tier, 'pro_plus');
  eq(plus.plan, 'premium_plus');
  eq(plus.isPremium, true);
  const pro = entitlementFieldsForTier('pro');
  eq(pro.tier, 'pro');
  eq(pro.plan, 'premium');
});

it('HỒI QUY: mua SKU 99k → ghi field → resolveTier → MỞ ĐƯỢC cấp 3', () => {
  const prevMon = process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
  const prevEnf = process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
  process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = 'true';
  process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = 'true';
  try {
    // Mô phỏng đúng chuỗi thật: intent.plan='pro_plus_monthly' → tier → field → profile.
    const granted = tierForSku('pro_plus_monthly');
    const profile = { ...entitlementFieldsForTier(granted), premiumExpiresAt: future } as Partial<UserProfile>;

    eq(resolveTier(profile), 'pro_plus', 'profile sau khi cấp phải ra pro_plus');
    eq(billingLevelCap(resolveTier(profile)), 3, 'mở được cấp quản gia 3');
    eq(resolveButlerLevel({ butlerTier: 'sovereign', billingTier: resolveTier(profile) }), 3);

    // Đối chứng: mua gói Pro thường vẫn chỉ cấp 2.
    const proProfile = { ...entitlementFieldsForTier(tierForSku('monthly')), premiumExpiresAt: future } as Partial<UserProfile>;
    eq(billingLevelCap(resolveTier(proProfile)), 2, 'Pro thường vẫn cấp 2');
  } finally {
    if (prevMon === undefined) delete process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
    else process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = prevMon;
    if (prevEnf === undefined) delete process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED;
    else process.env.NEXT_PUBLIC_BUTLER_BILLING_ENFORCED = prevEnf;
  }
});

it('trang giá: getPlanCard đánh dấu đúng thẻ đang dùng', () => {
  const prev = process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
  process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = 'true';
  try {
    const plus = { ...entitlementFieldsForTier('pro_plus'), premiumExpiresAt: future, billingProvider: 'payos' } as Partial<UserProfile>;
    eq(getPlanCard(plus).active, 'pro_plus', 'Pro Plus → thẻ Phú Vương');

    const pro = { ...entitlementFieldsForTier('pro'), premiumExpiresAt: future, billingProvider: 'payos' } as Partial<UserProfile>;
    eq(getPlanCard(pro).active, 'pro', 'Pro → thẻ Pro');

    // Trial vẫn là thẻ trial dù tier là pro.
    const trial = { ...entitlementFieldsForTier('pro'), premiumExpiresAt: future, billingProvider: 'trial' } as Partial<UserProfile>;
    eq(getPlanCard(trial).active, 'trial', 'trial → thẻ dùng thử');

    eq(getPlanCard(null).active, 'base', 'chưa trả tiền → Base');
    eq(getPlanCard(plus).skus.pro_plus_monthly.amount, 99_000, 'SKU hiện trên trang giá');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_MONETIZATION_ENABLED;
    else process.env.NEXT_PUBLIC_MONETIZATION_ENABLED = prev;
  }
});

console.log('\nQuota nếm thử (taste) — Free 4 lượt sâu · Pro 5 lượt thẩm định');

it('Pro (cấp 2) nếm task.eval 5 lượt/tháng, hết → mời lên Phú Vương', () => {
  const fresh = evaluateFeatureTaste(2, 'task.eval', 0);
  ok(fresh.allowed && fresh.isTaste, 'còn suất → cho dùng, đánh dấu nếm');
  eq(fresh.remainingTaste, 5);
  ok(describeTaste(fresh).includes('5/5'), 'nói thẳng số lượt');

  const used3 = evaluateFeatureTaste(2, 'task.eval', 3);
  eq(used3.remainingTaste, 2);

  const done = evaluateFeatureTaste(2, 'task.eval', 5);
  ok(!done.allowed && done.isTaste, 'hết suất → chặn');
  ok(describeTaste(done).includes('Nâng lên Phú Vương'), 'CTA nâng cấp');
});

it('Phú Vương (cấp 3) dùng task.eval thoải mái — KHÔNG tốn suất nếm', () => {
  const d = evaluateFeatureTaste(3, 'task.eval', 99);
  ok(d.allowed, 'đủ cấp → luôn được');
  eq(d.isTaste, false, 'không phải nếm');
  eq(describeTaste(d), '', 'không hiện thông báo nếm');
});

it('Free (cấp 1) KHÔNG được nếm task.eval (kém 2 cấp) → mời nâng cấp thẳng', () => {
  const d = evaluateFeatureTaste(1, 'task.eval', 0);
  ok(!d.allowed, 'chặn');
  eq(d.isTaste, false, 'không tính là nếm');
  ok(describeTaste(d).includes('dành cho Phú Vương'), 'CTA đúng');
});

it('Free (cấp 1) nếm tư vấn sâu (chat.deep) 4 lượt/tháng', () => {
  const fresh = evaluateFeatureTaste(1, 'chat.deep', 0);
  ok(fresh.allowed && fresh.isTaste, 'được nếm');
  eq(fresh.remainingTaste, 4);
  eq(evaluateFeatureTaste(1, 'chat.deep', 4).allowed, false, 'hết 4 lượt → chặn');
  ok(describeTaste(evaluateFeatureTaste(1, 'chat.deep', 4), 'Thông thái').includes('Thông thái'), 'CTA lên cấp 2');
});

it('Pro (cấp 2) dùng chat.deep thoải mái (đủ cấp)', () => {
  const d = evaluateFeatureTaste(2, 'chat.deep', 99);
  ok(d.allowed && !d.isTaste, 'đủ cấp');
});

it('feature không có suất nếm → chặn thẳng khi thiếu cấp', () => {
  const d = evaluateFeatureTaste(1, 'dna.oracle', 0);
  ok(!d.allowed && !d.isTaste, 'không nếm được');
  eq(tasteQuotaFor('dna.oracle'), 0);
});

console.log('\nPro Plus test suite complete.');
