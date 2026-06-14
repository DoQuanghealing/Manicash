/* ═══ PayOS client (server-only) ═══
 * Khởi tạo SDK @payos/node v2 từ env. Fail-fast nếu thiếu key (rõ ràng thay vì lỗi
 * mơ hồ giữa luồng thanh toán). Base URL mặc định https://api-merchant.payos.vn.
 */
import { PayOS } from '@payos/node';

let cached: PayOS | null = null;

/** Đủ 3 key server-side để gọi PayOS. */
export function isPayosConfigured(): boolean {
  return Boolean(
    process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY,
  );
}

/** Cờ bật luồng PayOS phía client (UI quyết định gọi PayOS hay placeholder). */
export function isPayosEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYOS_ENABLED === 'true';
}

export function getPayos(): PayOS {
  if (!isPayosConfigured()) {
    throw new Error('PayOS chưa cấu hình (thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY).');
  }
  if (!cached) {
    cached = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID!,
      apiKey: process.env.PAYOS_API_KEY!,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY!,
    });
  }
  return cached;
}
