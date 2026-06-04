/* ═══ P0 Monetization — Entitlement core ═══
 * Single source of truth for Free vs Pro on the CLIENT. Mirrors the server-side
 * resolveAiMoneyPlan logic (quotaCore.ts) so client UI and server quota agree.
 *
 * Kill-switch: NEXT_PUBLIC_MONETIZATION_ENABLED. When unset/"false", everyone is
 * treated as Pro (current demo behaviour preserved) so we can ship gating code
 * without locking out users before billing is live. Flip to "true" at launch.
 */

import type { UserProfile } from '@/types/user';

export type Tier = 'free' | 'pro';

/** Pro plan commercial constants (VND). */
export const PRO_PRICE_VND = 49_000;
export const PRO_PERIOD_DAYS = 30;
export const PRO_PRODUCT_ID = 'manicash_pro_monthly';

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

function hasPremiumFlag(profile: Partial<UserProfile>): boolean {
  return profile.tier === 'pro' || profile.plan === 'premium' || profile.isPremium === true;
}

function expiryTimestamp(profile: Partial<UserProfile>): number | null {
  if (!profile.premiumExpiresAt) return null;
  const ts = new Date(profile.premiumExpiresAt).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/**
 * Resolve the effective tier. With monetization disabled, everyone is Pro.
 * With it enabled, Pro requires a premium flag AND a non-expired subscription.
 */
export function resolveTier(profile: Partial<UserProfile> | null | undefined, now = Date.now()): Tier {
  if (!isMonetizationEnabled()) return 'pro';
  if (!profile) return 'free';

  if (!hasPremiumFlag(profile)) return 'free';

  const expiry = expiryTimestamp(profile);
  const stillValid = expiry === null || expiry > now;
  return stillValid ? 'pro' : 'free';
}

export function isProActive(profile: Partial<UserProfile> | null | undefined, now = Date.now()): boolean {
  return resolveTier(profile, now) === 'pro';
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
    isPro: tier === 'pro',
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
