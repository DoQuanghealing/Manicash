/* ═══ Admin — API quản lý app ═══
 * GET  → lỗi app (gom theo vân tay) + sự kiện lạm dụng + định danh bị chặn
 * POST → { id, action: 'resolve' | 'unresolve' } đánh dấu lỗi đã xử lý
 *        { subject, action: 'unlock' } gỡ chặn một định danh
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { logAdminAction } from '@/lib/adminAudit';
import { logAppError } from '@/lib/appErrorLog';
import { isDistributed } from '@/lib/abuse/counterStore';
import { RETENTION_DAYS } from '@/lib/abuse/policy';

const iso = (v: unknown): string | null => {
  const t = v as { toDate?: () => Date } | undefined;
  try { return t?.toDate ? t.toDate().toISOString() : null; } catch { return null; }
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const [errSnap, evtSnap, subjSnap] = await Promise.all([
      db.collection('app_errors').orderBy('lastSeenAt', 'desc').limit(100).get(),
      db.collection('abuse_events').orderBy('createdAt', 'desc').limit(100).get(),
      db.collection('abuse_subjects').orderBy('lastSeenAt', 'desc').limit(100).get(),
    ]);

    return NextResponse.json({
      /* Cho giao diện biết bộ đếm đang chạy phân tán hay chỉ trong bộ nhớ một
       * tiến trình. Không nói ra thì admin nhìn bảng trống và tưởng app an toàn,
       * trong khi thật ra là chưa cắm Redis nên không đếm được gì. */
      distributedCounters: isDistributed(),
      retentionDays: RETENTION_DAYS,
      errors: errSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          scope: x.scope ?? null,
          message: x.message ?? null,
          count: x.count ?? 0,
          resolved: x.resolved === true,
          firstSeenAt: iso(x.firstSeenAt),
          lastSeenAt: iso(x.lastSeenAt),
        };
      }),
      abuseEvents: evtSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          subject: x.subject ?? null,
          kind: x.kind ?? null,
          verdict: x.verdict ?? null,
          count: x.count ?? 0,
          path: x.path ?? null,
          createdAt: iso(x.createdAt),
        };
      }),
      subjects: subjSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          subject: x.subject ?? null,
          status: x.status ?? 'normal',
          strikes: x.strikes ?? 0,
          lastKind: x.lastKind ?? null,
          lastSeenAt: iso(x.lastSeenAt),
        };
      }),
    });
  } catch (error) {
    void logAppError('admin/health', error);
    return NextResponse.json({ error: 'Lỗi đọc dữ liệu.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const action = String(body?.action ?? '');
    const db = getAdminDb();

    if (action === 'resolve' || action === 'unresolve') {
      const id = String(body?.id ?? '');
      if (!id) return NextResponse.json({ error: 'Thiếu id.' }, { status: 400 });
      await db.collection('app_errors').doc(id).set({ resolved: action === 'resolve' }, { merge: true });
      await logAdminAction(admin, action === 'resolve' ? 'error_resolve' : 'error_unresolve', { id });
      return NextResponse.json({ ok: true });
    }

    if (action === 'unlock') {
      const subject = String(body?.subject ?? '');
      if (!subject) return NextResponse.json({ error: 'Thiếu subject.' }, { status: 400 });
      await db
        .collection('abuse_subjects')
        .doc(encodeURIComponent(subject))
        .set({ status: 'normal', unlockedAt: new Date() }, { merge: true });
      await logAdminAction(admin, 'abuse_unlock', { subject });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ.' }, { status: 400 });
  } catch (error) {
    void logAppError('admin/health', error);
    return NextResponse.json({ error: 'Lỗi xử lý.' }, { status: 500 });
  }
}
