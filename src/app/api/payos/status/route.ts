import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getPayos, isPayosConfigured } from '@/lib/monetization/payosClient';
import { applyPaidOrderAtomic } from '@/lib/monetization/payosGrant';

/**
 * Đối soát trạng thái 1 đơn (lưới an toàn khi webhook trễ/miss). Trang /payment/success
 * gọi để xác nhận + cấp Pro idempotent nếu PayOS báo PAID mà webhook chưa tới.
 * Bảo mật: chỉ chủ đơn (intent.uid === uid) mới xem được — chống IDOR đoán orderCode.
 */
export async function GET(req: NextRequest) {
  if (!isPayosConfigured()) {
    return NextResponse.json({ error: 'PayOS chưa cấu hình.' }, { status: 503 });
  }

  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });

  const orderCodeRaw = req.nextUrl.searchParams.get('orderCode') || '';
  const orderCode = Number(orderCodeRaw);
  if (!Number.isInteger(orderCode) || orderCode <= 0) {
    return NextResponse.json({ error: 'orderCode không hợp lệ.' }, { status: 400 });
  }

  const intentSnap = await getAdminDb().doc(`payment_intents/${orderCode}`).get();
  if (!intentSnap.exists) return NextResponse.json({ error: 'Không tìm thấy đơn.' }, { status: 404 });
  const intent = intentSnap.data() ?? {};
  if (intent.uid !== uid) return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });

  async function paidResponse() {
    const userSnap = await getAdminDb().doc(`users/${uid}`).get();
    const exp = userSnap.data()?.premiumExpiresAt;
    return NextResponse.json({
      paid: true,
      status: 'paid',
      premiumExpiresAt: typeof exp === 'string' ? exp : null,
    });
  }

  if (intent.status === 'paid') return paidResponse();

  let link;
  try {
    link = await getPayos().paymentRequests.get(orderCode);
  } catch (error) {
    console.error('[payos/status] get error:', error);
    return NextResponse.json({ paid: false, status: 'unknown' });
  }

  if (link.status !== 'PAID') {
    return NextResponse.json({ paid: false, status: link.status });
  }

  // PayOS báo PAID → cấp idempotent. Dùng link.amount (số tiền đơn) khớp ngữ nghĩa webhook
  // data.amount (KHÔNG amountPaid tích lũy → tránh mismatch oan khi overpay). Lỗi grant KHÔNG
  // nuốt thành 'unknown' (mất tiền im lặng) → 500 + log to để xử lý tay.
  try {
    await applyPaidOrderAtomic({ orderCode, webhookAmount: link.amount });
    return paidResponse();
  } catch (error) {
    console.error('[payos/status] PAID nhưng grant FAIL (cần xử lý tay) orderCode=', orderCode, error);
    return NextResponse.json({ paid: false, status: 'grant_failed' }, { status: 500 });
  }
}
