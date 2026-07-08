/* ═══ Admin M2 — API người dùng ═══
 * GET  ?view=list      → danh bạ (Auth ⨝ users), lọc q/plan/status/includeTest
 * GET  ?view=profile&uid= → Customer 360
 * POST { uid, action } → revoke_pro | set_test | unset_test | ban | unban
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { logAdminAction } from '@/lib/adminAudit';
import { listUsers, getCustomerProfile, revokePro, setTestFlag } from '@/lib/admin/directory';
import { manualBan, unban } from '@/lib/security';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const view = sp.get('view') || 'list';
  try {
    if (view === 'profile') {
      const uid = sp.get('uid') || '';
      if (!uid) return NextResponse.json({ error: 'Thiếu uid.' }, { status: 400 });
      const profile = await getCustomerProfile(uid);
      if (!profile) return NextResponse.json({ error: 'Không tìm thấy user.' }, { status: 404 });
      return NextResponse.json(profile);
    }
    const result = await listUsers({
      q: sp.get('q') || undefined,
      plan: sp.get('plan') || undefined,
      status: sp.get('status') || undefined,
      includeTest: sp.get('includeTest') === '1',
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/users] error:', error);
    return NextResponse.json({ error: 'Lỗi đọc dữ liệu.' }, { status: 500 });
  }
}

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
  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  const action = typeof body.action === 'string' ? body.action : '';
  if (!uid || !action) return NextResponse.json({ error: 'Thiếu uid hoặc action.' }, { status: 400 });

  try {
    switch (action) {
      case 'revoke_pro':
        await revokePro(uid, admin.uid);
        break;
      case 'set_test':
        await setTestFlag(uid, true);
        break;
      case 'unset_test':
        await setTestFlag(uid, false);
        break;
      case 'ban':
        manualBan(uid, 'uid', typeof body.reason === 'string' ? body.reason : 'Admin ban (Customer 360)');
        break;
      case 'unban':
        unban(uid, 'uid');
        break;
      default:
        return NextResponse.json({ error: 'action không hợp lệ.' }, { status: 400 });
    }
    await logAdminAction(admin, `user.${action}`, { uid });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/users] action error:', error);
    await logAdminAction(admin, `user.${action}.error`, { uid });
    return NextResponse.json({ ok: false, error: 'Lỗi xử lý.' }, { status: 500 });
  }
}
