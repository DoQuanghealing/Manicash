import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { getProSku } from '@/lib/monetization/entitlement';
import { getPayos, isPayosConfigured } from '@/lib/monetization/payosClient';
import { makeOrderCode } from '@/lib/monetization/payosOrder';

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
}

export async function POST(req: NextRequest) {
  if (!isPayosConfigured()) {
    return NextResponse.json({ error: 'PayOS chưa được cấu hình.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const plan = typeof (body as Record<string, unknown>)?.plan === 'string'
    ? ((body as Record<string, unknown>).plan as string)
    : '';
  const sku = getProSku(plan);
  if (!sku) {
    return NextResponse.json({ error: 'Gói không hợp lệ.' }, { status: 400 });
  }

  const uid = await getVerifiedRequestUid(req);
  if (!uid) {
    return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });
  }

  const db = getAdminDb();
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || '';
  const nowIso = new Date().toISOString();

  // Sinh orderCode duy nhất qua create() (fail nếu trùng → sinh lại).
  let orderCode = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = makeOrderCode(Date.now(), crypto.randomInt(0, 10000));
    try {
      await db.doc(`payment_intents/${candidate}`).create({
        uid,
        plan,
        amount: sku.amount,
        periodDays: sku.periodDays,
        status: 'pending',
        ip,
        ua,
        createdAt: nowIso,
      });
      orderCode = candidate;
      break;
    } catch {
      if (attempt === 4) {
        return NextResponse.json({ error: 'Không tạo được đơn, thử lại.' }, { status: 500 });
      }
    }
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  try {
    const userRecord = await getAdminAuth().getUser(uid).catch(() => null);
    const link = await getPayos().paymentRequests.create({
      orderCode,
      amount: sku.amount,
      description: 'ManiCash Pro',
      returnUrl: `${base}/payment/success?orderCode=${orderCode}`,
      cancelUrl: `${base}/payment/cancel?orderCode=${orderCode}`,
      buyerEmail: userRecord?.email ?? undefined,
    });
    await db.doc(`payment_intents/${orderCode}`).set(
      { checkoutUrl: link.checkoutUrl, paymentLinkId: link.paymentLinkId },
      { merge: true },
    );
    return NextResponse.json({ checkoutUrl: link.checkoutUrl, orderCode });
  } catch (error) {
    await db.doc(`payment_intents/${orderCode}`).set({ status: 'create_failed' }, { merge: true }).catch(() => {});
    console.error('[payos/create-link] error:', error);
    return NextResponse.json({ error: 'Không tạo được link thanh toán.' }, { status: 502 });
  }
}
