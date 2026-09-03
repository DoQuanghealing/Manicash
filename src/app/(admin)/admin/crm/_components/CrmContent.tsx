/* ═══ Admin M5 — CRM hành vi ═══
 * Trả lời một câu: AI ĐANG TRÔI, và quản gia nên mở lời thế nào.
 * Không có số tiền ở đây — xem lib/admin/crm.ts.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { authHeaders } from '@/lib/adminClient';
import './crm.css';

interface Usage {
  daysLogged7: number | null;
  daysLogged30: number | null;
  currentStreak: number | null;
  longestGapDays: number | null;
  returnedAfterGap: boolean | null;
  medianLagMinutes: number | null;
  sameDayRate: number | null;
  promptRate: number | null;
  lagSampleSize: number | null;
  featureDepth: number | null;
  features: Record<string, boolean> | null;
}

interface Row {
  uid: string;
  email: string | null;
  dateLocal: string;
  rank: string | null;
  streak: number | null;
  usage: Usage | null;
  signal: string | null;
  daysSinceSnapshot: number;
}

/** Nhãn + lời gợi ý cho quản gia, theo từng tín hiệu. */
const SIGNAL: Record<string, { label: string; tone: string; advice: string }> = {
  dang_troi: {
    label: 'Đang trôi',
    tone: 'crm-danger',
    advice: 'Bảy ngày không ghi gì. Hỏi thăm nhẹ, đừng nhắc chỉ tiêu.',
  },
  da_quay_lai: {
    label: 'Vừa quay lại',
    tone: 'crm-good',
    advice: 'Bỏ bê rồi quay lại — khen ngay lúc này, đừng nhắc chuyện đã bỏ.',
  },
  hay_don_cuoi_ngay: {
    label: 'Hay ghi dồn',
    tone: 'crm-warn',
    advice: 'Ghi trễ nên số liệu dễ sai. Gợi ý bật nhắc ngay sau khi tiêu.',
  },
  dung_nong: {
    label: 'Dùng nông',
    tone: 'crm-warn',
    advice: 'Mới chạm một tính năng. Mời thử đặt một mục tiêu nhỏ.',
  },
  ghi_deu: { label: 'Ghi đều', tone: 'crm-good', advice: 'Đang tốt — để yên, thỉnh thoảng khen.' },
  chua_du_du_lieu: {
    label: 'Chưa đủ dữ liệu',
    tone: 'crm-dim',
    advice: 'Dưới 3 ngày có ghi. Chưa nên kết luận gì.',
  },
};

function lagText(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min} phút`;
  if (min < 1440) return `${Math.round(min / 60)} giờ`;
  return `${Math.round(min / 1440)} ngày`;
}

export default function CrmContent() {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) { setError('Phiên đăng nhập hết hạn — đăng nhập lại.'); return; }
      const res = await fetch(apiUrl('/api/admin/crm'), { headers });
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setScanned(data.scanned ?? 0);
    } catch {
      setError('Không đọc được dữ liệu hành vi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) if (r.signal) c[r.signal] = (c[r.signal] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.signal === filter)),
    [rows, filter],
  );

  return (
    <div className="crm-wrap">
      <header className="crm-head">
        <h1 className="adm-page-title">CRM hành vi</h1>
        <p className="crm-sub">
          Chỉ hiện người <strong>đã bật đóng góp dữ liệu</strong> trong Hồ sơ. Người chưa bật
          không có hàng ở đây — đó là <em>chưa cho phép</em>, không phải <em>không dùng app</em>.
        </p>
      </header>

      {error && <div className="crm-error">{error}</div>}

      <div className="crm-chips">
        <button
          className={`crm-chip ${filter === 'all' ? 'is-on' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả <b>{rows.length}</b>
        </button>
        {Object.entries(SIGNAL).map(([key, meta]) =>
          counts[key] ? (
            <button
              key={key}
              className={`crm-chip ${meta.tone} ${filter === key ? 'is-on' : ''}`}
              onClick={() => setFilter(key)}
            >
              {meta.label} <b>{counts[key]}</b>
            </button>
          ) : null,
        )}
      </div>

      {loading ? (
        <p className="crm-dim-text">Đang tải…</p>
      ) : shown.length === 0 ? (
        <div className="crm-empty">
          <p><strong>Chưa có hồ sơ hành vi nào.</strong></p>
          <p>
            Dữ liệu chỉ chảy về khi người dùng tự bật &ldquo;Đóng góp dữ liệu&rdquo; trong Hồ sơ —
            mặc định tắt theo Nghị định 13/2023. Đã quét {scanned} bản ghi.
          </p>
        </div>
      ) : (
        <ul className="crm-list">
          {shown.map((r) => {
            const meta = r.signal ? SIGNAL[r.signal] : null;
            const u = r.usage;
            return (
              <li key={r.uid} className="crm-item">
                <div className="crm-item-top">
                  <span className="crm-email">{r.email ?? r.uid.slice(0, 10)}</span>
                  {meta && <span className={`crm-badge ${meta.tone}`}>{meta.label}</span>}
                  {r.daysSinceSnapshot > 1 && (
                    <span className="crm-stale">số liệu {r.daysSinceSnapshot} ngày trước</span>
                  )}
                </div>

                {meta && <p className="crm-advice">{meta.advice}</p>}

                {u && (
                  <div className="crm-metrics">
                    <span><b>{u.daysLogged7 ?? '—'}</b>/7 ngày có ghi</span>
                    <span>chuỗi <b>{u.currentStreak ?? '—'}</b></span>
                    <span>ghi trễ <b>{lagText(u.medianLagMinutes)}</b></span>
                    <span>cùng ngày <b>{u.sameDayRate !== null ? `${u.sameDayRate}%` : '—'}</b></span>
                    <span>chạm <b>{u.featureDepth ?? '—'}</b>/4 tính năng</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
