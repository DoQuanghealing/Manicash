/* ═══ Admin M2 — Danh bạ người dùng & Customer 360 (server-only) ═══
 * Nguồn-sự-thật danh bạ = Firebase Auth (mọi user đăng ký đều có), LEFT-JOIN
 * users/{uid} (thương mại + trạng thái tài khoản). Dữ liệu hành vi (rank/xp/streak)
 * nằm ở users/{uid}/money/state — CHỈ có khi money sync bật (prod hiện OFF) → degrade.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

const LIST_SCAN = 1000;

export interface UserRow {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  disabled: boolean;
  isPremium: boolean;
  plan: string | null; // 'premium' | 'free' | null
  premiumExpiresAt: string | null;
  billingProvider: string | null;
  accountStatus: string; // active | pending_deletion | deleted
  isTestAccount: boolean;
}

function toIso(v: unknown): string | null {
  if (typeof v === 'string') return v;
  const toDate = (v as { toDate?: () => Date } | null | undefined)?.toDate;
  if (typeof toDate === 'function') return toDate.call(v).toISOString();
  return null;
}
function isProActiveDoc(d: Record<string, unknown>, now: number): boolean {
  const flag = d.isPremium === true || d.tier === 'pro' || d.plan === 'premium';
  if (!flag) return false;
  const exp = toIso(d.premiumExpiresAt);
  return exp === null || new Date(exp).getTime() > now;
}

export interface UserListOptions {
  q?: string;
  plan?: string; // '', 'pro', 'free'
  status?: string; // '', 'active', 'pending_deletion'
  includeTest?: boolean; // mặc định false — ẩn tài khoản test
  limit?: number;
}

/** Danh sách user (Auth ⨝ users/{uid}), lọc + tìm trong bộ nhớ. */
export async function listUsers(opts: UserListOptions = {}): Promise<{ rows: UserRow[]; total: number; scanned: number }> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const now = Date.now();

  // Quét Auth theo trang (1000/trang) tới trần LIST_SCAN.
  const records: import('firebase-admin/auth').UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    records.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken && records.length < LIST_SCAN);

  // Batch đọc users/{uid} (getAll tối đa ~ vài trăm/lần cho an toàn).
  const docMap = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < records.length; i += 300) {
    const refs = records.slice(i, i + 300).map((r) => db.doc(`users/${r.uid}`));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) docMap.set(s.id, s.data() ?? {});
  }

  let rows: UserRow[] = records.map((r) => {
    const d = docMap.get(r.uid) ?? {};
    return {
      uid: r.uid,
      email: r.email ?? null,
      displayName: r.displayName ?? (typeof d.displayName === 'string' ? d.displayName : null),
      createdAt: r.metadata.creationTime ? new Date(r.metadata.creationTime).toISOString() : null,
      lastActiveAt: r.metadata.lastRefreshTime
        ? new Date(r.metadata.lastRefreshTime).toISOString()
        : r.metadata.lastSignInTime
          ? new Date(r.metadata.lastSignInTime).toISOString()
          : null,
      disabled: r.disabled,
      isPremium: isProActiveDoc(d, now),
      plan: typeof d.plan === 'string' ? d.plan : null,
      premiumExpiresAt: toIso(d.premiumExpiresAt),
      billingProvider: typeof d.billingProvider === 'string' ? d.billingProvider : null,
      accountStatus: typeof d.accountStatus === 'string' ? d.accountStatus : 'active',
      isTestAccount: d.isTestAccount === true,
    };
  });

  const scanned = rows.length;
  if (!opts.includeTest) rows = rows.filter((r) => !r.isTestAccount);
  if (opts.plan === 'pro') rows = rows.filter((r) => r.isPremium);
  if (opts.plan === 'free') rows = rows.filter((r) => !r.isPremium);
  if (opts.status) rows = rows.filter((r) => r.accountStatus === opts.status);
  const q = (opts.q ?? '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.displayName ?? '').toLowerCase().includes(q) ||
        r.uid.toLowerCase().includes(q),
    );
  }
  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const total = rows.length;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  return { rows: rows.slice(0, limit), total, scanned };
}

export interface CustomerProfile {
  identity: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    disabled: boolean;
    createdAt: string | null;
    lastActiveAt: string | null;
    isAdmin: boolean;
  };
  account: {
    accountStatus: string;
    isTestAccount: boolean;
    deletionRequestedAt: string | null;
    deletionScheduledAt: string | null;
  };
  commerce: {
    isPremium: boolean;
    plan: string | null;
    premiumExpiresAt: string | null;
    billingProvider: string | null;
    totalPaid: number;
    paidOrders: number;
    lastPaidAt: string | null;
    grants: { orderId: string; provider: string; periodDays: number; at: string | null }[];
  };
  behavior: {
    hasCloudState: boolean;
    rank: string | null;
    xp: number | null;
    streak: number | null;
    updatedAt: string | null;
  };
}

