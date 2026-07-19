/* ═══ P0 Monetization — Entitlement core ═══
 * Single source of truth for Free vs Pro on the CLIENT. Mirrors the server-side
 * resolveAiMoneyPlan logic (quotaCore.ts) so client UI and server quota agree.
 *
 * Kill-switch: NEXT_PUBLIC_MONETIZATION_ENABLED. When unset/"false", everyone is
 * treated as Pro (current demo behaviour preserved) so we can ship gating code
 * without locking out users before billing is live. Flip to "true" at launch.
 */

import type { UserProfile } from '@/types/user';

export type Tier = 'free' | 'pro' | 'pro_plus';

/** Pro plan commercial constants (VND). Gói tháng là mặc định. */
export const PRO_PRICE_VND = 49_000;
export const PRO_PERIOD_DAYS = 30;
export const PRO_PRODUCT_ID = 'manicash_pro_monthly';

/** Pro Plus (Phú Vương · PV-5) — mở cấp quản gia 3. Xem docs/PRO_PLUS_ECONOMICS.md. */
export const PRO_PLUS_PRICE_VND = 99_000;
export const PRO_PLUS_PRODUCT_ID = 'manicash_pro_plus_monthly';

/** SKU Pro theo kỳ hạn. amount = VND (số nguyên), periodDays = số ngày cấp. */
/** SKU Pro theo KỲ HẠN (dùng cho bộ chọn kỳ hạn trên trang giá). */
export type ProPeriodSkuId = 'monthly' | 'half_year' | 'yearly';
/** Toàn bộ SKU bán được (gồm sản phẩm riêng Pro Plus). */
export type ProSkuId = ProPeriodSkuId | 'pro_plus_monthly';

export interface ProSku {
  amount: number;
  periodDays: number;
  productId: string;
  /** Tier được cấp khi mua SKU này. Bỏ trống = 'pro'. */
  grantsTier?: Tier;
}

export const PRO_SKUS: Record<ProSkuId, ProSku> = {
  monthly: { amount: 49_000, periodDays: 30, productId: 'manicash_pro_monthly' },
  half_year: { amount: 280_000, periodDays: 180, productId: 'manicash_pro_6month' },
  yearly: { amount: 539_000, periodDays: 365, productId: 'manicash_pro_yearly' },
  // PV-5 — Phú Vương: SKU DUY NHẤT cấp pro_plus (mở cấp quản gia 3).
  pro_plus_monthly: {
    amount: PRO_PLUS_PRICE_VND,
    periodDays: 30,
    productId: PRO_PLUS_PRODUCT_ID,
    grantsTier: 'pro_plus',
  },
};

/** Lấy SKU theo id, trả null nếu không hợp lệ (dùng để validate server-side). */
export function getProSku(id: string): ProSku | null {
  return (PRO_SKUS as Record<string, ProSku>)[id] ?? null;
}

/**
 * Tier mà một SKU cấp. SKU lạ/thiếu → 'pro' (fail-safe: KHÔNG bao giờ tự nâng lên
 * pro_plus khi không chắc — thà cấp thấp rồi hỗ trợ tay còn hơn phát nhầm quyền).
 */
export type PaidTier = Exclude<Tier, 'free'>;

function toPaidTier(t: Tier | undefined): PaidTier {
  return t === 'pro_plus' ? 'pro_plus' : 'pro';
}

export function tierForSku(skuId: string | null | undefined): PaidTier {
  if (!skuId) return 'pro';
  return toPaidTier(getProSku(skuId)?.grantsTier);
}

/** Như tierForSku nhưng tra theo productId của store (Google Play / Apple IAP). */
export function tierForProductId(productId: string | null | undefined): PaidTier {
  if (!productId) return 'pro';
  return toPaidTier(Object.values(PRO_SKUS).find((s) => s.productId === productId)?.grantsTier);
}

