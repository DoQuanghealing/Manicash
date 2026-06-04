import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import {
  grantProToUser,
  verifyPurchase,
  type BillingProvider,
} from '@/lib/monetization/grantPro';

type ResultSource = 'granted' | 'invalid' | 'unauthorized' | 'rejected' | 'error';

function parseProvider(value: unknown): BillingProvider | null {
  return value === 'google_play' || value === 'mock' ? value : null;
}

function jsonResult(source: ResultSource, reason: string, extra: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ source, reason, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResult('invalid', 'Invalid JSON payload.', {}, 400);
  }

  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const provider = parseProvider(b.provider);
  const productId = typeof b.productId === 'string' ? b.productId : '';
  const purchaseToken = typeof b.purchaseToken === 'string' ? b.purchaseToken : '';
  const orderId = typeof b.orderId === 'string' ? b.orderId : undefined;

  if (!provider || !productId || !purchaseToken) {
    return jsonResult('invalid', 'Missing provider, productId, or purchaseToken.', {}, 400);
  }

  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) {
      return jsonResult('unauthorized', 'Billing verification requires a verified signed-in user.', {}, 401);
    }

    const verified = await verifyPurchase({ provider, productId, purchaseToken, orderId });
    if (!verified.ok) {
      return jsonResult('rejected', verified.reason, {}, 402);
    }

    const grant = await grantProToUser(uid, {
      periodDays: verified.periodDays,
      provider,
      orderId: verified.orderId ?? orderId,
    });

    return NextResponse.json({
      source: 'granted',
      reason: 'Pro entitlement granted.',
      tier: grant.tier,
      premiumExpiresAt: grant.premiumExpiresAt,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Billing verification failed.';
    return jsonResult('error', reason);
  }
}
