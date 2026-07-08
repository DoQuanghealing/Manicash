/* ═══ Admin M8 — API nhật ký (đọc admin_audit) ═══ */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listAudit } from '@/lib/admin/audit';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const result = await listAudit({
      action: sp.get('action') || undefined,
      actor: sp.get('actor') || undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/audit] error:', error);
    return NextResponse.json({ error: 'Lỗi đọc dữ liệu.' }, { status: 500 });
  }
}
