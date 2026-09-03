/* ═══ Admin M5 — API CRM hành vi ═══
 * GET → danh sách hồ sơ hành vi (bản ghi mới nhất mỗi user), kèm email.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { listBehaviorRows } from '@/lib/admin/crm';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 500);
    const { rows, scanned } = await listBehaviorRows(limit);

    /* Ghép email BẰNG MỘT LƯỢT getUsers(), không gọi trong vòng lặp: mỗi lần gọi
     * là một round-trip tới Firebase Auth, 200 người là 200 lượt và route sẽ hết
     * giờ. getUsers nhận tối đa 100 định danh mỗi lượt nên phải chia mẻ. */
    const auth = getAdminAuth();
    const emails = new Map<string, string | null>();
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100).map((r) => ({ uid: r.uid }));
      if (batch.length === 0) continue;
      const res = await auth.getUsers(batch);
      for (const u of res.users) emails.set(u.uid, u.email ?? null);
    }

    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, email: emails.get(r.uid) ?? null })),
      scanned,
    });
  } catch (error) {
    console.error('[admin/crm] error:', error);
    return NextResponse.json({ error: 'Lỗi đọc dữ liệu hành vi.' }, { status: 500 });
  }
}
