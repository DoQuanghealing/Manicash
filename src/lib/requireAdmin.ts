import { getAdminAuth } from '@/lib/firebaseAdmin';
import { isAdminEmail } from '@/lib/adminEmails';

/**
 * Gác admin bằng BA lớp độc lập — KHÔNG còn chuỗi bí mật dùng chung như
 * MANICASH_ADMIN_KEY cũ:
 *   1. Firebase Custom Claim `admin === true` (ID token ký RS256, không giả được).
 *   2. Email nằm trong allowlist (`isAdminEmail`) — chốt đúng một người, chặn mọi
 *      email khác kể cả khi bị set nhầm claim.
 *   3. Email đã xác minh (`email_verified !== false`).
 * `checkRevoked=true` để thu hồi quyền có hiệu lực tức thì (không chờ token hết hạn).
 *
 * Cách cấp quyền: chạy 1 lần `node scripts/grant-admin.mjs <email>` (email phải
 * nằm trong allowlist ở src/lib/adminEmails.ts).
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
    if (!isAdminEmail(decoded.email)) return null;
    if (decoded.email_verified === false) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
