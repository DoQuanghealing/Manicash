/* ═══ Admin M2 — Người dùng & Customer 360 ═══ */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { authHeaders } from '@/lib/adminClient';
import './users.css';

interface UserRow {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  disabled: boolean;
  isPremium: boolean;
  plan: string | null;
  premiumExpiresAt: string | null;
  billingProvider: string | null;
  accountStatus: string;
  isTestAccount: boolean;
}
interface CustomerProfile {
  identity: {
    uid: string; email: string | null; displayName: string | null; photoURL: string | null;
    emailVerified: boolean; disabled: boolean; createdAt: string | null; lastActiveAt: string | null; isAdmin: boolean;
  };
  account: { accountStatus: string; isTestAccount: boolean; deletionRequestedAt: string | null; deletionScheduledAt: string | null };
  commerce: {
    isPremium: boolean; plan: string | null; premiumExpiresAt: string | null; billingProvider: string | null;
    totalPaid: number; paidOrders: number; lastPaidAt: string | null;
    grants: { orderId: string; provider: string; periodDays: number; at: string | null }[];
  };
  behavior: { hasCloudState: boolean; rank: string | null; xp: number | null; streak: number | null; updatedAt: string | null };
}
interface DeletionRow {
  uid: string; email: string | null; status: string; reason: string | null; requestedAt: string | null; scheduledAt: string | null;
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('vi-VN') : '—';
}
function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('vi-VN') : '—';
}
function vnd(n: number): string {
  return n.toLocaleString('vi-VN') + '₫';
}
function shortUid(uid: string): string {
  return uid.length > 12 ? uid.slice(0, 6) + '…' + uid.slice(-4) : uid;
}

