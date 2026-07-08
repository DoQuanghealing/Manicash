/* ═══ Admin M0 — API tổng quan (KPI + hàng đợi) ═══ */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getOverviewKpis, listDeletionRequests } from '@/lib/admin/overview';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const view = req.nextUrl.searchParams.get('view') || 'kpis';
  try {
    if (view === 'deletions') {
      const rows = await listDeletionRequests();
      return NextResponse.json({ rows });
    }
    const kpis = await getOverviewKpis();
    return NextResponse.json(kpis);
  } catch (error) {
    console.error('[admin/overview] error:', error);
    return NextResponse.json({ error: 'Lỗi đọc dữ liệu.' }, { status: 500 });
  }
}
