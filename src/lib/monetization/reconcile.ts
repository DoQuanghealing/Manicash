/* ═══ Admin M1 — Đối soát tiền (server-only, Admin SDK) ═══
 * Đọc payment_intents + grant_events để (1) liệt kê đơn hàng, (2) tìm 3 nhóm lệch
 * nguy hiểm nhất về tiền:
 *   A. paid-chưa-grant  — đơn đã 'paid' nhưng KHÔNG có grant_events tương ứng.
 *   B. pending quá lâu   — intent 'pending'/'amount_mismatch' > NGƯỠNG phút (có thể
 *                          khách đã trả ở PayOS mà webhook miss).
 *   C. grant lạ (orphan) — grant_events trỏ tới orderId không có intent (bất thường).
 * Quy mô sớm còn nhỏ → fetch có giới hạn rồi lọc trong bộ nhớ, tránh phải deploy
 * composite index. Nâng cấp sang query có index khi số đơn lớn.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { getPayos, isPayosConfigured } from '@/lib/monetization/payosClient';
import { applyPaidOrderAtomic, type PaidOutcome } from '@/lib/monetization/payosGrant';
import { computeProExpiry, PRO_PERIOD_DAYS } from '@/lib/monetization/entitlement';

const SCAN_LIMIT = 1000; // trần đọc mỗi collection (đủ cho giai đoạn sớm)
const STALE_PENDING_MINUTES = 30;

export interface OrderRow {
  orderCode: string;
  uid: string;
  email: string | null;
  plan: string;
  amount: number;
  status: string;
  createdAt: string | null;
  paidAt: string | null;
  hasGrant: boolean;
}

export interface OrphanGrantRow {
  orderId: string;
  uid: string;
  email: string | null;
  provider: string;
  at: string | null;
}

export interface ReconcileReport {
  paidNotGranted: OrderRow[];
  pendingStale: OrderRow[];
  orphanGrants: OrphanGrantRow[];
  scannedIntents: number;
  scannedGrants: number;
  generatedAt: string;
}

interface RawIntent {
  orderCode: string;
  uid: string;
  plan: string;
  amount: number;
  periodDays: number;
  status: string;
  createdAt: string | null;
  paidAt: string | null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}
function isoOrNull(v: unknown): string | null {
  if (typeof v === 'string') return v;
  const toDate = (v as { toDate?: () => Date } | null | undefined)?.toDate;
  if (typeof toDate === 'function') return toDate.call(v).toISOString();
  return null;
}

/** Đọc payment_intents mới nhất (theo createdAt desc, ISO nên so chuỗi = so thời gian). */
async function scanIntents(): Promise<RawIntent[]> {
  const snap = await getAdminDb()
    .collection('payment_intents')
    .orderBy('createdAt', 'desc')
    .limit(SCAN_LIMIT)
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      orderCode: d.id,
      uid: str(x.uid),
      plan: str(x.plan) || 'monthly',
      amount: num(x.amount),
      periodDays: typeof x.periodDays === 'number' ? x.periodDays : PRO_PERIOD_DAYS,
      status: str(x.status) || 'pending',
      createdAt: isoOrNull(x.createdAt),
      paidAt: isoOrNull(x.paidAt),
    };
  });
}

/** Đọc grant_events → map orderId → uid, và tập orderId đã cấp. */
async function scanGrants(): Promise<{ byOrder: Map<string, { uid: string; provider: string; at: string | null }>; count: number }> {
  const snap = await getAdminDb().collection('grant_events').limit(SCAN_LIMIT).get();
  const byOrder = new Map<string, { uid: string; provider: string; at: string | null }>();
  for (const d of snap.docs) {
    const x = d.data();
    const orderId = str(x.orderId);
    if (!orderId) continue;
    byOrder.set(orderId, { uid: str(x.uid), provider: str(x.provider) || 'payos', at: isoOrNull(x.at) });
  }
  return { byOrder, count: snap.size };
}

/** Phân giải email cho danh sách uid (batch tối đa 100/lần qua Admin Auth). */
async function resolveEmails(uids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100).map((uid) => ({ uid }));
    try {
      const res = await getAdminAuth().getUsers(batch);
      for (const u of res.users) out.set(u.uid, u.email ?? null);
    } catch {
      /* bỏ qua batch lỗi — email chỉ là hiển thị phụ */
    }
  }
  return out;
}

