/* ═══ R&D — Bật/tắt đồng ý đóng góp dữ liệu ẩn danh ═══
 * POST { granted: boolean }. Ghi analyticsConsent trên users/{uid} (server-authoritative).
 * Đây là consent tầng R&D — dữ liệu nhạy cảm (Nghị định 13/2023). Mặc định KHÔNG bật.
 */
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

/** Tầng consent: 'analytics' = Thông thái (mặc định) · 'sovereign' = Phú Vương (đồng hành sâu). */
type ConsentScope = 'analytics' | 'sovereign';

export async function POST(req: NextRequest) {
  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });

  let granted = false;
  let scope: ConsentScope = 'analytics';
  try {
    const body = await req.json();
    granted = body?.granted === true;
    if (body?.scope === 'sovereign') scope = 'sovereign';
  } catch {
    return NextResponse.json({ error: 'Payload lỗi.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (scope === 'sovereign') {
    // Phú Vương là tầng sâu hơn → bật cũng kéo theo analyticsConsent; tắt chỉ hạ tầng sâu.
    patch.sovereignConsent = granted;
    patch.sovereignConsentAt = now;
    if (granted) {
      patch.analyticsConsent = true;
      patch.analyticsConsentAt = now;
    }
  } else {
    patch.analyticsConsent = granted;
    patch.analyticsConsentAt = now;
    // Rút consent tầng dưới thì tầng sâu không còn cơ sở → hạ luôn.
    if (!granted) {
      patch.sovereignConsent = false;
      patch.sovereignConsentAt = now;
    }
  }

  await getAdminDb().doc(`users/${uid}`).set(patch, { merge: true });
  return NextResponse.json({ ok: true, granted, scope });
}

/** Đọc trạng thái consent hiện tại của user (cả 2 tầng). */
export async function GET(req: NextRequest) {
  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });
  const snap = await getAdminDb().doc(`users/${uid}`).get();
  const data = snap.data();
  return NextResponse.json({
    granted: data?.analyticsConsent === true,
    sovereign: data?.sovereignConsent === true,
  });
}
