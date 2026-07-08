/* ═══ R&D — Nhận metric_snapshot theo NGÀY (server-only ghi) ═══
 * POST body: { dateLocal, healthScore?, capacity?, behavior?, scalars?, schemaVersion?, appVersion? }
 * Bất biến bảo vệ dữ liệu nhạy cảm (Nghị định 13/2023):
 *   - Chỉ ghi khi users/{uid}.analyticsConsent === true (server-authoritative).
 *   - Bỏ qua tài khoản test (isTestAccount) → không nhiễm thống kê R&D.
 *   - Upsert theo {uid}_{dateLocal} (idempotent theo ngày, KHÔNG dùng UTC).
 * Client tự tính snapshot rồi gửi (engine chạy client) — server chỉ lưu trữ.
 */
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return NextResponse.json({ error: 'Payload lỗi.' }, { status: 400 });
  }

  const dateLocal = typeof body.dateLocal === 'string' && DATE_RE.test(body.dateLocal) ? body.dateLocal : null;
  if (!dateLocal) return NextResponse.json({ error: 'dateLocal (YYYY-MM-DD) bắt buộc.' }, { status: 400 });

  const db = getAdminDb();
  const userSnap = await db.doc(`users/${uid}`).get();
  const u = userSnap.data() ?? {};
  if (u.analyticsConsent !== true) return NextResponse.json({ ok: true, skipped: 'no_consent' });
  if (u.isTestAccount === true) return NextResponse.json({ ok: true, skipped: 'test_account' });

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const obj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

  const docId = `${uid}_${dateLocal.replace(/-/g, '')}`;
  await db.doc(`metric_snapshots/${docId}`).set(
    {
      uid,
      dateLocal,
      healthScore: num(body.healthScore),
      capacity: obj(body.capacity),
      behavior: obj(body.behavior),
      scalars: obj(body.scalars),
      schemaVersion: typeof body.schemaVersion === 'string' ? body.schemaVersion : '1',
      appVersion: typeof body.appVersion === 'string' ? body.appVersion : null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, id: docId });
}
