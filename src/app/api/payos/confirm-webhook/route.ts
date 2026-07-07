import { NextRequest, NextResponse } from 'next/server';
import { getPayos, isPayosConfigured } from '@/lib/monetization/payosClient';
import { requireAdmin } from '@/lib/requireAdmin';
import { logAdminAction } from '@/lib/adminAudit';

/**
 * Đăng ký webhook URL với PayOS — CHẠY 1 LẦN mỗi môi trường (PayOS test endpoint rồi
 * mới gửi webhook thật). Không confirm → PayOS không gửi → KHÔNG bao giờ cấp Pro.
 * Gác bằng Firebase Custom Claims (requireAdmin — Bearer ID token, không còn key tĩnh).
 * Gọi: POST /api/payos/confirm-webhook  header Authorization: Bearer <idToken>  body { url? }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
  }
  if (!isPayosConfigured()) {
    return NextResponse.json({ error: 'PayOS chưa cấu hình.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const url = typeof (body as Record<string, unknown>)?.url === 'string'
    ? ((body as Record<string, unknown>).url as string)
    : `${base}/api/payos/webhook`;

  try {
    const result = await getPayos().webhooks.confirm(url);
    await logAdminAction(admin, 'payos.confirmWebhook', { url });
    return NextResponse.json({ ok: true, registered: url, result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'confirm failed';
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }
}
