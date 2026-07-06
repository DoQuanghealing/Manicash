import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { getProSku, type ProSku } from '@/lib/monetization/entitlement';
import { getPayos, isPayosConfigured } from '@/lib/monetization/payosClient';
import { makeOrderCode } from '@/lib/monetization/payosOrder';

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
}

/**
 * Gói test nội bộ — KHÔNG xuất hiện trong PricingCards/UI, chỉ tạo được khi có
 * đúng `x-admin-key` (test end-to-end webhook→grant thật với số tiền nhỏ, không
 * đụng tới PRO_SKUS/giá thật cho user thường).
 */
const ADMIN_TEST_SKU: ProSku = { amount: 10_000, periodDays: 1, productId: 'manicash_admin_test' };

export async function POST(req: NextRequest) {
  let debugAdminTest = false;
  try {
    if (!isPayosConfigured()) {
      return NextResponse.json({ error: 'PayOS chưa được cấu hình.' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const plan = typeof b.plan === 'string' ? b.plan : '';

    const adminKey = process.env.MANICASH_ADMIN_KEY;
    const isAdminTest = plan === 'admin_test' && !!adminKey && req.headers.get('x-admin-key') === adminKey;
    debugAdminTest = isAdminTest;

    const sku = isAdminTest ? ADMIN_TEST_SKU : getProSku(plan);
    if (!sku) {
      return NextResponse.json({ error: 'Gói không hợp lệ.' }, { status: 400 });
    }

    // admin_test: uid do admin chỉ định thẳng (giống quy ước /api/admin/test-account),
    // không cần Bearer token — mọi request khác vẫn bắt buộc Bearer như cũ.
    const uid = isAdminTest
      ? (typeof b.uid === 'string' ? b.uid : '')
      : await getVerifiedRequestUid(req);
    if (!uid) {
      return NextResponse.json({ error: isAdminTest ? 'Thiếu uid.' : 'Cần đăng nhập.' }, { status: isAdminTest ? 400 : 401 });
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
      } catch (writeErr) {
        if (attempt === 4) {
          if (isAdminTest) {
            return NextResponse.json({ error: 'Không tạo được đơn, thử lại.', debug: String(writeErr) }, { status: 500 });
          }
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
      if (isAdminTest) {
        return NextResponse.json({ error: 'Không tạo được link thanh toán.', debug: String(error), stack: error instanceof Error ? error.stack : undefined }, { status: 502 });
      }
      return NextResponse.json({ error: 'Không tạo được link thanh toán.' }, { status: 502 });
    }
  } catch (fatal) {
    // Bắt MỌI exception chưa lường tới — chỉ lộ chi tiết qua đường admin_test debug.
    console.error('[payos/create-link] fatal:', fatal);
    return NextResponse.json(
      debugAdminTest
        ? { error: 'fatal', debug: String(fatal), stack: fatal instanceof Error ? fatal.stack : undefined }
        : { error: 'Lỗi hệ thống, thử lại sau.' },
      { status: 500 },
    );
  }
}
