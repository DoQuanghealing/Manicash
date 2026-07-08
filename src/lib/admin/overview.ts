/* ═══ Admin M0/M8 — Overview KPI + Audit (server-only) ═══ */
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { getRevenueSeries, getReconciliation } from '@/lib/monetization/reconcile';

const AUTH_SCAN = 3000;

export interface OverviewKpis {
  revenueToday: number;
  revenue30d: number;
  paidCount30d: number;
  proActive: number;
  dau: number;
  totalUsers: number;
  usersCapped: boolean;
  queues: {
    deletionPending: number;
    paidNotGranted: number;
  };
  generatedAt: string;
}

function toMs(v: unknown): number | null {
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const toDate = (v as { toDate?: () => Date } | null | undefined)?.toDate;
  if (typeof toDate === 'function') return toDate.call(v).getTime();
  return null;
}

export async function getOverviewKpis(): Promise<OverviewKpis> {
  const db = getAdminDb();
  const auth = getAdminAuth();
  const now = Date.now();
  const dayAgo = now - 86_400_000;

  // Doanh thu (reuse chuỗi 30 ngày).
  const revenue = await getRevenueSeries(30);
  const revenueToday = revenue.points.length ? revenue.points[revenue.points.length - 1].amount : 0;

  // Quét Auth: totalUsers + DAU (lastRefreshTime trong 24h).
  let totalUsers = 0;
  let dau = 0;
  let pageToken: string | undefined;
  let capped = false;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      totalUsers += 1;
      const last = u.metadata.lastRefreshTime ? new Date(u.metadata.lastRefreshTime).getTime() : 0;
      if (last >= dayAgo) dau += 1;
    }
    pageToken = res.pageToken;
    if (totalUsers >= AUTH_SCAN) {
      capped = !!pageToken;
      break;
    }
  } while (pageToken);

  // Pro active: users.isPremium==true, lọc hạn trong bộ nhớ.
  let proActive = 0;
  try {
    const proSnap = await db.collection('users').where('isPremium', '==', true).get();
    for (const s of proSnap.docs) {
      const d = s.data();
      const exp = toMs(d.premiumExpiresAt);
      if (exp === null || exp > now) proActive += 1;
    }
  } catch {
    /* thiếu index/field → 0 */
  }

  // Hàng đợi.
  let deletionPending = 0;
  try {
    const delSnap = await db.collection('account_deletion_requests').where('status', '==', 'pending').get();
    deletionPending = delSnap.size;
  } catch {
    /* ignore */
  }
  const recon = await getReconciliation();

  return {
    revenueToday,
    revenue30d: revenue.totalAmount,
    paidCount30d: revenue.totalCount,
    proActive,
    dau,
    totalUsers,
    usersCapped: capped,
    queues: {
      deletionPending,
      paidNotGranted: recon.paidNotGranted.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export interface DeletionRequestRow {
  uid: string;
  email: string | null;
  status: string;
  reason: string | null;
  requestedAt: string | null;
  scheduledAt: string | null;
}

/** Danh sách yêu cầu xóa tài khoản (mặc định pending trước). */
export async function listDeletionRequests(limit = 100): Promise<DeletionRequestRow[]> {
  const snap = await getAdminDb().collection('account_deletion_requests').limit(limit).get();
  const rows: DeletionRequestRow[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      uid: typeof x.uid === 'string' ? x.uid : d.id,
      email: typeof x.email === 'string' ? x.email : null,
      status: typeof x.status === 'string' ? x.status : 'pending',
      reason: typeof x.reason === 'string' ? x.reason : null,
      requestedAt: typeof x.requestedAt === 'string' ? x.requestedAt : null,
      scheduledAt: typeof x.scheduledAt === 'string' ? x.scheduledAt : null,
    };
  });
  const rank: Record<string, number> = { pending: 0, cancelled: 1, completed: 2 };
  rows.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
  return rows;
}
