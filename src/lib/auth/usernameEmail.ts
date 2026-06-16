/* ═══ Username ↔ email ẩn (đăng nhập ID/mật khẩu cho tài khoản test) ═══
 * Tài khoản test do ADMIN tạo (Firebase Admin SDK) với email TỔNG HỢP suy ra từ
 * username → đăng nhập bằng signInWithEmailAndPassword(emailẩn, password). Không lộ
 * email thật, không cần tra cứu. PURE (no firebase) → client + server dùng chung.
 */

/** Domain ẩn — KHÔNG nhận mail thật; chỉ để Firebase email/password hoạt động. */
export const TEST_EMAIL_DOMAIN = 'id.manicash.app';

/** Chuẩn hóa: trim + lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Username hợp lệ: 3–20 ký tự [a-z0-9_] (an toàn cho local-part email). */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

/** username → email ẩn deterministic (đã chuẩn hóa). */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${TEST_EMAIL_DOMAIN}`;
}
