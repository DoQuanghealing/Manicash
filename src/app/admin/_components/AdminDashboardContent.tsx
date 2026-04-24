/* ═══ Admin Dashboard Content — Full Ban Management UI ═══ */
'use client';

import { useState, useEffect, useCallback } from 'react';
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

const DEFAULT_ADMIN_KEY = 'manicash-admin-2026';

export default function AdminDashboardContent() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [data, setData] = useState<BansResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual ban form
  const [banIdentifier, setBanIdentifier] = useState('');
  const [banType, setBanType] = useState<'ip' | 'uid'>('ip');
  const [banReason, setBanReason] = useState('');

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchBans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bans?key=${encodeURIComponent(adminKey)}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sai admin key');
          setIsAuthed(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setIsAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (!autoRefresh || !isAuthed) return;
    const interval = setInterval(fetchBans, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, isAuthed, fetchBans]);

  async function handleLogin() {
    if (!adminKey.trim()) {
      setError('Vui lòng nhập admin key');
      return;
    }
    await fetchBans();
  }

  async function handleUnban(identifier: string, type: 'ip' | 'uid') {
    try {
      const res = await fetch('/api/admin/bans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ action: 'unban', identifier, type }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchBans(); // Refresh list
      } else {
        setError(json.message || 'Không thể gỡ ban');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    }
  }

  async function handleManualBan() {
    if (!banIdentifier.trim()) {
      setError('Vui lòng nhập IP hoặc UID');
      return;
    }

    try {
      const res = await fetch('/api/admin/bans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
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
    } catch (err) {
      setError('Lỗi kết nối');
    }
  }

  /* ── Login Screen ── */
  if (!isAuthed) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <div className="admin-login-icon">🛡️</div>
          <h1 className="admin-login-title">Admin Dashboard</h1>
          <p className="admin-login-subtitle">ManiCash Security Center</p>

          <div className="admin-form-group">
            <label className="admin-label">Admin Key</label>
            <input
              type="password"
              className="admin-input"
              placeholder="Nhập admin key..."
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              id="admin-key-input"
            />
          </div>

          <button
            className="admin-btn admin-btn-primary"
            onClick={handleLogin}
            disabled={loading}
            id="admin-login-btn"
          >
            {loading ? '⏳ Đang xác thực...' : '🔐 Đăng nhập'}
          </button>

          {error && <div className="admin-error">{error}</div>}
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
