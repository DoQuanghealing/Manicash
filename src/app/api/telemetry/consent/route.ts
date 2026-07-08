/* ═══ R&D — Bật/tắt đồng ý đóng góp dữ liệu ẩn danh ═══
 * POST { granted: boolean }. Ghi analyticsConsent trên users/{uid} (server-authoritative).
 * Đây là consent tầng R&D — dữ liệu nhạy cảm (Nghị định 13/2023). Mặc định KHÔNG bật.
 */
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });

  let granted = false;
  try {
    const body = await req.json();
    granted = body?.granted === true;
  } catch {
    return NextResponse.json({ error: 'Payload lỗi.' }, { status: 400 });
  }

  await getAdminDb().doc(`users/${uid}`).set(
    {
      analyticsConsent: granted,
      analyticsConsentAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return NextResponse.json({ ok: true, granted });
}

/** Đọc trạng thái consent hiện tại của user. */
export async function GET(req: NextRequest) {
  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });
  const snap = await getAdminDb().doc(`users/${uid}`).get();
  return NextResponse.json({ granted: snap.data()?.analyticsConsent === true });
}
