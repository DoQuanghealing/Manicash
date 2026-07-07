/* ═══ Admin — Tài khoản TEST (tạo/liệt kê/xóa) ═══
 * Admin tạo sẵn tài khoản test (username + mật khẩu) cho bạn bè đăng nhập xem app —
 * KHÔNG mở đăng ký công khai (chống hacker spam). Admin SDK tạo Firebase user với email
 * ẩn + profile (isTestAccount). Dọn dẹp: xóa user + profile.
 * Gác bằng Firebase Custom Claims (requireAdmin) — không còn key tĩnh.
 */
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { isValidUsername, normalizeUsername, usernameToEmail } from '@/lib/auth/usernameEmail';
import { requireAdmin } from '@/lib/requireAdmin';
import { logAdminAction } from '@/lib/adminAudit';

/* POST — tạo tài khoản test { username, password, displayName? } */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const username = normalizeUsername(typeof b.username === 'string' ? b.username : '');
  const password = typeof b.password === 'string' ? b.password : '';
  const displayName = typeof b.displayName === 'string' && b.displayName.trim() ? b.displayName.trim() : username;

  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Username phải 3–20 ký tự a-z, 0-9, _' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu tối thiểu 6 ký tự.' }, { status: 400 });
  }

  try {
    const auth = getAdminAuth();
    const user = await auth.createUser({ email: usernameToEmail(username), password, displayName });

    await getAdminDb().doc(`users/${user.uid}`).set({
      uid: user.uid,
      displayName,
      username,
      email: '', // email thật trống — xác thực sau nếu chuyển thành tài khoản mua
      photoURL: null,
      rank: 'iron',
      xp: 0,
      streak: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
      resistCount: 0,
      totalResistSaved: 0,
      isPremium: false,
      plan: 'free',
      premiumExpiresAt: null,
      accountStatus: 'active',
      isTestAccount: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logAdminAction(admin, 'testAccount.create', { uid: user.uid, username });
    return NextResponse.json({ ok: true, uid: user.uid, username });
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Username đã tồn tại.' }, { status: 409 });
    }
    console.error('[admin/test-account] create error:', error);
    return NextResponse.json({ error: 'Không tạo được tài khoản.' }, { status: 500 });
  }
}

/* GET — liệt kê tài khoản test (uid, username, createdAt) */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const snap = await getAdminDb().collection('users').where('isTestAccount', '==', true).get();
    const accounts = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        username: typeof data.username === 'string' ? data.username : '',
        displayName: typeof data.displayName === 'string' ? data.displayName : '',
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[admin/test-account] list error:', error);
    return NextResponse.json({ error: 'Không đọc được danh sách.' }, { status: 500 });
  }
}

/* DELETE — xóa tài khoản test { uid } (dọn dẹp sau test) */
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const uid = typeof (body as Record<string, unknown>)?.uid === 'string' ? ((body as Record<string, unknown>).uid as string) : '';
  if (!uid) return NextResponse.json({ error: 'Thiếu uid.' }, { status: 400 });

  try {
    const db = getAdminDb();
    const docSnap = await db.doc(`users/${uid}`).get();
    if (!docSnap.data()?.isTestAccount) {
      return NextResponse.json({ error: 'Chỉ xóa được tài khoản test.' }, { status: 403 });
    }
    await getAdminAuth().deleteUser(uid).catch(() => {});
    await db.doc(`users/${uid}`).delete().catch(() => {});
    await logAdminAction(admin, 'testAccount.delete', { uid });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/test-account] delete error:', error);
    return NextResponse.json({ error: 'Không xóa được tài khoản.' }, { status: 500 });
  }
}
