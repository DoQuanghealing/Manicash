/* ═══ Pro Tier Gating — Feature flags cho monetization launch ═══
 *
 * SINGLE SOURCE OF TRUTH cho mọi check Pro/Free phía client.
 * Logic thực tế nằm ở `src/lib/monetization/entitlement.ts`.
 *
 * Kill-switch: NEXT_PUBLIC_MONETIZATION_ENABLED.
 *   - off (default): mọi user được coi là Pro → giữ hành vi demo hiện tại.
 *   - on: enforce theo tier/plan/isPremium + premiumExpiresAt.
 */

import type { UserProfile } from '@/types/user';
import { isProActive } from '@/lib/monetization/entitlement';

/** Check user có Pro tier không (đã tính kill-switch + hạn dùng). */
export function isPro(profile: UserProfile | null | undefined): boolean {
  return isProActive(profile);
}

/** Check user có quyền dùng SMS Webhook không — gate qua isPro. */
export function canUseSmsWebhook(profile: UserProfile | null | undefined): boolean {
  return isPro(profile);
}
