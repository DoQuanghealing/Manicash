/* ═══ Admin — Quản lý app: lỗi · lạm dụng · chặn ═══ */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { authHeaders } from '@/lib/adminClient';
import './health.css';

interface AppError {
  id: string;
  scope: string | null;
  message: string | null;
  count: number;
  resolved: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}
interface AbuseEvent {
  id: string;
  subject: string | null;
  kind: string | null;
  verdict: string | null;
  count: number;
  path: string | null;
  createdAt: string | null;
}
interface Subject {
  id: string;
  subject: string | null;
  status: string;
  strikes: number;
  lastKind: string | null;
  lastSeenAt: string | null;
}
interface Payload {
  distributedCounters: boolean;
  retentionDays: number;
  errors: AppError[];
  abuseEvents: AbuseEvent[];
  subjects: Subject[];
}

type Tab = 'errors' | 'abuse' | 'blocked';

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HealthContent() {
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>('errors');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Phiên đăng nhập hết hạn — đăng nhập lại.');
        return;
      }
      const res = await fetch(apiUrl('/api/admin/health'), { headers });
      if (!res.ok) throw new Error('load failed');
      setData(await res.json());
    } catch {
      setError('Không đọc được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(apiUrl('/api/admin/health'), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const unresolved = data?.errors.filter((e) => !e.resolved).length ?? 0;
  const locked = data?.subjects.filter((s) => s.status === 'locked').length ?? 0;

  return (
    <div className="hl-wrap">
      <header>
        <h1 className="adm-page-title">Quản lý app</h1>

        {/* Nói thẳng khi chưa cắm Redis. Không nói thì admin nhìn bảng trống và
         * tưởng app đang yên, trong khi thật ra là chưa đếm được gì. */}
        {data && !data.distributedCounters && (
          <div className="hl-warn">
            <strong>Bộ đếm chưa chạy phân tán.</strong> Chưa khai{' '}
            <code>UPSTASH_REDIS_REST_URL</code> / <code>UPSTASH_REDIS_REST_TOKEN</code> nên đang
            đếm trong bộ nhớ từng tiến trình — trên Vercel mỗi instance một bộ đếm riêng và mất
            khi cold start. Bảng lạm dụng bên dưới vì thế gần như luôn trống. Đây <em>không</em>{' '}
            phải dấu hiệu app an toàn.
          </div>
        )}
      </header>

      {error && <div className="hl-error">{error}</div>}

      <div className="hl-tabs">
        <button
          className={`hl-tab ${tab === 'errors' ? 'is-on' : ''}`}
          onClick={() => setTab('errors')}
        >
          Lỗi app {unresolved > 0 && <b className="hl-danger">{unresolved}</b>}
        </button>
        <button
          className={`hl-tab ${tab === 'abuse' ? 'is-on' : ''}`}
          onClick={() => setTab('abuse')}
        >
          Lạm dụng {data?.abuseEvents.length ? <b>{data.abuseEvents.length}</b> : null}
        </button>
        <button
          className={`hl-tab ${tab === 'blocked' ? 'is-on' : ''}`}
          onClick={() => setTab('blocked')}
        >
          Đang chặn {locked > 0 && <b className="hl-danger">{locked}</b>}
        </button>
      </div>

      {loading && <p className="hl-dim">Đang tải…</p>}

      {!loading &&
        data &&
        tab === 'errors' &&
        (data.errors.length === 0 ? (
          <p className="hl-dim">Chưa ghi nhận lỗi nào. Nhật ký bắt đầu từ khi bản này lên.</p>
        ) : (
          <ul className="hl-list">
            {data.errors.map((e) => (
              <li key={e.id} className={`hl-item ${e.resolved ? 'is-done' : ''}`}>
                <div className="hl-item-top">
                  <span className="hl-scope">{e.scope}</span>
                  <span className="hl-count" title="Số lần lặp">
                    ×{e.count}
                  </span>
                  {e.resolved && <span className="hl-tag">đã xử lý</span>}
                </div>
                <p className="hl-msg">{e.message}</p>
                <div className="hl-meta">
                  <span>lần đầu {when(e.firstSeenAt)}</span>
                  <span>gần nhất {when(e.lastSeenAt)}</span>
                  <button
                    className="hl-btn"
                    disabled={busy}
                    onClick={() => act({ id: e.id, action: e.resolved ? 'unresolve' : 'resolve' })}
                  >
                    {e.resolved ? 'Mở lại' : 'Đánh dấu xong'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {!loading &&
        data &&
        tab === 'abuse' &&
        (data.abuseEvents.length === 0 ? (
          <p className="hl-dim">Chưa có sự kiện vượt ngưỡng nào.</p>
        ) : (
          <ul className="hl-list">
            {data.abuseEvents.map((e) => (
              <li key={e.id} className="hl-item">
                <div className="hl-item-top">
                  <span className="hl-scope">{e.subject}</span>
                  <span className={`hl-tag ${e.verdict === 'lock' ? 'hl-danger' : ''}`}>
                    {e.verdict === 'lock' ? 'đã khoá' : 'theo dõi'}
                  </span>
                  <span className="hl-count">
                    {e.kind} · {e.count} lượt
                  </span>
                </div>
                <div className="hl-meta">
                  <span>{e.path ?? '—'}</span>
                  <span>{when(e.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {!loading &&
        data &&
        tab === 'blocked' &&
        (data.subjects.length === 0 ? (
          <p className="hl-dim">Chưa chặn ai.</p>
        ) : (
          <ul className="hl-list">
            {data.subjects.map((s) => (
              <li key={s.id} className="hl-item">
                <div className="hl-item-top">
                  <span className="hl-scope">{s.subject}</span>
                  <span className={`hl-tag ${s.status === 'locked' ? 'hl-danger' : ''}`}>
                    {s.status}
                  </span>
                  <span className="hl-count">{s.strikes} lần</span>
                </div>
                <div className="hl-meta">
                  <span>
                    {s.lastKind ?? '—'} · {when(s.lastSeenAt)}
                  </span>
                  {s.status !== 'normal' && (
                    <button
                      className="hl-btn"
                      disabled={busy}
                      onClick={() => act({ subject: s.subject, action: 'unlock' })}
                    >
                      Gỡ chặn
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {data && (
        <p className="hl-foot">
          Dữ liệu giữ {data.retentionDays} ngày, cron dọn mỗi đêm. Lỗi chưa xử lý thì giữ lại dù cũ.
        </p>
      )}
    </div>
  );
}
