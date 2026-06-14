/* ═══ Monetization — cấp Dùng thử Pro (atomic, 1 lần/đời) ═══
 * Cấp Pro 30 ngày MIỄN PHÍ, chặn lách bằng 3 lớp ledger trong CÙNG 1 transaction:
 *   - uid       (users/{uid}.trialUsedAt)
 *   - email     (trial_ledger/{sha256(email)})    — sống sót qua xóa account
 *   - device    (device_ledger/{sha256(deviceId)}) — chặn reinstall cùng máy
 * KHÔNG gọi grantProToUser (nó tự mở transaction riêng → không atomic với trialUsedAt).
 * Quyết định eligibility là PURE (trialEligibility.ts) để test độc lập, không kéo firebase-admin.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { computeProExpiry, PRO_PERIOD_DAYS } from './entitlement';
import {
  evaluateTrialEligibility,
  hashEmail,
  hashDevice,
  TrialDeniedError,
  type TrialDenyReason,
} from './trialEligibility';

export { TrialDeniedError };
export type { TrialDenyReason };

export interface GrantTrialResult {
  tier: 'pro';
  premiumExpiresAt: string;
}

function readExpiryMs(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const ts = new Date(raw).getTime();
    return Number.isNaN(ts) ? null : ts;
  }
  const toDate = (raw as { toDate?: () => Date } | null | undefined)?.toDate;
  if (typeof toDate === 'function') return toDate.call(raw).getTime();
  return null;
}

/**
 * Cấp dùng thử Pro 30 ngày trong MỘT transaction. Throw TrialDeniedError nếu đã thử
 * (uid/email/device) hoặc đang Pro. Atomic: trialUsedAt + entitlement + 3 ledger +
 * grant_events ghi cùng lúc → chống race 2 request song song.
 */
export async function grantTrialAtomic(input: {
  uid: string;
  email: string;
  deviceId: string;
  ip?: string;
  periodDays?: number;
  now?: number;
}): Promise<GrantTrialResult> {
  const { uid, email, deviceId, ip = '', periodDays = PRO_PERIOD_DAYS } = input;
  const now = input.now ?? Date.now();
  const db = getAdminDb();

  const userRef = db.doc(`users/${uid}`);
  const emailHash = email ? hashEmail(email) : '';
  const deviceHash = deviceId ? hashDevice(deviceId) : '';
  const emailRef = emailHash ? db.doc(`trial_ledger/${emailHash}`) : null;
  const deviceRef = deviceHash ? db.doc(`device_ledger/${deviceHash}`) : null;

  return db.runTransaction(async (tx) => {
    const [userSnap, emailSnap, deviceSnap] = await Promise.all([
      tx.get(userRef),
      emailRef ? tx.get(emailRef) : Promise.resolve(null),
      deviceRef ? tx.get(deviceRef) : Promise.resolve(null),
    ]);

    const data = userSnap.exists ? userSnap.data() ?? {} : {};
    const expiry = readExpiryMs(data.premiumExpiresAt);
    const hasFlag = data.tier === 'pro' || data.plan === 'premium' || data.isPremium === true;
    const alreadyPro = hasFlag && (expiry === null || expiry > now);

    const verdict = evaluateTrialEligibility({
      alreadyPro,
      uidTrialed: Boolean(data.trialUsedAt),
      emailTrialed: Boolean(emailSnap?.exists),
      deviceTrialed: Boolean(deviceSnap?.exists),
    });
    if (!verdict.allowed) {
      throw new TrialDeniedError(verdict.reason as TrialDenyReason);
    }

    const nowIso = new Date(now).toISOString();
    // Đọc expiry robust (string HOẶC Firestore Timestamp) để stacking không rút ngắn
    // hạn Pro khi DB lưu Timestamp — khớp grantPro.ts. Tái dùng `expiry` đã đọc ở trên.
    const currentExpiry = expiry !== null ? new Date(expiry).toISOString() : null;
    const premiumExpiresAt = computeProExpiry(currentExpiry, periodDays, now);
    const orderId = `trial-${uid}`;

    tx.set(
      userRef,
      {
        tier: 'pro',
        plan: 'premium',
        isPremium: true,
        premiumExpiresAt,
        billingProvider: 'trial',
        billingOrderIds: FieldValue.arrayUnion(orderId),
        trialUsedAt: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (emailRef) tx.set(emailRef, { uid, at: nowIso });
    if (deviceRef) tx.set(deviceRef, { uid, ip, at: nowIso });
    tx.set(db.collection('grant_events').doc(), {
      uid,
      provider: 'trial',
      periodDays,
      orderId,
      at: nowIso,
    });

    return { tier: 'pro' as const, premiumExpiresAt };
  });
}
