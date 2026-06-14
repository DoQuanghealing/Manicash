/* ═══ PayOS — cấp Pro khi webhook PAID (atomic + idempotent) ═══
 * MỘT transaction: kiểm payment_intents (pending + amount khớp) → set status='paid' +
 * entitlement user (stacking) + payments_index + grant_events. Idempotent theo
 * intent.status (chống replay/double-grant). KHÔNG gọi grantProToUser lồng nhau.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { computeProExpiry, PRO_PERIOD_DAYS } from './entitlement';

export type PaidOutcome = 'no_intent' | 'already' | 'mismatch' | 'not_pending' | 'granted';

export interface ApplyPaidResult {
  outcome: PaidOutcome;
  uid?: string;
  premiumExpiresAt?: string;
}

function readExpiryString(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  const toDate = (raw as { toDate?: () => Date } | null | undefined)?.toDate;
  if (typeof toDate === 'function') return toDate.call(raw).toISOString();
  return null;
}

/**
 * Áp 1 đơn PAID từ webhook PayOS. `webhookAmount` để kiểm khớp chính xác với intent.
 * Trả outcome cho route quyết mã HTTP (đều 2xx — đã verify chữ ký ở tầng trên).
 */
export async function applyPaidOrderAtomic(input: {
  orderCode: number;
  webhookAmount: number;
  now?: number;
}): Promise<ApplyPaidResult> {
  const { orderCode, webhookAmount } = input;
  const now = input.now ?? Date.now();
  const db = getAdminDb();
  const intentRef = db.doc(`payment_intents/${String(orderCode)}`);

  return db.runTransaction(async (tx) => {
    const intentSnap = await tx.get(intentRef);
    if (!intentSnap.exists) return { outcome: 'no_intent' as const };
    const intent = intentSnap.data() ?? {};

    if (intent.status === 'paid') return { outcome: 'already' as const, uid: intent.uid };
    // 'pending' HOẶC 'amount_mismatch' (underpay trước đó) đều cho re-evaluate; chỉ 'paid' terminal.

    const uid: string = typeof intent.uid === 'string' ? intent.uid : '';
    if (!uid) return { outcome: 'no_intent' as const };

    const intentAmount = typeof intent.amount === 'number' ? intent.amount : -1;
    // Trả ĐỦ hoặc DƯ (overpay) → cấp; chỉ THIẾU (underpay) mới mismatch. Mismatch KHÔNG khóa
    // cứng: webhook/đối soát với amount đúng sau đó vẫn grant (vì chỉ 'paid' mới terminal).
    if (webhookAmount < intentAmount) {
      tx.update(intentRef, { status: 'amount_mismatch', webhookAmount, updatedAt: FieldValue.serverTimestamp() });
      return { outcome: 'mismatch' as const, uid };
    }

    const periodDays: number = typeof intent.periodDays === 'number' ? intent.periodDays : PRO_PERIOD_DAYS;
    const plan: string = typeof intent.plan === 'string' ? intent.plan : 'monthly';

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await tx.get(userRef);
    const currentExpiry = userSnap.exists ? readExpiryString(userSnap.data()?.premiumExpiresAt) : null;
    const premiumExpiresAt = computeProExpiry(currentExpiry, periodDays, now);
    const nowIso = new Date(now).toISOString();
    const orderId = String(orderCode);

    tx.update(intentRef, { status: 'paid', paidAt: nowIso, updatedAt: FieldValue.serverTimestamp() });
    tx.set(
      userRef,
      {
        tier: 'pro',
        plan: 'premium',
        isPremium: true,
        premiumExpiresAt,
        billingProvider: 'payos',
        billingOrderIds: FieldValue.arrayUnion(orderId),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(db.doc(`payments_index/${orderId}`), {
      uid,
      orderCode,
      amount: webhookAmount,
      status: 'paid',
      plan,
      periodDays,
      provider: 'payos',
      paidAt: nowIso,
    });
    tx.set(db.collection('grant_events').doc(), {
      uid,
      provider: 'payos',
      periodDays,
      orderId,
      at: nowIso,
    });

    return { outcome: 'granted' as const, uid, premiumExpiresAt };
  });
}
