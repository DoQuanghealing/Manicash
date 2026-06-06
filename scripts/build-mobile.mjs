/**
 * build-mobile.mjs — build static export cho Capacitor (Android).
 *
 * Static export (output: 'export') KHÔNG chứa được API route handlers (dùng
 * Request) hay proxy.ts (middleware). Script này tạm "park" hai thứ đó ra ngoài
 * cây build, chạy `next build` với BUILD_TARGET=mobile, rồi khôi phục lại —
 * kể cả khi build lỗi (try/finally). Web/API build (`npm run build`) không bị
 * ảnh hưởng vì vẫn thấy đủ app/api + proxy.ts.
 *
 * Output: out/  (static HTML/JS/CSS) — webDir cho capacitor.config.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();

/** Cặp (live ⇄ park): vị trí thật và vị trí tạm khi build mobile. */
const PARKED = [
  { live: join(root, 'src', 'app', 'api'), park: join(root, 'src', 'app', '_api.parked') },
  { live: join(root, 'src', 'proxy.ts'), park: join(root, 'src', '_proxy.parked.ts') },
];

/** Đưa mọi thứ về đúng chỗ (park → live). No-op nếu không có gì parked. */
function restore() {
  for (const { live, park } of PARKED) {
    if (existsSync(park)) {
      if (existsSync(live)) rmSync(live, { recursive: true, force: true });
      renameSync(park, live);
    }
  }
}

/** Gỡ live ra park để static export không thấy. */
function park() {
  for (const { live, park } of PARKED) {
    if (existsSync(live)) renameSync(live, park);
  }
}

// Dọn tàn dư từ lần chạy crash trước (nếu có), rồi park.
restore();
park();

// Xóa .next để bỏ type validators cũ (từ next dev / web build) vẫn trỏ tới
// các API route vừa park — nếu không tsc sẽ fail "Cannot find module .../route.js".
rmSync(join(root, '.next'), { recursive: true, force: true });

try {
  // Gọi thẳng next binary qua node — không phụ thuộc PATH/.bin, không cần shell
  // (tránh deprecation warning DEP0190), chạy được dù gọi trực tiếp hay qua npm.
  const require = createRequire(import.meta.url);
  const nextBin = require.resolve('next/dist/bin/next');
  execFileSync(process.execPath, [nextBin, 'build'], {
    stdio: 'inherit',
    env: { ...process.env, BUILD_TARGET: 'mobile' },
    cwd: root,
  });
} finally {
  restore();
}
