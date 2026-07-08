/* ═══ Admin Dashboard Content — Full Ban Management UI ═══ */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { isAdminEmail } from '@/lib/adminEmails';
import './admin.css';

interface BanRecord {
  identifier: string;
  type: 'ip' | 'uid';
  reason: string;
  bannedAt: string;
  violations: number;
}

interface SecurityStats {
  totalTracked: number;
  totalBanned: number;
  activeConnections: number;
}

interface BansResponse {
  bans: BanRecord[];
  stats: SecurityStats;
  timestamp: string;
}

type AuthState = 'checking' | 'anon' | 'forbidden' | 'admin';

/** Lấy ID token của user đang đăng nhập (tự refresh khi gần hết hạn). */
async function getIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

/** Header Authorization: Bearer cho mọi request admin — không còn key tĩnh. */
async function authHeaders(json = false): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  if (!token) return null;
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export default function AdminDashboardContent() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [data, setData] = useState<BansResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual ban form
  const [banIdentifier, setBanIdentifier] = useState('');
  const [banType, setBanType] = useState<'ip' | 'uid'>('ip');
  const [banReason, setBanReason] = useState('');

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Test accounts (admin tạo cho bạn bè xem app)
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testAccounts, setTestAccounts] = useState<
    { uid: string; username: string; displayName: string; createdAt: string | null }[]
  >([]);

  // Xác định quyền admin từ Custom Claims của tài khoản đang đăng nhập.
  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (user: User | null) => {
      if (!user) {
        setAuthState('anon');
        return;
      }
      try {
        const result = await user.getIdTokenResult(true); // force refresh để đọc claim mới nhất
        const ok = result.claims.admin === true && isAdminEmail(user.email);
        setAuthState(ok ? 'admin' : 'forbidden');
      } catch {
        setAuthState('forbidden');
      }
    });
    return () => unsub();
  }, []);

  const fetchTestAccounts = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/test-account'), { headers });
      if (res.ok) {
        const j = await res.json();
        setTestAccounts(Array.isArray(j.accounts) ? j.accounts : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchBans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Phiên đăng nhập hết hạn — đăng nhập lại.');
        return;
      }
      const res = await fetch(apiUrl('/api/admin/bans'), { headers });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Không có quyền admin');
          setAuthState('forbidden');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (!autoRefresh || authState !== 'admin') return;
    const interval = setInterval(fetchBans, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, authState, fetchBans]);

  // Nạp dữ liệu khi xác nhận là admin.
  useEffect(() => {
    if (authState === 'admin') {
      fetchBans();
      fetchTestAccounts();
    }
  }, [authState, fetchBans, fetchTestAccounts]);

  async function handleCreateTestAccount() {
    setError(null);
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/test-account'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: testUsername, password: testPassword }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setTestUsername('');
        setTestPassword('');
        await fetchTestAccounts();
      } else {
        setError(j?.error || 'Không tạo được tài khoản test');
      }
    } catch {
      setError('Lỗi kết nối');
    }
  }

  async function handleDeleteTestAccount(uid: string) {
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/test-account'), {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ uid }),
      });
      if (res.ok) await fetchTestAccounts();
      else {
        const j = await res.json().catch(() => null);
        setError(j?.error || 'Không xóa được tài khoản');
      }
    } catch {
      setError('Lỗi kết nối');
    }
  }

  async function handleUnban(identifier: string, type: 'ip' | 'uid') {
    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/bans'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'unban', identifier, type }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchBans(); // Refresh list
      } else {
        setError(json.message || 'Không thể gỡ ban');
      }
    } catch {
      setError('Lỗi kết nối');
    }
  }

  async function handleManualBan() {
    if (!banIdentifier.trim()) {
      setError('Vui lòng nhập IP hoặc UID');
      return;
    }

    try {
      const headers = await authHeaders(true);
      if (!headers) return;
      const res = await fetch(apiUrl('/api/admin/bans'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'ban',
          identifier: banIdentifier.trim(),
          type: banType,
          reason: banReason || 'Ban thủ công bởi admin',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBanIdentifier('');
        setBanReason('');
        await fetchBans();
      }
    } catch {
      setError('Lỗi kết nối');
    }
  }

  /* ── Đang kiểm tra quyền ── */
  if (authState === 'checking') {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <div className="admin-login-icon">🛡️</div>
          <h1 className="admin-login-title">Admin Dashboard</h1>
          <p className="admin-login-subtitle">Đang kiểm tra quyền truy cập…</p>
        </div>
      </div>
    );
  }

  /* ── Chưa đăng nhập ── */
  if (authState === 'anon') {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <div className="admin-login-icon">🔐</div>
          <h1 className="admin-login-title">Cần đăng nhập</h1>
          <p className="admin-login-subtitle">
            Đăng nhập ManiCash bằng tài khoản admin, rồi mở lại trang này.
          </p>
          <a className="admin-btn admin-btn-primary" href="/login">
            Tới trang đăng nhập
          </a>
        </div>
      </div>
    );
  }

  /* ── Đăng nhập nhưng không phải admin ── */
  if (authState === 'forbidden') {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <div className="admin-login-icon">⛔</div>
          <h1 className="admin-login-title">Không có quyền</h1>
          <p className="admin-login-subtitle">
            Tài khoản này không có quyền admin. Nếu vừa được cấp quyền, hãy đăng xuất rồi
            đăng nhập lại để làm mới token.
          </p>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */
  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">🛡️ Security Dashboard</h1>
            <p className="admin-subtitle">ManiCash — Trung tâm bảo mật</p>
          </div>
          <div className="admin-header-actions">
            <label className="admin-toggle-label">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh (3s)</span>
            </label>
            <button
              className="admin-btn admin-btn-ghost"
              onClick={fetchBans}
              disabled={loading}
            >
              {loading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {data?.stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-icon">📡</span>
              <div className="admin-stat-info">
                <span className="admin-stat-value">{data.stats.activeConnections}</span>
                <span className="admin-stat-label">IP đang theo dõi</span>
              </div>
            </div>
            <div className="admin-stat-card admin-stat-danger">
              <span className="admin-stat-icon">🚫</span>
              <div className="admin-stat-info">
                <span className="admin-stat-value">{data.stats.totalBanned}</span>
                <span className="admin-stat-label">Đã bị chặn</span>
              </div>
            </div>
            <div className="admin-stat-card admin-stat-success">
              <span className="admin-stat-icon">⏱️</span>
              <div className="admin-stat-info">
                <span className="admin-stat-value">
                  {data.timestamp ? new Date(data.timestamp).toLocaleTimeString('vi-VN') : '—'}
                </span>
                <span className="admin-stat-label">Cập nhật lần cuối</span>
              </div>
            </div>
          </div>
        )}

        {/* Test Accounts */}
        <div className="admin-section">
          <h2 className="admin-section-title">🧪 Tài khoản test ({testAccounts.length})</h2>
          <p className="admin-subtitle" style={{ marginBottom: 12 }}>
            Tạo username + mật khẩu đưa bạn bè đăng nhập xem app (không cần email). Xóa sau khi test xong.
          </p>
          <div className="admin-ban-form">
            <div className="admin-ban-form-row">
              <input
                className="admin-input"
                placeholder="username (a-z, 0-9, _)"
                value={testUsername}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setTestUsername(e.target.value)}
              />
              <input
                className="admin-input"
                placeholder="mật khẩu (≥6 ký tự)"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
              />
              <button className="admin-btn admin-btn-primary" onClick={handleCreateTestAccount}>
                ➕ Tạo
              </button>
            </div>
          </div>

          {testAccounts.length > 0 && (
            <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Tên hiển thị</th>
                    <th>Tạo lúc</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {testAccounts.map((a) => (
                    <tr key={a.uid}>
                      <td className="admin-mono">{a.username}</td>
                      <td>{a.displayName}</td>
                      <td className="admin-time">
                        {a.createdAt ? new Date(a.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDeleteTestAccount(a.uid)}
                        >
                          🗑️ Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manual Ban Form */}
        <div className="admin-section">
          <h2 className="admin-section-title">➕ Ban Thủ Công</h2>
          <div className="admin-ban-form">
            <div className="admin-ban-form-row">
              <select
                className="admin-select"
                value={banType}
                onChange={(e) => setBanType(e.target.value as 'ip' | 'uid')}
              >
                <option value="ip">🌐 IP Address</option>
                <option value="uid">👤 User UID</option>
              </select>
              <input
                className="admin-input"
                placeholder={banType === 'ip' ? 'VD: 192.168.1.100' : 'VD: user-uid-123'}
                value={banIdentifier}
                onChange={(e) => setBanIdentifier(e.target.value)}
              />
              <input
                className="admin-input"
                placeholder="Lý do (tuỳ chọn)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
              <button
                className="admin-btn admin-btn-danger"
                onClick={handleManualBan}
              >
                🚫 Ban
              </button>
            </div>
          </div>
        </div>

        {/* Ban List */}
        <div className="admin-section">
          <h2 className="admin-section-title">
            📋 Danh sách chặn ({data?.bans.length || 0})
          </h2>

          {data?.bans.length === 0 ? (
            <div className="admin-empty">
              <span className="admin-empty-icon">✅</span>
              <p>Chưa có IP/tài khoản nào bị chặn</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Identifier</th>
                    <th>Lý do</th>
                    <th>Vi phạm</th>
                    <th>Thời gian ban</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.bans.map((ban) => (
                    <tr key={`${ban.type}:${ban.identifier}`}>
                      <td>
                        <span className={`admin-badge admin-badge-${ban.type}`}>
                          {ban.type === 'ip' ? '🌐 IP' : '👤 UID'}
                        </span>
                      </td>
                      <td className="admin-mono">{ban.identifier}</td>
                      <td className="admin-reason">{ban.reason}</td>
                      <td className="admin-center">{ban.violations}</td>
                      <td className="admin-time">
                        {new Date(ban.bannedAt).toLocaleString('vi-VN')}
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn-success admin-btn-sm"
                          onClick={() => handleUnban(ban.identifier, ban.type)}
                        >
                          ✅ Gỡ ban
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Security Info */}
        <div className="admin-section admin-info-section">
          <h2 className="admin-section-title">ℹ️ Cấu hình bảo mật</h2>
          <div className="admin-info-grid">
            <div className="admin-info-item">
              <span className="admin-info-label">Rate Limit</span>
              <span className="admin-info-value">30 requests / 2 giây</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Auto-ban sau</span>
              <span className="admin-info-value">3 lần vi phạm</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Loại ban</span>
              <span className="admin-info-value">Vĩnh viễn (chỉ admin gỡ)</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-label">Theo dõi</span>
              <span className="admin-info-value">IP + UID (dual-layer)</span>
            </div>
          </div>
        </div>

        {error && <div className="admin-error">{error}</div>}
      </div>
    </div>
  );
}
