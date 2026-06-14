import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

/**
 * Xác thực uid từ request. Bearer ID token (verifyIdToken) là credential ĐÁNG TIN
 * duy nhất → ưu tiên nó. Cookie `manicash-session` (uid thô, không ký) chỉ là lớp
 * CSRF phụ: nếu CÓ mặt thì phải khớp uid trong token.
 *
 * B-02: trước đây yêu cầu CẢ cookie LẪN Bearer → mobile (Capacitor cross-origin
 * không gửi cookie) bị 401 dù đăng nhập hợp lệ. Nay Bearer-only là đủ.
 */
export async function getVerifiedRequestUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    const sessionUid = request.cookies.get('manicash-session')?.value;
    if (sessionUid && decoded.uid !== sessionUid) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}
