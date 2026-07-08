/* ═══ Admin M1 — API đơn hàng & đối soát ═══
 * GET /api/admin/payments?view=list  → danh sách đơn (lọc status/plan/q, limit)
 * GET /api/admin/payments?view=reconcile → 3 nhóm lệch tiền
 * Gác bằng requireAdmin (Custom Claim + allowlist email).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listOrders, getReconciliation, getRevenueSeries } from '@/lib/monetization/reconcile';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const view = req.nextUrl.searchParams.get('view') || 'list';

  try {
    if (view === 'reconcile') {
      const report = await getReconciliation();
      return NextResponse.json(report);
    }

    if (view === 'revenue') {
      const daysRaw = Number(req.nextUrl.searchParams.get('days'));
      const series = await getRevenueSeries(Number.isFinite(daysRaw) ? daysRaw : 30);
      return NextResponse.json(series);
    }

    const sp = req.nextUrl.searchParams;
    const result = await listOrders({
      status: sp.get('status') || undefined,
      plan: sp.get('plan') || undefined,
      q: sp.get('q') || undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/payments] error:', error);
    return NextResponse.json({ error: 'Lỗi đọc dữ liệu.' }, { status: 500 });
  }
}
