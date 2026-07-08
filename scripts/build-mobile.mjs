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
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();

/**
 * Đọc file .env đơn giản (KEY=VALUE mỗi dòng, bỏ comment). Dùng cho .env.mobile
 * — config riêng cho mobile build, không ảnh hưởng .env.local của web.
 */
function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// .env.mobile (gitignored) > shell env. Next không override process.env đã set,
// nên giá trị này thắng .env.local lúc build.
const mobileEnv = loadEnvFile(join(root, '.env.mobile'));
const apiBase = mobileEnv.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';

if (!apiBase) {
  console.warn('\n\x1b[33m⚠️  NEXT_PUBLIC_API_BASE_URL chưa set!\x1b[0m');
  console.warn('   Bundle mobile sẽ gọi API same-origin (/api/...) → KHÔNG chạy trong Capacitor');
  console.warn('   (app ở https://localhost, không có /api). Tạo .env.mobile:');
  console.warn('     NEXT_PUBLIC_API_BASE_URL=https://<url-api-vercel>');
  console.warn('   Bỏ qua cảnh báo này nếu chỉ build để test UI.\n');
} else {
  console.log(`\n\x1b[32m✓ API base URL (mobile): ${apiBase}\x1b[0m\n`);
}

/** Cặp (live ⇄ park): vị trí thật và vị trí tạm khi build mobile. */
const PARKED = [
  { live: join(root, 'src', 'app', 'api'), park: join(root, 'src', 'app', '_api.parked') },
  { live: join(root, 'src', 'proxy.ts'), park: join(root, 'src', '_proxy.parked.ts') },
  // Route group (admin) chỉ dùng trên web (Vercel) — gỡ khỏi static export mobile
  // để không đóng gói dashboard quản trị vào bundle Android.
  { live: join(root, 'src', 'app', '(admin)'), park: join(root, 'src', 'app', '_admin.parked') },
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
    env: { ...process.env, ...mobileEnv, BUILD_TARGET: 'mobile' },
    cwd: root,
  });
} finally {
  restore();
}
