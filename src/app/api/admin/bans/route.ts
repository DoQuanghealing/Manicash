/* ═══ Admin Bans API — List / Unban / Manual Ban ═══ */
import { NextResponse } from 'next/server';
import { getAllBans, unban, manualBan, getSecurityStats } from '@/lib/security';

/* Simple admin key — in production, use proper auth */
const ADMIN_KEY = process.env.MANICASH_ADMIN_KEY || 'manicash-admin-2026';

function checkAdmin(request: Request): boolean {
  const authHeader = request.headers.get('x-admin-key');
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');
  return authHeader === ADMIN_KEY || queryKey === ADMIN_KEY;
}

/* GET /api/admin/bans — List all bans + stats */
export async function GET(request: Request) {
  if (!checkAdmin(request)) {
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
  if (!checkAdmin(request)) {
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
    return NextResponse.json({
      success,
      message: success
        ? `Đã gỡ ban ${type}:${identifier}`
        : `Không tìm thấy ban cho ${type}:${identifier}`,
    });
  }

  if (action === 'ban') {
    manualBan(identifier, type, reason || 'Admin ban');
    return NextResponse.json({
      success: true,
      message: `Đã ban ${type}:${identifier}`,
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use: ban | unban' }, { status: 400 });
}
