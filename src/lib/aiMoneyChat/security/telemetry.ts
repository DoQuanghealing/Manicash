/* ═══ ManiCash — Boot Telemetry "Phone Home" — Phase 5 ═══
 * Mã hóa domain hiện tại thành fingerprint hash để Product Owner phát hiện mã
 * nguồn chạy lậu ở domain lạ. KHÔNG gửi dữ liệu người dùng — chỉ hash domain.
 */

/** Hash sha256 (16 hex) của domain — định danh nguồn chạy mà không lộ URL thô.
 *  Dùng Web Crypto (globalThis.crypto.subtle) thay cho node:crypto để chạy được
 *  cả trong Edge Runtime (instrumentation) — trước đây `import 'crypto'` gây lỗi
 *  build "Ecmascript file had an error" ở Edge. */
export async function getDomainFingerprint(
  url: string = process.env.NEXT_PUBLIC_APP_URL ?? 'unknown',
): Promise<string> {
  const bytes = new TextEncoder().encode(url);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Ghi nhật ký vận hành lúc boot. Nếu có MANICASH_TELEMETRY_URL thì POST
 * fingerprint (fire-and-forget, nuốt lỗi để không ảnh hưởng boot).
 */
export async function phoneHome(): Promise<void> {
  const fingerprint = await getDomainFingerprint();
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
