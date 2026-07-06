/* ═══ Firebase Admin SDK Singleton ═══
 *
 * Server-side only. Lazy-init từ env vars. Throw clear error nếu thiếu credentials.
 *
 * Required env vars (CẢ 3, thiếu 1 là toàn bộ route dùng Admin SDK crash 500):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY  (chứa \n literal — split khi đọc)
 *
 * 2026-07-06: production từng thiếu FIREBASE_ADMIN_PROJECT_ID — mọi route cần Admin
 * SDK (payos/create-link, admin/test-account, quota, grantTrial...) fail 500 im lặng
 * cho tới khi verify lại. Kiểm 3 biến này trên Vercel TRƯỚC khi nghi ngờ code.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

function initAdmin(): App {
  // Reuse existing app nếu đã init (Next.js dev server hot-reload có thể call nhiều lần).
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Private key có \n literal khi paste vào .env — restore newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin not configured. Set FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY in .env.local',
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminApp(): App {
  return initAdmin();
}

export function getAdminDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore(initAdmin());
  }
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(initAdmin());
  }
  return cachedAuth;
}
