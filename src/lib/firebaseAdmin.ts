/* ═══ Firebase Admin SDK Singleton ═══
 *
 * Server-side only. Lazy-init từ env vars. Throw clear error nếu thiếu credentials.
 *
 * Required env vars:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY  (chứa \n literal — split khi đọc)
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;

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
