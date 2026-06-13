/* ═══ Money Sync — Feature Flag (Phase 6B-2E) ═══
 * Bật/tắt cloud sync PRODUCTION. MẶC ĐỊNH TẮT — toàn bộ wiring remote chỉ chạy
 * khi flag bật. Default app behavior KHÔNG đổi cho tới khi PO bật cờ.
 *
 * Bật bằng env: NEXT_PUBLIC_MONEY_SYNC_ENABLED=true
 * Test override qua __setMoneySyncEnabledForTests (reset = null).
 *
 * Override lưu trên globalThis (KHÔNG phải module-local) để chia sẻ đúng kể cả
 * khi module bị nạp 2 instance (alias '@/...' vs relative './...') dưới jiti.
 */

const OVERRIDE_KEY = '__manicashMoneySyncFlagOverride__';

type GlobalWithFlag = typeof globalThis & { [OVERRIDE_KEY]?: boolean };

/** True khi cloud sync production được bật (override test hoặc env). */
export function isMoneySyncEnabled(): boolean {
  const override = (globalThis as GlobalWithFlag)[OVERRIDE_KEY];
  if (typeof override === 'boolean') return override;
  return process.env.NEXT_PUBLIC_MONEY_SYNC_ENABLED === 'true';
}

/** Test-only: ép trạng thái flag; truyền null để trả về đọc env. */
export function __setMoneySyncEnabledForTests(value: boolean | null): void {
  const g = globalThis as GlobalWithFlag;
  if (value === null) {
    delete g[OVERRIDE_KEY];
  } else {
    g[OVERRIDE_KEY] = value;
  }
}
