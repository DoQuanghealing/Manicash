/* ═══ Pro Tier Gating — Feature flags cho monetization launch ═══
 *
 * SINGLE SOURCE OF TRUTH cho mọi check Pro/Free. Khi launch:
 *   1. Đổi `isPro` để check `profile?.tier === 'pro'`.
 *   2. Mọi gate khác (canUseSmsWebhook v.v.) sẽ tự enforce qua isPro.
 *
 * Hiện tại tất cả return true — không gate gì cả.
 */

import type { UserProfile } from '@/types/user';

/**
 * Check user có Pro tier không. Hiện tại always true.
 *
 * TODO Pro launch: return profile?.tier === 'pro';
 */
export function isPro(profile: UserProfile | null | undefined): boolean {
  void profile; // Reserved cho future enforcement.
  return true;
}

/**
 * Check user có quyền dùng SMS Webhook không.
 * Hiện tại always true — gate sẽ enforce qua `isPro` khi launch.
 *
 * TODO Pro launch: return isPro(profile);
 */
export function canUseSmsWebhook(profile: UserProfile | null | undefined): boolean {
  void profile;
  return true;
}
