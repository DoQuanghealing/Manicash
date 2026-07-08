/* ═══ Admin M8 — Nhật ký hành động ═══ */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { authHeaders } from '@/lib/adminClient';
import './audit.css';

interface AuditRow {
  id: string;
  uid: string;
  email: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  at: string | null;
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('vi-VN') : '—';
}

export default function AuditContent() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) { setError('Phiên đăng nhập hết hạn — đăng nhập lại.'); return; }
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (actor.trim()) params.set('actor', actor.trim());
      const res = await fetch(apiUrl(`/api/admin/audit?${params.toString()}`), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setTotal(j.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [action, actor]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="aud-page">
      <header className="aud-head">
        <div>
          <h1 className="aud-title">Nhật ký</h1>
          <p className="aud-sub">Mọi hành động admin được ghi lại (append-only).</p>
        </div>
        <button className="adm-btn" onClick={load} disabled={loading}>{loading ? '⏳' : '🔄'} Làm mới</button>
      </header>

      {error && <div className="aud-error">{error}</div>}

      <div className="aud-filters">
        <select className="aud-input" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Mọi loại</option>
          <option value="grant">grant.*</option>
          <option value="user">user.*</option>
          <option value="ban">ban.*</option>
        </select>
        <input
          className="aud-input aud-input-wide"
          placeholder="Người thực hiện (email/uid)"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="adm-btn" onClick={load} disabled={loading}>Lọc</button>
      </div>

      {rows.length === 0 ? (
        <div className="aud-empty">{loading ? 'Đang tải…' : 'Chưa có bản ghi nào.'}</div>
      ) : (
        <div className="aud-table-wrap">
          <table className="aud-table">
            <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="aud-time">{when(r.at)}</td>
                  <td>{r.email ?? r.uid}</td>
                  <td><span className="aud-action">{r.action}</span></td>
                  <td><code className="aud-detail">{r.detail ? JSON.stringify(r.detail) : '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="aud-count">{rows.length} / {total}</div>
        </div>
      )}
    </div>
  );
}
