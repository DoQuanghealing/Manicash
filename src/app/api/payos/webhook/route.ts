import { NextRequest, NextResponse } from 'next/server';
import type { Webhook } from '@payos/node';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getPayos } from '@/lib/monetization/payosClient';
import { isPaidWebhook } from '@/lib/monetization/payosOrder';
import { applyPaidOrderAtomic } from '@/lib/monetization/payosGrant';

/**
 * Webhook PayOS (server-to-server). Xác thực bằng CHỮ KÝ (không IP allowlist).
 * Mã HTTP: chữ ký sai/payload hỏng → 4xx; verify OK + xử xong (kể cả no-op) → 2xx;
 * lỗi tạm thời (Firestore) → 5xx để PayOS RETRY.
 * Nguồn-sự-thật DUY NHẤT để cấp Pro (returnUrl chỉ để hiển thị).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_payload' }, { status: 400 });
  }

  // Verify chữ ký (async, throw nếu sai) → trả về data đã xác thực.
  let data;
  try {
    data = await getPayos().webhooks.verify(body as Webhook);
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 400 });
  }

  // Ghi raw event để có thể replay tay (best-effort, không chặn).
  try {
    await getAdminDb().collection('payos_webhook_events').add({
      orderCode: data?.orderCode ?? null,
      amount: data?.amount ?? null,
      dataCode: data?.code ?? null,
      code: (body as { code?: string })?.code ?? null,
      success: (body as { success?: boolean })?.success ?? null,
      receivedAt: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }

  // Chỉ sự kiện THÀNH CÔNG (code '00') mới cấp Pro. Test/cancelled → 2xx no-op.
  if (!isPaidWebhook(body as Webhook)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await applyPaidOrderAtomic({ orderCode: data.orderCode, webhookAmount: data.amount });
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (error) {
    // Lỗi tạm thời → 5xx để PayOS retry (KHÔNG nuốt → tránh mất đơn đã trả tiền).
    console.error('[payos/webhook] processing error:', error);
    return NextResponse.json({ ok: false, reason: 'processing_error' }, { status: 500 });
  }
}
