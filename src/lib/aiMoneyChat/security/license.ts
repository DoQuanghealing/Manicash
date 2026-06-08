/* ═══ ManiCash — License Gate (Fail-Loud) — Phase 5 ═══
 * Bảo vệ bản quyền theo cơ chế AN TOÀN: từ chối phục vụ khi thiếu license,
 * KHÔNG bao giờ làm sai lệch dữ liệu tài chính của người dùng.
 *
 * Triết lý:
 *  - Production runtime thiếu/sai key -> fail-loud (throw / 503), tường minh.
 *  - Dev/test/build -> KHÔNG chặn (tránh brick workflow của chính dev).
 */

export const LICENSE_ERROR_MESSAGE = 'ManiCash Core Service: License Key Invalid or Missing.';

const MIN_KEY_LENGTH = 8;

/**
 * True nếu được phép phục vụ.
 *  - Không phải production -> luôn true (không chặn dev/test).
 *  - Production -> cần MANICASH_LICENSE_KEY hợp lệ (>= 8 ký tự).
 * Tham số inject được để test không phụ thuộc môi trường thật.
 */
export function isLicenseValid(
  key: string | undefined = process.env.MANICASH_LICENSE_KEY,
  isProduction: boolean = process.env.NODE_ENV === 'production',
): boolean {
  if (!isProduction) return true;
  return typeof key === 'string' && key.trim().length >= MIN_KEY_LENGTH;
}

/** Ném lỗi fail-loud nếu license không hợp lệ (dùng ở boot-time). */
export function assertLicenseOrThrow(): void {
  if (!isLicenseValid()) {
    throw new Error(LICENSE_ERROR_MESSAGE);
  }
}
