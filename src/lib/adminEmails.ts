/**
 * Allowlist email admin — LỚP KHÓA CỨNG thứ hai bên cạnh Firebase Custom Claim.
 *
 * Kể cả khi một tài khoản bị set nhầm/cố tình claim `admin`, vẫn phải nằm trong
 * danh sách này MỚI vào được admin. Đây là lớp "chốt đúng một người" theo yêu cầu:
 * chỉ doduongquang8686@gmail.com có quyền admin, mọi email khác bị chặn.
 *
 * Email admin KHÔNG phải bí mật — bảo mật thật nằm ở (1) Custom Claim ký RS256 +
 * (2) verify server-side. Allowlist chỉ thu hẹp "ai được phép" xuống đúng 1 email.
 *
 * Module isomorphic: client dùng để ẩn/hiện nút; server (requireAdmin) dùng để CHẶN thật.
 */
export const ADMIN_EMAILS: readonly string[] = [
  'doduongquang8686@gmail.com',
  'freshlife1381@gmail.com', // PO — tài khoản test (2026-07-22), vào admin để bỏ qua mua test full
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
