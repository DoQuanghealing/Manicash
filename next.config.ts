import type { NextConfig } from 'next';

/**
 * Dual build target:
 * - Mặc định (web/API): build đầy đủ Next.js — API routes + proxy hoạt động,
 *   deploy lên Vercel. Đây cũng là API backend mà bản mobile gọi tới.
 * - BUILD_TARGET=mobile: static export (`out/`) để Capacitor đóng gói Android.
 *   API routes + proxy được prebuild script (scripts/build-mobile.mjs) tạm gỡ
 *   trước khi build vì static export không hỗ trợ chúng.
 */
const isMobileExport = process.env.BUILD_TARGET === 'mobile';

const nextConfig: NextConfig = isMobileExport
  ? {
      output: 'export',
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      /* Web/API build — Turbopack default, route handlers + proxy active */
    };

export default nextConfig;
