/**
 * Cấp / thu hồi quyền admin (Firebase Custom Claim `admin: true`) cho 1 tài khoản.
 *
 * Chạy 1 lần, local, dùng service account trong .env.local — KHÔNG cần deploy.
 *
 *   node scripts/grant-admin.mjs doduongquang8686@gmail.com        # cấp quyền
 *   node scripts/grant-admin.mjs doduongquang8686@gmail.com --revoke  # thu hồi
 *
 * Sau khi cấp: tài khoản đó phải ĐĂNG XUẤT → ĐĂNG NHẬP LẠI trong app để ID token
 * mới có cờ admin (hoặc chờ token tự làm mới ~1 giờ).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Đọc .env.local (parser tối giản, không cần gói dotenv) ──────────────────
function loadEnv() {
  const path = resolve(__dirname, '..', '.env.local');
  const env = {};
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error(`✖ Không đọc được ${path}. Chạy script từ gốc dự án.`);
    process.exit(1);
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
  return env;
}

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');
  if (!email || email.startsWith('--')) {
    console.error('Cách dùng: node scripts/grant-admin.mjs <email> [--revoke]');
    process.exit(1);
  }

  const env = loadEnv();
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('✖ Thiếu FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY trong .env.local');
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`✖ Không tìm thấy tài khoản Firebase Auth với email: ${email}`);
    console.error('  (Đây phải là email ĐĂNG NHẬP APP, không phải email sở hữu Firebase Console.)');
    process.exit(1);
  }

  const claims = { ...(user.customClaims ?? {}) };
  if (revoke) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }
  await auth.setCustomUserClaims(user.uid, claims);
  // Thu hồi refresh token để claim mới (hoặc việc gỡ quyền) có hiệu lực tức thì.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`✔ ${revoke ? 'Đã THU HỒI' : 'Đã CẤP'} quyền admin cho ${email} (uid=${user.uid})`);
  console.log(`  Claims hiện tại: ${JSON.stringify(claims)}`);
  console.log('  → Tài khoản này cần ĐĂNG XUẤT rồi ĐĂNG NHẬP LẠI trong app để áp dụng.');
  process.exit(0);
}

main().catch((err) => {
  console.error('✖ Lỗi:', err);
  process.exit(1);
});
