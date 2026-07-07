/* ═══ Admin Bans API — List / Unban / Manual Ban ═══ */
import { NextResponse } from 'next/server';
import { getAllBans, unban, manualBan, getSecurityStats } from '@/lib/security';
import { requireAdmin } from '@/lib/requireAdmin';
import { logAdminAction } from '@/lib/adminAudit';

/* GET /api/admin/bans — List all bans + stats */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bans = getAllBans();
  const stats = getSecurityStats();

  return NextResponse.json({
    bans,
    stats,
    timestamp: new Date().toISOString(),
  });
}

/* POST /api/admin/bans — Manual ban or unban */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, identifier, type, reason } = body;

  if (!identifier || !type || !['ip', 'uid'].includes(type)) {
    return NextResponse.json(
      { error: 'Missing required fields: identifier, type (ip|uid)' },
      { status: 400 }
    );
  }

  if (action === 'unban') {
    const success = unban(identifier, type);
    await logAdminAction(admin, 'ban.unban', { identifier, type, success });
    return NextResponse.json({
      success,
      message: success
        ? `Đã gỡ ban ${type}:${identifier}`
        : `Không tìm thấy ban cho ${type}:${identifier}`,
    });
  }

  if (action === 'ban') {
    manualBan(identifier, type, reason || 'Admin ban');
    await logAdminAction(admin, 'ban.create', { identifier, type, reason: reason || 'Admin ban' });
    return NextResponse.json({
      success: true,
      message: `Đã ban ${type}:${identifier}`,
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use: ban | unban' }, { status: 400 });
}
