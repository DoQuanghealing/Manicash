/**
 * apiBase — API base URL indirection cho dual build target.
 *
 * - Web build (Vercel, mặc định): NEXT_PUBLIC_API_BASE_URL không set → '' →
 *   fetch gọi same-origin (/api/...), hành vi y như hiện tại.
 * - Mobile build (Capacitor static export): set NEXT_PUBLIC_API_BASE_URL =
 *   origin của API đã deploy (vd https://manicash.vercel.app) → fetch gọi
 *   tới API remote vì app chạy ở capacitor://localhost không có /api riêng.
 *
 * Biến NEXT_PUBLIC_* được inline lúc build, nên giá trị cố định theo từng bản build.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/**
 * Ghép base URL vào đường dẫn API. `path` nên bắt đầu bằng '/'.
 * Khi base rỗng (web) trả về path nguyên bản → same-origin.
 */
export function apiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}
