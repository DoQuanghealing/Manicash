/* ═══ Admin M8 — Nhật ký hành động (đọc admin_audit) ═══ */
import { getAdminDb } from '@/lib/firebaseAdmin';

const AUDIT_SCAN = 500;

export interface AuditRow {
  id: string;
  uid: string;
  email: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  at: string | null;
}

function toIso(v: unknown): string | null {
  if (typeof v === 'string') return v;
  const toDate = (v as { toDate?: () => Date } | null | undefined)?.toDate;
  if (typeof toDate === 'function') return toDate.call(v).toISOString();
  return null;
}

export interface AuditOptions {
  action?: string; // khớp tiền tố (vd 'grant', 'ban')
  actor?: string; // email hoặc uid
  limit?: number;
}

export async function listAudit(opts: AuditOptions = {}): Promise<{ rows: AuditRow[]; total: number }> {
  const snap = await getAdminDb()
    .collection('admin_audit')
    .orderBy('at', 'desc')
    .limit(AUDIT_SCAN)
    .get();

  let rows: AuditRow[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      uid: typeof x.uid === 'string' ? x.uid : '',
      email: typeof x.email === 'string' ? x.email : null,
      action: typeof x.action === 'string' ? x.action : '',
      detail: x.detail && typeof x.detail === 'object' ? (x.detail as Record<string, unknown>) : null,
      at: toIso(x.at),
    };
  });

  const action = (opts.action ?? '').trim().toLowerCase();
  if (action) rows = rows.filter((r) => r.action.toLowerCase().startsWith(action));
  const actor = (opts.actor ?? '').trim().toLowerCase();
  if (actor) rows = rows.filter((r) => (r.email ?? '').toLowerCase().includes(actor) || r.uid.toLowerCase().includes(actor));

  const total = rows.length;
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), AUDIT_SCAN);
  return { rows: rows.slice(0, limit), total };
}
