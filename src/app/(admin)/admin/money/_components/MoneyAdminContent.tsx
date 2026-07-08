/* ═══ Admin M1 — Tiền & Doanh thu ═══
 * 3 khối: (1) đối soát lệch tiền (quan trọng nhất), (2) bảng đơn có lọc,
 * (3) cấp Pro thủ công. Mọi call đính Bearer ID token qua authHeaders.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { authHeaders } from '@/lib/adminClient';
import './money.css';

interface OrderRow {
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
interface OrphanGrantRow {
  orderId: string;
  uid: string;
  email: string | null;
  provider: string;
  at: string | null;
}
interface ReconcileReport {
  paidNotGranted: OrderRow[];
  pendingStale: OrderRow[];
  orphanGrants: OrphanGrantRow[];
  scannedIntents: number;
  scannedGrants: number;
  generatedAt: string;
}
interface RevenuePoint { date: string; amount: number; count: number }
interface RevenueSeries {
  points: RevenuePoint[];
  totalAmount: number;
  totalCount: number;
  byPlan: { plan: string; amount: number; count: number }[];
  days: number;
}

const PLAN_LABEL: Record<string, string> = {
  monthly: 'Tháng',
  half_year: '6 tháng',
  yearly: 'Năm',
};

function vnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}
function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('vi-VN') : '—';
}
function shortUid(uid: string): string {
  return uid.length > 10 ? uid.slice(0, 6) + '…' + uid.slice(-4) : uid;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'ok',
    pending: 'warn',
    amount_mismatch: 'danger',
    create_failed: 'muted',
  };
  const label: Record<string, string> = {
    paid: 'Đã trả',
    pending: 'Chờ',
    amount_mismatch: 'Thiếu tiền',
    create_failed: 'Lỗi tạo',
  };
  return <span className={`money-badge money-badge-${map[status] ?? 'muted'}`}>{label[status] ?? status}</span>;
}

function RevenueChart({ series }: { series: RevenueSeries }) {
  const max = Math.max(1, ...series.points.map((p) => p.amount));
  return (
    <div className="money-chart">
      <div className="money-chart-bars">
        {series.points.map((p) => (
          <div key={p.date} className="money-bar-col" title={`${p.date}: ${vnd(p.amount)} · ${p.count} đơn`}>
            <div className="money-bar" style={{ height: `${(p.amount / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="money-chart-axis">
        <span>{series.points[0]?.date.slice(5)}</span>
        <span>{series.points[series.points.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

export default function MoneyAdminContent() {
  const [recon, setRecon] = useState<ReconcileReport | null>(null);
  const [revenue, setRevenue] = useState<RevenueSeries | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reconLoading, setReconLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  // Bộ lọc bảng đơn
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [q, setQ] = useState('');

  // Cấp thủ công
  const [grantUid, setGrantUid] = useState('');
  const [grantDays, setGrantDays] = useState(30);

  const loadRecon = useCallback(async () => {
    setReconLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Phiên đăng nhập hết hạn — đăng nhập lại.');
        return;
      }
      const res = await fetch(apiUrl('/api/admin/payments?view=reconcile'), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRecon(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối');
    } finally {
      setReconLoading(false);
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/payments?view=revenue&days=30'), { headers });
      if (res.ok) setRevenue(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Phiên đăng nhập hết hạn — đăng nhập lại.');
        return;
      }
      const params = new URLSearchParams({ view: 'list' });
      if (status) params.set('status', status);
      if (plan) params.set('plan', plan);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(apiUrl(`/api/admin/payments?${params.toString()}`), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setOrders(Array.isArray(j.rows) ? j.rows : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [status, plan, q]);

  useEffect(() => {
    loadRecon();
    loadOrders();
    loadRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reconcileOrder(orderCode: string) {
    setBusyOrder(orderCode);
    setNotice(null);
    setError(null);
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/grant'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderCode: Number(orderCode) }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setNotice(
          j.outcome === 'granted'
            ? `Đơn ${orderCode}: đã cấp Pro ✓`
            : j.outcome === 'already'
              ? `Đơn ${orderCode}: đã cấp trước đó (không đổi)`
              : `Đơn ${orderCode}: ${j.outcome ?? 'xử lý xong'}`,
        );
      } else {
        setNotice(
          `Đơn ${orderCode}: chưa cấp — ${j?.reason ?? 'lỗi'}${j?.payosStatus ? ` (PayOS: ${j.payosStatus})` : ''}`,
        );
      }
      await Promise.all([loadRecon(), loadOrders()]);
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setBusyOrder(null);
    }
  }

  async function submitManualGrant() {
    if (!grantUid.trim()) {
      setError('Nhập UID cần cấp Pro.');
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/grant'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ uid: grantUid.trim(), periodDays: grantDays }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setNotice(`Đã cấp Pro cho ${shortUid(grantUid.trim())} tới ${when(j.premiumExpiresAt)} ✓`);
        setGrantUid('');
        await Promise.all([loadRecon(), loadOrders()]);
      } else {
        setError(j?.error || j?.reason || 'Không cấp được Pro');
      }
    } catch {
      setError('Lỗi kết nối');
    }
  }

  const reconCount =
    (recon?.paidNotGranted.length ?? 0) + (recon?.pendingStale.length ?? 0) + (recon?.orphanGrants.length ?? 0);

  return (
    <div className="money-page">
      <header className="money-head">
        <div>
          <h1 className="money-title">Tiền & Doanh thu</h1>
          <p className="money-sub">
            Đối soát dòng tiền PayOS. {recon ? `Quét ${recon.scannedIntents} đơn · ${recon.scannedGrants} lần cấp.` : ''}
          </p>
        </div>
        <button className="adm-btn" onClick={() => { loadRecon(); loadOrders(); loadRevenue(); }} disabled={loading || reconLoading}>
          {loading || reconLoading ? '⏳' : '🔄'} Làm mới
        </button>
      </header>

      {notice && <div className="money-notice">{notice}</div>}
      {error && <div className="money-error">{error}</div>}

      {/* ── (0) DOANH THU ── */}
      <section className="money-section">
        <h2 className="money-section-title">📈 Doanh thu 30 ngày</h2>
        {revenue ? (
          <div className="money-rev">
            <div className="money-rev-stats">
              <div className="money-rev-stat">
                <span className="money-rev-num">{vnd(revenue.totalAmount)}</span>
                <span className="money-rev-lbl">Tổng · {revenue.totalCount} đơn</span>
              </div>
              {revenue.byPlan.map((p) => (
                <div key={p.plan} className="money-rev-stat">
                  <span className="money-rev-num money-rev-num-sm">{vnd(p.amount)}</span>
                  <span className="money-rev-lbl">{PLAN_LABEL[p.plan] ?? p.plan} · {p.count}</span>
                </div>
              ))}
            </div>
            <RevenueChart series={revenue} />
          </div>
        ) : (
          <p className="money-muted">Đang tải…</p>
        )}
      </section>

      {/* ── (1) ĐỐI SOÁT — quan trọng nhất ── */}
      <section className="money-section">
        <h2 className="money-section-title">
          🔍 Đối soát lệch tiền{' '}
          {recon && (
            <span className={`money-pill ${reconCount === 0 ? 'money-pill-ok' : 'money-pill-alert'}`}>
              {reconCount === 0 ? 'Sạch' : `${reconCount} cần xử lý`}
            </span>
          )}
        </h2>

        {reconLoading && !recon ? (
          <p className="money-muted">Đang quét…</p>
        ) : (
          <div className="money-recon-grid">
            {/* A. Đã trả chưa cấp Pro */}
            <div className="money-recon-card money-recon-danger">
              <div className="money-recon-card-head">
                <span className="money-recon-num">{recon?.paidNotGranted.length ?? 0}</span>
                <span className="money-recon-label">Đã trả · chưa cấp Pro</span>
              </div>
              <p className="money-recon-desc">Khách trả tiền nhưng chưa được cấp — cần cấp ngay.</p>
              {recon?.paidNotGranted.map((r) => (
                <div key={r.orderCode} className="money-recon-row">
                  <div className="money-recon-row-info">
                    <span className="money-mono">{r.orderCode}</span>
                    <span className="money-recon-email">{r.email ?? shortUid(r.uid)}</span>
                    <span className="money-recon-meta">{vnd(r.amount)} · {when(r.paidAt)}</span>
                  </div>
                  <button
                    className="adm-btn adm-btn-primary adm-btn-sm"
                    onClick={() => reconcileOrder(r.orderCode)}
                    disabled={busyOrder === r.orderCode}
                  >
                    {busyOrder === r.orderCode ? '…' : 'Cấp Pro'}
                  </button>
                </div>
              ))}
            </div>

            {/* B. Pending quá lâu */}
            <div className="money-recon-card money-recon-warn">
              <div className="money-recon-card-head">
                <span className="money-recon-num">{recon?.pendingStale.length ?? 0}</span>
                <span className="money-recon-label">Chờ &gt; 30 phút</span>
              </div>
              <p className="money-recon-desc">Có thể khách đã trả mà webhook miss — bấm để hỏi PayOS.</p>
              {recon?.pendingStale.map((r) => (
                <div key={r.orderCode} className="money-recon-row">
                  <div className="money-recon-row-info">
                    <span className="money-mono">{r.orderCode}</span>
                    <span className="money-recon-email">{r.email ?? shortUid(r.uid)}</span>
                    <span className="money-recon-meta">
                      {vnd(r.amount)} · <StatusBadge status={r.status} /> · {when(r.createdAt)}
                    </span>
                  </div>
                  <button
                    className="adm-btn adm-btn-sm"
                    onClick={() => reconcileOrder(r.orderCode)}
                    disabled={busyOrder === r.orderCode}
                  >
                    {busyOrder === r.orderCode ? '…' : 'Kiểm tra'}
                  </button>
                </div>
              ))}
            </div>

            {/* C. Grant lạ */}
            <div className="money-recon-card">
              <div className="money-recon-card-head">
                <span className="money-recon-num">{recon?.orphanGrants.length ?? 0}</span>
                <span className="money-recon-label">Cấp lạ (không đơn)</span>
              </div>
              <p className="money-recon-desc">grant_events trỏ tới orderId không có đơn — kiểm tra thủ công.</p>
              {recon?.orphanGrants.map((r) => (
                <div key={r.orderId} className="money-recon-row">
                  <div className="money-recon-row-info">
                    <span className="money-mono">{r.orderId}</span>
                    <span className="money-recon-email">{r.email ?? shortUid(r.uid)}</span>
                    <span className="money-recon-meta">{r.provider} · {when(r.at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── (2) BẢNG ĐƠN ── */}
      <section className="money-section">
        <h2 className="money-section-title">📋 Đơn hàng {total > 0 && <span className="money-count">({total})</span>}</h2>
        <div className="money-filters">
          <select className="money-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Mọi trạng thái</option>
            <option value="paid">Đã trả</option>
            <option value="pending">Chờ</option>
            <option value="amount_mismatch">Thiếu tiền</option>
            <option value="create_failed">Lỗi tạo</option>
          </select>
          <select className="money-input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Mọi gói</option>
            <option value="monthly">Tháng</option>
            <option value="half_year">6 tháng</option>
            <option value="yearly">Năm</option>
          </select>
          <input
            className="money-input"
            placeholder="Tìm email / orderCode / uid"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
          />
          <button className="adm-btn" onClick={loadOrders} disabled={loading}>
            {loading ? '⏳' : 'Lọc'}
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="money-empty">{loading ? 'Đang tải…' : 'Chưa có đơn nào khớp bộ lọc.'}</div>
        ) : (
          <div className="money-table-wrap">
            <table className="money-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Khách</th>
                  <th>Gói</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Cấp</th>
                  <th>Tạo lúc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((r) => (
                  <tr key={r.orderCode}>
                    <td className="money-mono">{r.orderCode}</td>
                    <td>
                      <span className="money-email">{r.email ?? '—'}</span>
                      <span className="money-uid">{shortUid(r.uid)}</span>
                    </td>
                    <td>{PLAN_LABEL[r.plan] ?? r.plan}</td>
                    <td className="money-amount">{vnd(r.amount)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="money-center">{r.hasGrant ? '✅' : r.status === 'paid' ? '⚠️' : '—'}</td>
                    <td className="money-time">{when(r.createdAt)}</td>
                    <td>
                      {(r.status === 'paid' && !r.hasGrant) || r.status === 'pending' || r.status === 'amount_mismatch' ? (
                        <button
                          className="adm-btn adm-btn-sm"
                          onClick={() => reconcileOrder(r.orderCode)}
                          disabled={busyOrder === r.orderCode}
                        >
                          {busyOrder === r.orderCode ? '…' : r.status === 'paid' ? 'Cấp' : 'Kiểm tra'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── (3) CẤP THỦ CÔNG ── */}
      <section className="money-section">
        <h2 className="money-section-title">🎁 Cấp Pro thủ công</h2>
        <p className="money-muted" style={{ marginBottom: 10 }}>
          Cấp Pro cho 1 UID không qua PayOS (tặng / bù). Cộng dồn lên hạn hiện có. Ghi lại trong nhật ký.
        </p>
        <div className="money-grant-form">
          <input
            className="money-input money-input-wide"
            placeholder="UID người dùng"
            value={grantUid}
            onChange={(e) => setGrantUid(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
          <div className="money-days">
            {[30, 180, 365].map((d) => (
              <button
                key={d}
                className={`money-day-btn${grantDays === d ? ' money-day-active' : ''}`}
                onClick={() => setGrantDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
          <button className="adm-btn adm-btn-primary" onClick={submitManualGrant}>
            Cấp {grantDays} ngày
          </button>
        </div>
      </section>
    </div>
  );
}