function toRow(it: RawIntent, hasGrant: boolean, emails: Map<string, string | null>): OrderRow {
  return {
    orderCode: it.orderCode,
    uid: it.uid,
    email: emails.get(it.uid) ?? null,
    plan: it.plan,
    amount: it.amount,
    status: it.status,
    createdAt: it.createdAt,
    paidAt: it.paidAt,
    hasGrant,
  };
}

export interface ListOptions {
  status?: string; // '', 'pending', 'paid', 'amount_mismatch', 'create_failed'
  plan?: string; // '', 'monthly', 'half_year', 'yearly'
  q?: string; // khớp email hoặc orderCode
  limit?: number;
}

/** Danh sách đơn (đã lọc + đánh dấu hasGrant), mới nhất trước. */
export async function listOrders(opts: ListOptions = {}): Promise<{ rows: OrderRow[]; total: number }> {
  const [intents, grants] = await Promise.all([scanIntents(), scanGrants()]);
  const emails = await resolveEmails(intents.map((i) => i.uid));
  const q = (opts.q ?? '').trim().toLowerCase();

  let rows = intents.map((it) => toRow(it, grants.byOrder.has(it.orderCode), emails));
  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  if (opts.plan) rows = rows.filter((r) => r.plan === opts.plan);
  if (q) {
    rows = rows.filter(
      (r) => r.orderCode.includes(q) || (r.email ?? '').toLowerCase().includes(q) || r.uid.toLowerCase().includes(q),
    );
  }
  const total = rows.length;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  return { rows: rows.slice(0, limit), total };
}

/** 3 nhóm lệch tiền. */
export async function getReconciliation(): Promise<ReconcileReport> {
  const [intents, grants] = await Promise.all([scanIntents(), scanGrants()]);
  const emails = await resolveEmails([
    ...intents.map((i) => i.uid),
    ...[...grants.byOrder.values()].map((g) => g.uid),
  ]);

  const now = Date.now();
  const staleBefore = now - STALE_PENDING_MINUTES * 60_000;
  const intentIds = new Set(intents.map((i) => i.orderCode));

  const paidNotGranted: OrderRow[] = [];
  const pendingStale: OrderRow[] = [];

  for (const it of intents) {
    const hasGrant = grants.byOrder.has(it.orderCode);
    if (it.status === 'paid' && !hasGrant) {
      paidNotGranted.push(toRow(it, hasGrant, emails));
    } else if (
      (it.status === 'pending' || it.status === 'amount_mismatch') &&
      it.createdAt &&
      new Date(it.createdAt).getTime() < staleBefore
    ) {
      pendingStale.push(toRow(it, hasGrant, emails));
    }
  }

  const orphanGrants: OrphanGrantRow[] = [];
  for (const [orderId, g] of grants.byOrder) {
    // orderId là 'manual:*' (cấp tay không đơn) → bỏ qua, không tính lạ.
    if (orderId.startsWith('manual:')) continue;
    if (!intentIds.has(orderId)) {
      orphanGrants.push({ orderId, uid: g.uid, email: emails.get(g.uid) ?? null, provider: g.provider, at: g.at });
    }
  }

  return {
    paidNotGranted,
    pendingStale,
    orphanGrants,
    scannedIntents: intents.length,
    scannedGrants: grants.count,
    generatedAt: new Date().toISOString(),
  };
}

export interface RevenuePoint {
  date: string; // YYYY-MM-DD (local)
  amount: number;
  count: number;
}
export interface RevenueSeries {
  points: RevenuePoint[];
  totalAmount: number;
  totalCount: number;
  byPlan: { plan: string; amount: number; count: number }[];
  days: number;
}

