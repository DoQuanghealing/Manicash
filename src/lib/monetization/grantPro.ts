/* ═══ P0 Monetization — server-side Pro granting ═══
 * Writes the Pro entitlement to users/{uid} via the admin SDK after a purchase
 * is verified. Purchase verification is provider-agnostic so Google Play Billing
 * / RevenueCat / Stripe can be plugged in without touching the grant logic.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  computeProExpiry,
  PRO_PERIOD_DAYS,
  tierForSku,
  tierForProductId,
  entitlementFieldsForTier,
  type Tier,
} from './entitlement';
import type { BillingProvider } from '@/types/user';

export type { BillingProvider };

export interface VerifyPurchaseInput {
  provider: BillingProvider;
  productId: string;
  purchaseToken: string;
  orderId?: string;
}

export interface VerifiedPurchase {
  ok: boolean;
  reason: string;
  periodDays: number;
  orderId?: string;
}

/**
 * Verify a purchase with the billing provider. STUB: real verification against
 * the Google Play Developer API (or RevenueCat) plugs in here. Mock purchases are
 * only honoured when BILLING_ALLOW_MOCK=true (dev/staging) so production rejects them.
 */
export async function verifyPurchase(input: VerifyPurchaseInput): Promise<VerifiedPurchase> {
  if (!input.purchaseToken || !input.productId) {
    return { ok: false, reason: 'Missing purchaseToken or productId.', periodDays: 0 };
  }

  if (input.provider === 'mock') {
    if (process.env.BILLING_ALLOW_MOCK !== 'true') {
      return { ok: false, reason: 'Mock billing is disabled in this environment.', periodDays: 0 };
    }
    return { ok: true, reason: 'Mock purchase accepted (dev only).', periodDays: PRO_PERIOD_DAYS, orderId: input.orderId };
  }

  if (input.provider === 'google_play') {
    // TODO: verify via Google Play Developer API
    //   androidpublisher.purchases.subscriptions.get / .products.get
    // using a service account, then map the validated expiry to periodDays.
    return { ok: false, reason: 'Google Play verification is not configured yet.', periodDays: 0 };
  }

  return { ok: false, reason: `Unknown billing provider: ${input.provider}.`, periodDays: 0 };
}

export interface GrantProResult {
  tier: Exclude<Tier, 'free'>;
  premiumExpiresAt: string;
}

/**
 * Grant/renew Pro (hoặc Pro Plus) on users/{uid}. Stacks onto remaining time.
 * Idempotent per orderId.
 *
 * PV-5: tier cấp lấy từ `skuId` (SKU tự khai `grantsTier`). Không truyền → 'pro'
 * (fail-safe: không bao giờ tự nâng lên pro_plus khi không chắc).
 */
export async function grantProToUser(
  uid: string,
  opts: {
    periodDays?: number;
    provider: BillingProvider;
    orderId?: string;
    /** SKU nội bộ ('pro_plus_monthly'…) — ưu tiên nếu có. */
    skuId?: string;
    /** productId của store (Google Play / Apple) — dùng khi không có skuId. */
    productId?: string;
  },
): Promise<GrantProResult> {
  const grantedTier = opts.skuId ? tierForSku(opts.skuId) : tierForProductId(opts.productId);
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}`);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() ?? {} : {};

    // Idempotency: same orderId already applied → return current expiry unchanged.
    const appliedOrders: string[] = Array.isArray(data.billingOrderIds) ? data.billingOrderIds : [];
    if (opts.orderId && appliedOrders.includes(opts.orderId)) {
      const existing = typeof data.premiumExpiresAt === 'string'
        ? data.premiumExpiresAt
        : data.premiumExpiresAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
      return { tier: grantedTier, premiumExpiresAt: existing };
    }

    const currentExpiry = typeof data.premiumExpiresAt === 'string'
      ? data.premiumExpiresAt
      : data.premiumExpiresAt?.toDate?.()?.toISOString?.() ?? null;
    const premiumExpiresAt = computeProExpiry(currentExpiry, opts.periodDays ?? PRO_PERIOD_DAYS);

    transaction.set(
      ref,
      {
        ...entitlementFieldsForTier(grantedTier),
        premiumExpiresAt,
        billingProvider: opts.provider,
        billingOrderIds: opts.orderId
          ? FieldValue.arrayUnion(opts.orderId)
          : appliedOrders,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { tier: grantedTier, premiumExpiresAt };
  });
}
