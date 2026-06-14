import { NextRequest, NextResponse } from 'next/server';
import { getPayos, isPayosConfigured } from '@/lib/monetization/payosClient';

/**
 * Đăng ký webhook URL với PayOS — CHẠY 1 LẦN mỗi môi trường (PayOS test endpoint rồi
 * mới gửi webhook thật). Không confirm → PayOS không gửi → KHÔNG bao giờ cấp Pro.
 * Tạm gác bằng MANICASH_ADMIN_KEY (header, không query). Phase D sẽ siết bằng custom claims.
 * Gọi: POST /api/payos/confirm-webhook  header x-admin-key  body { url? }
 */
export async function POST(req: NextRequest) {
  const adminKey = process.env.MANICASH_ADMIN_KEY;
  if (!adminKey || req.headers.get('x-admin-key') !== adminKey) {
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
    return NextResponse.json({ ok: true, registered: url, result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'confirm failed';
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }
}