export default function UsersContent() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [includeTest, setIncludeTest] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [deletions, setDeletions] = useState<DeletionRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) { setError('Phiên đăng nhập hết hạn — đăng nhập lại.'); return; }
      const params = new URLSearchParams({ view: 'list' });
      if (q.trim()) params.set('q', q.trim());
      if (plan) params.set('plan', plan);
      if (status) params.set('status', status);
      if (includeTest) params.set('includeTest', '1');
      const res = await fetch(apiUrl(`/api/admin/users?${params.toString()}`), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setTotal(j.total ?? 0);
      setScanned(j.scanned ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [q, plan, status, includeTest]);

  const loadDeletions = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/overview?view=deletions'), { headers });
      if (res.ok) {
        const j = await res.json();
        setDeletions(Array.isArray(j.rows) ? j.rows : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    loadDeletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProfile = useCallback(async (uid: string) => {
    setSelected(uid);
    setProfile(null);
    setProfileLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(apiUrl(`/api/admin/users?view=profile&uid=${encodeURIComponent(uid)}`), { headers });
      if (res.ok) setProfile(await res.json());
      else setError(`Không tải được hồ sơ (HTTP ${res.status})`);
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  async function grantPro(uid: string, periodDays: number) {
    setActing(true);
    setNotice(null);
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/grant'), {
        method: 'POST', headers, body: JSON.stringify({ uid, periodDays }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setNotice(`Đã cấp Pro ${periodDays} ngày cho ${shortUid(uid)} ✓`);
        await Promise.all([openProfile(uid), load()]);
      } else setError(j?.error || 'Không cấp được Pro');
    } catch { setError('Lỗi kết nối'); } finally { setActing(false); }
  }

  async function userAction(uid: string, action: string, label: string) {
    setActing(true);
    setNotice(null);
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/users'), {
        method: 'POST', headers, body: JSON.stringify({ uid, action }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setNotice(`${label} ✓`);
        await Promise.all([openProfile(uid), load()]);
      } else setError(j?.error || `${label} thất bại`);
    } catch { setError('Lỗi kết nối'); } finally { setActing(false); }
  }

  return (
    <div className="usr-page">
      <header className="usr-head">
        <div>
          <h1 className="usr-title">Người dùng</h1>
          <p className="usr-sub">
            Danh bạ Firebase Auth ⨝ hồ sơ Firestore. {scanned > 0 && `Quét ${scanned} tài khoản.`}
          </p>
        </div>
        <button className="adm-btn" onClick={() => { load(); loadDeletions(); }} disabled={loading}>
          {loading ? '⏳' : '🔄'} Làm mới
        </button>
      </header>

      {notice && <div className="usr-notice">{notice}</div>}
      {error && <div className="usr-error">{error}</div>}

      {/* Yêu cầu xóa tài khoản */}
      {deletions.length > 0 && (
        <section className="usr-section">
          <h2 className="usr-h2">🗑️ Yêu cầu xóa tài khoản ({deletions.filter((d) => d.status === 'pending').length} chờ)</h2>
          <div className="usr-table-wrap">
            <table className="usr-table">
              <thead><tr><th>Email</th><th>Trạng thái</th><th>Lý do</th><th>Yêu cầu</th><th>Xử lý lúc</th></tr></thead>
              <tbody>
                {deletions.map((d) => (
                  <tr key={d.uid} className="usr-row" onClick={() => openProfile(d.uid)}>
                    <td>{d.email ?? shortUid(d.uid)}</td>
                    <td><span className={`usr-badge usr-badge-${d.status === 'pending' ? 'warn' : d.status === 'completed' ? 'muted' : 'ok'}`}>{d.status}</span></td>
                    <td className="usr-reason">{d.reason ?? '—'}</td>
                    <td className="usr-time">{when(d.requestedAt)}</td>
                    <td className="usr-time">{day(d.scheduledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bộ lọc */}
      <div className="usr-filters">
        <input
          className="usr-input usr-input-wide"
          placeholder="Tìm email / tên / uid"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select className="usr-input" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Mọi gói</option>
          <option value="pro">Pro</option>
          <option value="free">Free</option>
        </select>
        <select className="usr-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Active</option>
          <option value="pending_deletion">Chờ xóa</option>
        </select>
        <label className="usr-check">
          <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Gồm test
        </label>
        <button className="adm-btn" onClick={load} disabled={loading}>{loading ? '⏳' : 'Lọc'}</button>
      </div>

      <div className="usr-layout">
        {/* Danh sách */}
        <div className="usr-list">
          {rows.length === 0 ? (
            <div className="usr-empty">{loading ? 'Đang tải…' : 'Không có user khớp bộ lọc.'}</div>
          ) : (
            <div className="usr-table-wrap">
              <table className="usr-table">
                <thead>
                  <tr><th>Người dùng</th><th>Gói</th><th>Trạng thái</th><th>Tạo</th><th>Hoạt động</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.uid}
                      className={`usr-row${selected === r.uid ? ' usr-row-active' : ''}`}
                      onClick={() => openProfile(r.uid)}
                    >
                      <td>
                        <span className="usr-email">{r.email ?? r.displayName ?? '—'}</span>
                        <span className="usr-uid">{shortUid(r.uid)}{r.isTestAccount ? ' · test' : ''}</span>
                      </td>
                      <td>
                        {r.isPremium
                          ? <span className="usr-badge usr-badge-pro">Pro</span>
                          : <span className="usr-badge usr-badge-muted">Free</span>}
                      </td>
                      <td>
                        {r.accountStatus === 'pending_deletion'
                          ? <span className="usr-badge usr-badge-warn">Chờ xóa</span>
                          : <span className="usr-dim">active</span>}
                      </td>
                      <td className="usr-time">{day(r.createdAt)}</td>
                      <td className="usr-time">{day(r.lastActiveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="usr-count">Hiển thị {rows.length} / {total}</div>
            </div>
          )}
        </div>

        {/* Customer 360 */}
        {selected && (
          <aside className="usr-panel">
            <button className="usr-panel-close" onClick={() => { setSelected(null); setProfile(null); }}>✕</button>
            {profileLoading || !profile ? (
              <p className="usr-dim">Đang tải hồ sơ…</p>
            ) : (
              <>
                <div className="usr-panel-head">
                  <div className="usr-panel-name">{profile.identity.displayName ?? profile.identity.email ?? shortUid(profile.identity.uid)}</div>
                  <div className="usr-panel-email">{profile.identity.email ?? '—'}</div>
                  <div className="usr-panel-tags">
                    {profile.commerce.isPremium && <span className="usr-badge usr-badge-pro">Pro</span>}
                    {profile.identity.isAdmin && <span className="usr-badge usr-badge-admin">Admin</span>}
                    {profile.account.isTestAccount && <span className="usr-badge usr-badge-muted">Test</span>}
                    {profile.identity.disabled && <span className="usr-badge usr-badge-danger">Banned</span>}
                    {profile.account.accountStatus === 'pending_deletion' && <span className="usr-badge usr-badge-warn">Chờ xóa</span>}
                  </div>
                  <div className="usr-panel-uid">{profile.identity.uid}</div>
                </div>

                {/* Định danh */}
                <div className="usr-block">
                  <div className="usr-block-title">Định danh</div>
                  <Field k="Tạo tài khoản" v={when(profile.identity.createdAt)} />
                  <Field k="Hoạt động gần nhất" v={when(profile.identity.lastActiveAt)} />
                  <Field k="Email xác minh" v={profile.identity.emailVerified ? 'Có' : 'Chưa'} />
                </div>

                {/* Thương mại */}
                <div className="usr-block">
                  <div className="usr-block-title">Thương mại</div>
                  <Field k="Tổng đã trả" v={vnd(profile.commerce.totalPaid)} />
                  <Field k="Số đơn đã trả" v={String(profile.commerce.paidOrders)} />
                  <Field k="Lần trả gần nhất" v={when(profile.commerce.lastPaidAt)} />
                  <Field k="Pro hết hạn" v={when(profile.commerce.premiumExpiresAt)} />
                  <Field k="Nguồn cấp" v={profile.commerce.billingProvider ?? '—'} />
                </div>

                {/* Hành vi */}
                <div className="usr-block">
                  <div className="usr-block-title">Tài chính · Hành vi</div>
                  {profile.behavior.hasCloudState ? (
                    <>
                      <Field k="Rank" v={profile.behavior.rank ?? '—'} />
                      <Field k="XP" v={profile.behavior.xp != null ? String(profile.behavior.xp) : '—'} />
                      <Field k="Streak" v={profile.behavior.streak != null ? String(profile.behavior.streak) : '—'} />
                    </>
                  ) : (
                    <p className="usr-dim">Chưa đồng bộ đám mây (money sync đang tắt) — dữ liệu hành vi ở thiết bị người dùng.</p>
                  )}
                </div>

                {/* Hành động */}
                <div className="usr-block">
                  <div className="usr-block-title">Hành động</div>
                  <div className="usr-actions">
                    {[30, 180, 365].map((d) => (
                      <button key={d} className="adm-btn adm-btn-sm" disabled={acting} onClick={() => grantPro(profile.identity.uid, d)}>
                        + Pro {d}d
                      </button>
                    ))}
                    {profile.commerce.isPremium && (
                      <button className="adm-btn adm-btn-sm" disabled={acting} onClick={() => userAction(profile.identity.uid, 'revoke_pro', 'Thu hồi Pro')}>
                        Thu hồi Pro
                      </button>
                    )}
                    {profile.account.isTestAccount
                      ? <button className="adm-btn adm-btn-sm" disabled={acting} onClick={() => userAction(profile.identity.uid, 'unset_test', 'Bỏ đánh dấu test')}>Bỏ test</button>
                      : <button className="adm-btn adm-btn-sm" disabled={acting} onClick={() => userAction(profile.identity.uid, 'set_test', 'Đánh dấu test')}>Đánh dấu test</button>}
                    <button className="adm-btn adm-btn-sm adm-btn-danger" disabled={acting} onClick={() => userAction(profile.identity.uid, 'ban', 'Đã ban')}>Ban</button>
                    <button className="adm-btn adm-btn-sm" disabled={acting} onClick={() => userAction(profile.identity.uid, 'unban', 'Đã gỡ ban')}>Gỡ ban</button>
                  </div>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="usr-field">
      <span className="usr-field-k">{k}</span>
      <span className="usr-field-v">{v}</span>
    </div>
  );
}