/**
 * Bộ field entitlement ghi lên users/{uid} theo tier. NGUỒN DUY NHẤT để mọi đường cấp
 * (PayOS webhook, verify route, admin) ghi CÙNG một hình dạng — tránh lệch như bug
 * "mua Pro Plus vẫn ra Pro".
 */
export function entitlementFieldsForTier(tier: Tier): {
  tier: Exclude<Tier, 'free'>;
  plan: 'premium' | 'premium_plus';
  isPremium: true;
} {
  return tier === 'pro_plus'
    ? { tier: 'pro_plus', plan: 'premium_plus', isPremium: true }
    : { tier: 'pro', plan: 'premium', isPremium: true };
}

/** Giới hạn quyền dùng bản Free (Pro = không giới hạn). Chặn mềm → mở modal nâng cấp. */
export type LimitedFeature = 'wishlist' | 'bigGoal' | 'earningTask';

export const FREE_LIMITS: Record<LimitedFeature, number> = {
  wishlist: 3,
  bigGoal: 1,
  earningTask: 3,
};

/** Số lượng tối đa của 1 feature theo tier (Pro/Pro Plus → Infinity). */
export function getEntityLimit(feature: LimitedFeature, tier: Tier): number {
  return tier === 'free' ? FREE_LIMITS[feature] : Number.POSITIVE_INFINITY;
}

/** Còn thêm được entity nữa không (currentCount = số đang có). */
export function canAddEntity(feature: LimitedFeature, currentCount: number, tier: Tier): boolean {
  return currentCount < getEntityLimit(feature, tier);
}

export interface ProFeature {
  id: string;
  title: string;
  description: string;
}

/** Features unlocked by Pro — shown on the paywall. */
export const PRO_FEATURES: ProFeature[] = [
  { id: 'ai_chat', title: 'AI Money Chat không giới hạn', description: 'Nhập giao dịch bằng lời nói, AI tự phân loại khi parser local chưa chắc.' },
  { id: 'cfo_narration', title: 'CFO Lord Diamond viết riêng', description: 'Nhận xét tài chính cá nhân hoá mỗi tháng, không chỉ mẫu cố định.' },
  { id: 'sms_webhook', title: 'Tự động ghi giao dịch từ SMS', description: 'Kết nối SMS ngân hàng để ghi sổ tự động, không cần nhập tay.' },
  { id: 'priority', title: 'Báo cáo & tính năng mới ưu tiên', description: 'Truy cập sớm các tính năng Pro tiếp theo.' },
];

export interface ProStatus {
  tier: Tier;
  isPro: boolean;
  /** ISO expiry, or null when no expiry is set. */
  expiresAt: string | null;
  /** True when a premium flag exists but the expiry is in the past. */
  isExpired: boolean;
  /** Whole days until expiry (0 when expired or no expiry). */
  daysRemaining: number;
  /** True when the global monetization kill-switch is on. */
  enforced: boolean;
}

/** Whether real monetization gating is active. Off by default (demo-safe). */
export function isMonetizationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MONETIZATION_ENABLED === 'true';
}

export function hasPremiumFlag(profile: Partial<UserProfile>): boolean {
  return (
    profile.tier === 'pro' || profile.tier === 'pro_plus' ||
    profile.plan === 'premium' || profile.plan === 'premium_plus' ||
    profile.isPremium === true
  );
}

/** Có phải Pro Plus (Phú Vương) không — dựa trên flag profile. */
export function hasProPlusFlag(profile: Partial<UserProfile>): boolean {
  return profile.tier === 'pro_plus' || profile.plan === 'premium_plus';
}

