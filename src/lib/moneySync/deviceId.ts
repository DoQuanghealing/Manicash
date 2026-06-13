/* ═══ Money Sync — Device ID (Phase 6B-2A) ═══
 * Stable, non-secret identifier cho browser session. Dùng trong cloud doc
 * để debug multi-device conflicts. Không phải secret.
 */
const DEVICE_ID_KEY = 'manicash-money-device-id';

function generateId(): string {
  // crypto.randomUUID() available in modern browsers + Node 14.17+
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `dev-${rand}`;
}

/**
 * Trả device id stable cho browser hiện tại (localStorage).
 * - Lần 1: tạo mới + lưu.
 * - Lần 2+: đọc lại.
 * - SSR-safe: trả 'ssr-device' khi không có localStorage.
 * - Lỗi localStorage: trả id tạm (không persist).
 */
export function getOrCreateMoneyDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'ssr-device';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim().length > 0) return existing;
    const newId = generateId();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return `fallback-${Date.now().toString(36)}`;
  }
}