/** YYYY-MM-DD theo giờ VN (UTC+7) từ ISO — gom doanh thu theo NGÀY địa phương. */
function vnDateKey(iso: string): string {
  const t = new Date(iso).getTime();
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Chuỗi doanh thu `days` ngày gần nhất từ payments_index (đơn đã trả thật).
 * Gom theo ngày (giờ VN) + tách theo gói. Đủ nhẹ cho MVP (đọc tối đa SCAN_LIMIT).
 */
export async function getRevenueSeries(days = 30): Promise<RevenueSeries> {
  const snap = await getAdminDb()
    .collection('payments_index')
    .orderBy('paidAt', 'desc')
    .limit(SCAN_LIMIT)
    .get();

  const span = Math.min(Math.max(days, 1), 120);
  const cutoff = Date.now() - span * 86_400_000;
  const perDay = new Map<string, { amount: number; count: number }>();
  const perPlan = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;
  let totalCount = 0;

  for (const d of snap.docs) {
    const x = d.data();
    const paidAt = isoOrNull(x.paidAt);
    if (!paidAt) continue;
    if (new Date(paidAt).getTime() < cutoff) continue;
    const amount = num(x.amount);
    const plan = str(x.plan) || 'monthly';
    const key = vnDateKey(paidAt);

    const dd = perDay.get(key) ?? { amount: 0, count: 0 };
    dd.amount += amount;
    dd.count += 1;
    perDay.set(key, dd);

    const pp = perPlan.get(plan) ?? { amount: 0, count: 0 };
    pp.amount += amount;
    pp.count += 1;
    perPlan.set(plan, pp);

    totalAmount += amount;
    totalCount += 1;
  }

  // Trải đủ span ngày (kể cả ngày 0đ) để biểu đồ liền mạch.
  const points: RevenuePoint[] = [];
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const todayMs = new Date(today + 'T00:00:00Z').getTime();
  for (let i = span - 1; i >= 0; i--) {
    const dayKey = new Date(todayMs - i * 86_400_000).toISOString().slice(0, 10);
    const v = perDay.get(dayKey) ?? { amount: 0, count: 0 };
    points.push({ date: dayKey, amount: v.amount, count: v.count });
  }

  const byPlan = [...perPlan.entries()]
    .map(([plan, v]) => ({ plan, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  return { points, totalAmount, totalCount, byPlan, days: span };
}

export interface GrantByOrderResult {
  ok: boolean;
  outcome?: PaidOutcome;
  payosStatus?: string;
  reason?: string;
}

/**
 * Đối soát 1 đơn: nếu intent đã 'paid' → chạy lại applyPaidOrderAtomic (idempotent,
 * bù grant_events/user nếu trước đó ghi thiếu). Nếu 'pending'/'mismatch' → hỏi PayOS;
 * PAID thì cấp, chưa thì trả trạng thái để admin quyết.
 */
export async function verifyAndGrantOrder(orderCode: number): Promise<GrantByOrderResult> {
  const intentSnap = await getAdminDb().doc(`payment_intents/${orderCode}`).get();
  if (!intentSnap.exists) return { ok: false, reason: 'no_intent' };
  const intent = intentSnap.data() ?? {};

  if (intent.status === 'paid') {
    const r = await applyPaidOrderAtomic({ orderCode, webhookAmount: num(intent.amount) });
    return { ok: true, outcome: r.outcome };
  }

  if (!isPayosConfigured()) return { ok: false, reason: 'payos_unconfigured' };

  let link;
  try {
    link = await getPayos().paymentRequests.get(orderCode);
  } catch {
    return { ok: false, reason: 'payos_unreachable' };
  }
  if (link.status !== 'PAID') {
    return { ok: false, payosStatus: link.status, reason: 'not_paid_at_payos' };
  }
  const r = await applyPaidOrderAtomic({ orderCode, webhookAmount: link.amount });
  return { ok: true, outcome: r.outcome, payosStatus: link.status };
}

export interface ManualGrantResult {
  ok: boolean;
  premiumExpiresAt?: string;
  reason?: string;
}

/**
 * Cấp Pro thủ công cho 1 uid (không gắn đơn PayOS). Stacking lên hạn hiện có.
 * Ghi grant_events(provider:'admin', orderId:'manual:<ts>') + cập nhật user.
 */
export async function grantProManual(input: {
  uid: string;
  periodDays: number;
  actorUid: string;
  now?: number;
}): Promise<ManualGrantResult> {
  const uid = input.uid.trim();
  if (!uid) return { ok: false, reason: 'no_uid' };
  const periodDays = Number.isFinite(input.periodDays) && input.periodDays > 0 ? Math.floor(input.periodDays) : PRO_PERIOD_DAYS;
  const now = input.now ?? Date.now();
  const db = getAdminDb();
  const userRef = db.doc(`users/${uid}`);

  const premiumExpiresAt = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const currentExpiry = userSnap.exists ? isoOrNull(userSnap.data()?.premiumExpiresAt) : null;
    const exp = computeProExpiry(currentExpiry, periodDays, now);
    const nowIso = new Date(now).toISOString();
    const orderId = `manual:${now}`;

    tx.set(
      userRef,
      {
        tier: 'pro',
        plan: 'premium',
        isPremium: true,
        premiumExpiresAt: exp,
        billingProvider: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(db.collection('grant_events').doc(), {
      uid,
      provider: 'admin',
      periodDays,
      orderId,
      grantedBy: input.actorUid,
      at: nowIso,
    });
    return exp;
  });

  return { ok: true, premiumExpiresAt };
}
