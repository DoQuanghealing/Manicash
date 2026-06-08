/* ═══ Next.js Instrumentation — Boot-time License Gate + Telemetry (Phase 5) ═══
 * register() chạy một lần khi server khởi động.
 *
 * AN TOÀN có chủ đích:
 *  - Bỏ qua hoàn toàn trong giai đoạn build (không brick `next build`).
 *  - Production runtime thiếu license -> THROW (fail-loud, chặn phục vụ).
 *  - Development -> chỉ cảnh báo, vẫn chạy (không làm phiền dev).
 */

import { isLicenseValid, LICENSE_ERROR_MESSAGE } from '@/lib/aiMoneyChat/security/license';
import { phoneHome } from '@/lib/aiMoneyChat/security/telemetry';

export async function register(): Promise<void> {
  // Không chặn lúc build production.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isLicenseValid()) {
    if (isProduction) {
      // Fail-loud: chặn server phục vụ khi không có license hợp lệ.
      throw new Error(LICENSE_ERROR_MESSAGE);
    }
    console.warn(`[license] ${LICENSE_ERROR_MESSAGE} (development: tiếp tục chạy)`);
  }

  // Telemetry chỉ ở production runtime.
  if (isProduction) {
    await phoneHome();
  }
}
