/* ═══ ManiCash — Boot Telemetry "Phone Home" — Phase 5 ═══
 * Mã hóa domain hiện tại thành fingerprint hash để Product Owner phát hiện mã
 * nguồn chạy lậu ở domain lạ. KHÔNG gửi dữ liệu người dùng — chỉ hash domain.
 */

import { createHash } from 'crypto';

/** Hash sha256 (16 hex) của domain — định danh nguồn chạy mà không lộ URL thô. */
export function getDomainFingerprint(url: string = process.env.NEXT_PUBLIC_APP_URL ?? 'unknown'): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/**
 * Ghi nhật ký vận hành lúc boot. Nếu có MANICASH_TELEMETRY_URL thì POST
 * fingerprint (fire-and-forget, nuốt lỗi để không ảnh hưởng boot).
 */
export async function phoneHome(): Promise<void> {
  const fingerprint = getDomainFingerprint();
  console.info(`[manicash-telemetry] boot origin=${fingerprint}`);

  const endpoint = process.env.MANICASH_TELEMETRY_URL;
  if (!endpoint) return;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, at: new Date().toISOString() }),
    });
  } catch {
    // nuốt lỗi — telemetry không bao giờ được làm gãy boot.
  }
}
