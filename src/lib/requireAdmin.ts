import { getAdminAuth } from '@/lib/firebaseAdmin';

/**
 * Gác admin bằng Firebase Custom Claims (`admin: true`) — KHÔNG còn chuỗi bí mật
 * dùng chung như MANICASH_ADMIN_KEY cũ.
 *
 * ID token được Google ký RS256 (khóa bất đối xứng) → không thể giả mạo nếu không
 * có khóa riêng của Google. `checkRevoked=true` để khi thu hồi quyền (revoke refresh
 * token) là mất quyền tức thì, không phải chờ token hết hạn.
 *
 * Cách cấp quyền: chạy 1 lần `node scripts/grant-admin.mjs <email>`.
 */
export interface AdminIdentity {
  uid: string;
  email: string | null;
}

export async function requireAdmin(request: Request): Promise<AdminIdentity | null> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    if (decoded.admin !== true) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
