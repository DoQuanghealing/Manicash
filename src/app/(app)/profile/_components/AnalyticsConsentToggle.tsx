/* ═══ Consent R&D — đóng góp dữ liệu ẩn danh (tầng metric_snapshots) ═══
 * Mặc định TẮT. Dữ liệu nhạy cảm (Nghị định 13/2023) — chỉ snapshot khi user bật.
 * Đọc/ghi qua /api/telemetry/consent (server-authoritative trên users/{uid}).
 */
'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';

async function token(): Promise<string | null> {
  const u = getFirebaseAuth().currentUser;
  return u ? u.getIdToken() : null;
}

export default function AnalyticsConsentToggle() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await token();
        if (!t) return;
        const res = await fetch(apiUrl('/api/telemetry/consent'), { headers: { Authorization: `Bearer ${t}` } });
        if (res.ok) {
          const j = await res.json();
          setGranted(j.granted === true);
        }
      } catch {
        /* im lặng — mặc định coi như chưa bật */
      }
    })();
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !(granted ?? false);
    try {
      const t = await token();
      if (!t) return;
      const res = await fetch(apiUrl('/api/telemetry/consent'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted: next }),
      });
      if (res.ok) setGranted(next);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const on = granted === true;
  return (
    <div className="profile-toggle-row">
      <div className="profile-toggle-info">
        <strong>Đóng góp dữ liệu ẩn danh</strong>
        <span>Giúp cải thiện sản phẩm (R&amp;D). Có thể tắt bất cứ lúc nào.</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Đóng góp dữ liệu ẩn danh"
        disabled={busy || granted === null}
        className={`profile-switch ${on ? 'is-on' : ''}`}
        onClick={toggle}
      >
        <span className="profile-switch-knob" />
      </button>
    </div>
  );
}
