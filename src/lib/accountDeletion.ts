import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const ACCOUNT_DELETION_GRACE_DAYS = 30;

export type AccountDeletionStatus = 'pending' | 'cancelled' | 'completed';

export interface AccountDeletionSnapshot {
  uid: string;
  accountStatus: 'active' | 'pending_deletion' | 'deleted';
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  deletionReason: string | null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }
  return null;
}

function requestRef(uid: string) {
  return getAdminDb().collection('account_deletion_requests').doc(uid);
}

export async function getAccountDeletionSnapshot(
  uid: string,
): Promise<AccountDeletionSnapshot> {
  const snap = await getAdminDb().collection('users').doc(uid).get();
  const data = snap.data() || {};

  return {
    uid,
    accountStatus: data.accountStatus || 'active',
    deletionRequestedAt: toIso(data.deletionRequestedAt),
    deletionScheduledAt: toIso(data.deletionScheduledAt),
    deletionReason: data.deletionReason || null,
  };
}

export async function requestAccountDeletion(
  uid: string,
  reason?: string,
): Promise<AccountDeletionSnapshot> {
  const now = new Date();
  const scheduledAt = addDays(now, ACCOUNT_DELETION_GRACE_DAYS);
  const db = getAdminDb();
  const userRef = db.collection('users').doc(uid);
  const authUser = await getAdminAuth().getUser(uid).catch(() => null);
  const safeReason = reason?.trim().slice(0, 500) || null;

  await db.runTransaction(async (tx) => {
    tx.set(
      userRef,
      {
        accountStatus: 'pending_deletion',
        deletionMode: 'grace_30d',
        deletionReason: safeReason,
        deletionRequestedAt: now.toISOString(),
        deletionScheduledAt: scheduledAt.toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(
      requestRef(uid),
      {
        uid,
        email: authUser?.email || null,
        status: 'pending' satisfies AccountDeletionStatus,
        reason: safeReason,
        requestedAt: now.toISOString(),
        scheduledAt: scheduledAt.toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return getAccountDeletionSnapshot(uid);
}

export async function cancelAccountDeletion(
  uid: string,
): Promise<AccountDeletionSnapshot> {
  const nowIso = new Date().toISOString();
  const db = getAdminDb();

  await db.runTransaction(async (tx) => {
    tx.set(
      db.collection('users').doc(uid),
      {
        accountStatus: 'active',
        deletionCancelledAt: nowIso,
        deletionRequestedAt: FieldValue.delete(),
        deletionScheduledAt: FieldValue.delete(),
        deletionReason: FieldValue.delete(),
        deletionMode: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(
      requestRef(uid),
      {
        uid,
        status: 'cancelled' satisfies AccountDeletionStatus,
        cancelledAt: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return getAccountDeletionSnapshot(uid);
}

async function deleteIfExists(path: string): Promise<void> {
  const ref = getAdminDb().doc(path);
  const snap = await ref.get();
  if (snap.exists) {
    await getAdminDb().recursiveDelete(ref);
  }
}

export async function permanentlyDeleteAccount(uid: string): Promise<void> {
  const auth = getAdminAuth();
  const nowIso = new Date().toISOString();
  const authUser = await auth.getUser(uid).catch(() => null);

  await requestRef(uid).set(
    {
      uid,
      email: authUser?.email || null,
      status: 'completed' satisfies AccountDeletionStatus,
      completedAt: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await Promise.all([
    deleteIfExists(`users/${uid}`),
    deleteIfExists(`webhook_tokens/${uid}`),
  ]);

  await auth.deleteUser(uid).catch((error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'auth/user-not-found'
    ) {
      return;
    }
    throw error;
  });
}

export async function completeDueAccountDeletions(limit = 50): Promise<{
  checked: number;
  completed: number;
  failed: Array<{ uid: string; error: string }>;
}> {
  const nowIso = new Date().toISOString();
  const snap = await getAdminDb()
    .collection('account_deletion_requests')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', nowIso)
    .limit(limit)
    .get();

  let completed = 0;
  const failed: Array<{ uid: string; error: string }> = [];

  for (const doc of snap.docs) {
    const uid = doc.get('uid') as string | undefined;
    if (!uid) continue;
    try {
      await permanentlyDeleteAccount(uid);
      completed += 1;
    } catch (error) {
      failed.push({
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { checked: snap.size, completed, failed };
}