function expiryTimestamp(profile: Partial<UserProfile>): number | null {
  if (!profile.premiumExpiresAt) return null;
  const ts = new Date(profile.premiumExpiresAt).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/**
 * Resolve the effective tier. With monetization disabled, everyone is Pro (demo).
 * With it enabled, Pro requires a premium flag AND a non-expired subscription.
 *
 * Lưu ý: premiumExpiresAt === null được coi là Pro-vĩnh-viễn (chủ ý — demo/seed/
 * admin permanent). Bất biến "Pro luôn có hạn" được giữ ở ĐƯỜNG CẤP: grantProToUser
 * và grantTrialAtomic luôn set premiumExpiresAt. Mirror logic ở quotaCore.resolveAiMoneyPlan.
 */
export function resolveTier(profile: Partial<UserProfile> | null | undefined, now = Date.now()): Tier {
  if (!isMonetizationEnabled()) return 'pro';
  if (!profile) return 'free';

  if (!hasPremiumFlag(profile)) return 'free';

  const expiry = expiryTimestamp(profile);
  const stillValid = expiry === null || expiry > now;
  if (!stillValid) return 'free';
  // Pro Plus là superset của Pro — xét trước.
  return hasProPlusFlag(profile) ? 'pro_plus' : 'pro';
}

/** Pro HOẶC Pro Plus đang hiệu lực (mọi quyền Pro). */
export function isProActive(profile: Partial<UserProfile> | null | undefined, now = Date.now()): boolean {
  return resolveTier(profile, now) !== 'free';
}

/** Riêng Pro Plus (Phú Vương) đang hiệu lực. */
export function isProPlusActive(profile: Partial<UserProfile> | null | undefined, now = Date.now()): boolean {
  return resolveTier(profile, now) === 'pro_plus';
}

export function getProStatus(profile: Partial<UserProfile> | null | undefined, now = Date.now()): ProStatus {
  const enforced = isMonetizationEnabled();
  const tier = resolveTier(profile, now);
  const expiry = expiryTimestamp(profile ?? {});
  const isExpired = Boolean(profile && hasPremiumFlag(profile) && expiry !== null && expiry <= now);
  const daysRemaining = expiry !== null && expiry > now
    ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    tier,
    isPro: tier !== 'free',
    expiresAt: profile?.premiumExpiresAt ?? null,
    isExpired,
    daysRemaining,
    enforced,
  };
}

/** Compute a new expiry timestamp when granting/renewing Pro. Stacks on remaining time. */
export function computeProExpiry(
  currentExpiresAt: string | null | undefined,
  periodDays = PRO_PERIOD_DAYS,
  now = Date.now(),
): string {
  const current = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0;
  const base = Number.isFinite(current) && current > now ? current : now;
  return new Date(base + periodDays * 24 * 60 * 60 * 1000).toISOString();
}

/** Khung nào đang active trong cửa sổ 3 gói. */
export type ActiveCard = 'base' | 'pro' | 'trial';

export interface PlanCard {
  /** Khung đang active (để tô xanh + "Đã kích hoạt"). */
  active: ActiveCard;
  /** Tier hiệu lực. */
  tier: Tier;
  /** Đang dùng Pro bằng đường dùng thử? (đổi nhãn "Đang dùng thử"). */
  isOnTrial: boolean;
  /** Đã dùng thử (1 lần/đời) → khóa khung Dùng thử. */
  trialUsed: boolean;
  /** Số ngày Pro còn lại. */
  daysRemaining: number;
  /** Bảng SKU Pro theo kỳ hạn (cho bộ chọn kỳ hạn). */
  skus: Record<ProSkuId, ProSku>;
}

/** Trạng thái cửa sổ 3 gói cho UI (Phase B render). */
export function getPlanCard(profile: Partial<UserProfile> | null | undefined, now = Date.now()): PlanCard {
  const status = getProStatus(profile, now);
  const isOnTrial = status.isPro && profile?.billingProvider === 'trial';
  const active: ActiveCard = !status.isPro ? 'base' : isOnTrial ? 'trial' : 'pro';
  return {
    active,
    tier: status.tier,
    isOnTrial,
    trialUsed: Boolean(profile?.trialUsedAt),
    daysRemaining: status.daysRemaining,
    skus: PRO_SKUS,
  };
}
