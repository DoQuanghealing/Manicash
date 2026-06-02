/* ═══ Phase 13 — AI CFO Narration cache ═══
 * Caches the AI narration per user per month, keyed by a fingerprint of the
 * aggregated input. When this month's numbers are unchanged we reuse the stored
 * narration and DO NOT charge another credit — this is the hard cost lock for
 * repeated report views.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

export interface NarrationCacheEntry {
  fingerprint: string;
  text: string;
}

function cacheDocPath(uid: string, monthKey: string): string {
  return `users/${uid}/cfo_narration/${monthKey}`;
}

export async function readNarrationCache(uid: string, monthKey: string): Promise<NarrationCacheEntry | null> {
  const snap = await getAdminDb().doc(cacheDocPath(uid, monthKey)).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (typeof data.fingerprint !== 'string' || typeof data.text !== 'string') return null;
  return { fingerprint: data.fingerprint, text: data.text };
}

export async function writeNarrationCache(
  uid: string,
  monthKey: string,
  fingerprint: string,
  text: string,
): Promise<void> {
  await getAdminDb()
    .doc(cacheDocPath(uid, monthKey))
    .set(
      {
        uid,
        monthKey,
        fingerprint,
        text,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