/** Hồ sơ Customer 360 cho 1 uid. */
export async function getCustomerProfile(uid: string): Promise<CustomerProfile | null> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const now = Date.now();

  const rec = await auth.getUser(uid).catch(() => null);
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!rec && !userSnap.exists) return null;
  const d = userSnap.data() ?? {};

  // Thương mại: payments_index + grant_events theo uid.
  const [paySnap, grantSnap, cloudSnap] = await Promise.all([
    db.collection('payments_index').where('uid', '==', uid).limit(200).get(),
    db.collection('grant_events').where('uid', '==', uid).limit(200).get(),
    db.doc(`users/${uid}/money/state`).get(),
  ]);

  let totalPaid = 0;
  let lastPaidAt: string | null = null;
  for (const p of paySnap.docs) {
    const x = p.data();
    totalPaid += typeof x.amount === 'number' ? x.amount : 0;
    const at = toIso(x.paidAt);
    if (at && (!lastPaidAt || at > lastPaidAt)) lastPaidAt = at;
  }
  const grants = grantSnap.docs
    .map((g) => {
      const x = g.data();
      return {
        orderId: typeof x.orderId === 'string' ? x.orderId : g.id,
        provider: typeof x.provider === 'string' ? x.provider : 'payos',
        periodDays: typeof x.periodDays === 'number' ? x.periodDays : 0,
        at: toIso(x.at),
      };
    })
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  // Hành vi: cố đọc từ envelope money/state (degrade nếu vắng/khác shape).
  const cloud = cloudSnap.exists ? (cloudSnap.data() ?? {}) : null;
  const authProgress =
    cloud && typeof cloud === 'object' && cloud.authProgress && typeof cloud.authProgress === 'object'
      ? (cloud.authProgress as Record<string, unknown>)
      : null;

  const claims = rec?.customClaims ?? {};

  return {
    identity: {
      uid,
      email: rec?.email ?? null,
      displayName: rec?.displayName ?? (typeof d.displayName === 'string' ? d.displayName : null),
      photoURL: rec?.photoURL ?? null,
      emailVerified: rec?.emailVerified ?? false,
      disabled: rec?.disabled ?? false,
      createdAt: rec?.metadata.creationTime ? new Date(rec.metadata.creationTime).toISOString() : toIso(d.createdAt),
      lastActiveAt: rec?.metadata.lastRefreshTime ? new Date(rec.metadata.lastRefreshTime).toISOString() : null,
      isAdmin: claims.admin === true,
    },
    account: {
      accountStatus: typeof d.accountStatus === 'string' ? d.accountStatus : 'active',
      isTestAccount: d.isTestAccount === true,
      deletionRequestedAt: toIso(d.deletionRequestedAt),
      deletionScheduledAt: toIso(d.deletionScheduledAt),
    },
    commerce: {
      isPremium: isProActiveDoc(d, now),
      plan: typeof d.plan === 'string' ? d.plan : null,
      premiumExpiresAt: toIso(d.premiumExpiresAt),
      billingProvider: typeof d.billingProvider === 'string' ? d.billingProvider : null,
      totalPaid,
      paidOrders: paySnap.size,
      lastPaidAt,
      grants,
    },
    behavior: {
      hasCloudState: !!cloud,
      rank: authProgress && typeof authProgress.rank === 'string' ? authProgress.rank : null,
      xp: authProgress && typeof authProgress.xp === 'number' ? authProgress.xp : null,
      streak: authProgress && typeof authProgress.streak === 'number' ? authProgress.streak : null,
      updatedAt: cloud ? toIso(cloud.updatedAt) : null,
    },
  };
}

/** Thu hồi Pro (set free + hết hạn ngay). Ghi grant_events marker + cập nhật user. */
export async function revokePro(uid: string, actorUid: string): Promise<void> {
  const db = getAdminDb();
  const nowIso = new Date().toISOString();
  await db.doc(`users/${uid}`).set(
    {
      tier: 'free',
      plan: 'free',
      isPremium: false,
      premiumExpiresAt: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await db.collection('grant_events').add({
    uid,
    provider: 'admin',
    periodDays: 0,
    orderId: `revoke:${Date.now()}`,
    revokedBy: actorUid,
    at: nowIso,
  });
}

/** Đánh dấu / bỏ đánh dấu tài khoản test (loại khỏi thống kê R&D). */
export async function setTestFlag(uid: string, isTest: boolean): Promise<void> {
  await getAdminDb().doc(`users/${uid}`).set(
    { isTestAccount: isTest, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
