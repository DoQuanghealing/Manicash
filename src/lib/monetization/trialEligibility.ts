/* ═══ Monetization — Dùng thử: phần THUẦN (no firebase-admin, test độc lập) ═══ */

import { createHash } from 'crypto';

export type TrialDenyReason = 'already_pro' | 'uid_used' | 'email_used' | 'device_used';

export interface TrialEligibilityInput {
  /** User đang có Pro active (paid/trial) — không cho thử nữa. */
  alreadyPro: boolean;
  /** users/{uid}.trialUsedAt đã có. */
  uidTrialed: boolean;
  /** trial_ledger có email này. */
  emailTrialed: boolean;
  /** device_ledger có device này. */
  deviceTrialed: boolean;
}

export interface TrialEligibility {
  allowed: boolean;
  reason: TrialDenyReason | 'ok';
}

/** PURE: quyết định 1 yêu cầu dùng thử có hợp lệ không. Thứ tự ưu tiên lý do rõ ràng. */
export function evaluateTrialEligibility(input: TrialEligibilityInput): TrialEligibility {
  if (input.alreadyPro) return { allowed: false, reason: 'already_pro' };
  if (input.uidTrialed) return { allowed: false, reason: 'uid_used' };
  if (input.emailTrialed) return { allowed: false, reason: 'email_used' };
  if (input.deviceTrialed) return { allowed: false, reason: 'device_used' };
  return { allowed: true, reason: 'ok' };
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function hashDevice(deviceId: string): string {
  return createHash('sha256').update(deviceId.trim()).digest('hex');
}

/** Lỗi nghiệp vụ khi không đủ điều kiện dùng thử (route map → 409). */
export class TrialDeniedError extends Error {
  reason: TrialDenyReason;
  constructor(reason: TrialDenyReason) {
    super(`Trial denied: ${reason}`);
    this.name = 'TrialDeniedError';
    this.reason = reason;
  }
}
