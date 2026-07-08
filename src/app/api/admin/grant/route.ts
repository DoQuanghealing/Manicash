/* ═══ Admin M1 — API cấp Pro ═══
 * POST /api/admin/grant
 *   { orderCode }            → đối soát 1 đơn: verify PayOS nếu cần rồi cấp (idempotent)
 *   { uid, periodDays }      → cấp Pro thủ công (không gắn đơn), stacking
 * Mọi hành động ghi admin_audit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { logAdminAction } from '@/lib/adminAudit';
import { verifyAndGrantOrder, grantProManual } from '@/lib/monetization/reconcile';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    body = {};
  }

  // ── Đối soát theo đơn ──
  if (body.orderCode !== undefined) {
    const orderCode = Number(body.orderCode);
    if (!Number.isInteger(orderCode) || orderCode <= 0) {
      return NextResponse.json({ error: 'orderCode không hợp lệ.' }, { status: 400 });
    }
    try {
      const result = await verifyAndGrantOrder(orderCode);
      await logAdminAction(admin, 'grant.reconcile', { orderCode, ...result });
      return NextResponse.json(result);
    } catch (error) {
      console.error('[admin/grant] reconcile error:', error);
      await logAdminAction(admin, 'grant.reconcile.error', { orderCode });
      return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 });
    }
  }

  // ── Cấp thủ công theo uid ──
  if (typeof body.uid === 'string') {
    const uid = body.uid.trim();
    const periodDays = Number(body.periodDays);
    if (!uid) return NextResponse.json({ error: 'uid bắt buộc.' }, { status: 400 });
    if (!Number.isFinite(periodDays) || periodDays <= 0) {
      return NextResponse.json({ error: 'periodDays không hợp lệ.' }, { status: 400 });
    }
    try {
      const result = await grantProManual({ uid, periodDays, actorUid: admin.uid });
      await logAdminAction(admin, 'grant.manual', { uid, periodDays, ...result });
      return NextResponse.json(result);
    } catch (error) {
      console.error('[admin/grant] manual error:', error);
      await logAdminAction(admin, 'grant.manual.error', { uid, periodDays });
      return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Thiếu orderCode hoặc uid.' }, { status: 400 });
}
