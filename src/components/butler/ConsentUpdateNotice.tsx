/* ═══ Thông báo bản cập nhật — xin đồng ý đóng góp dữ liệu (Nghị định 13/2023) ═══
 * Hiện MỘT lần cho người dùng cũ chưa bật "Đóng góp dữ liệu". Nói thẳng lấy gì,
 * không lấy gì, dùng vào việc gì — đồng ý mơ hồ không phải đồng ý thật.
 *
 * "Để sau" phải ngang hàng "Đồng ý" và KHÔNG khoá tính năng nào: đồng ý bị ép thì
 * không có giá trị theo NĐ 13. Từ chối → 14 ngày sau mới hỏi lại.
 *
 * Không hiện khi: chưa làm quen quản gia (màn đó tự hỏi cấp độ), đang mở màn làm
 * quen / lời mời Phú Vương, đang giả lập, hoặc server đã ghi đồng ý.
 */
'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useButlerWizardStore } from '@/stores/useButlerWizardStore';
import { useSovereignInviteStore } from '@/stores/useSovereignInviteStore';
import { isSimulationActive } from '@/stores/simulationStorage';
import { requestSnapshotNow } from '@/lib/telemetry/snapshotNow';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';
import '@/components/butler/butler-onboarding.css';
import './consent-update-notice.css';

/** Đổi hậu tố khi nội dung xin đồng ý đổi → hỏi lại tất cả. */
const NOTICE_KEY = 'manicash-consent-notice-v1';
const LATER_DAYS = 14;

/** 'done' = đã xử lý xong · số = hẹn hỏi lại lúc đó (ms) · null = chưa từng hỏi. */
function readNotice(): string | null {
  try {
    return localStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
}
function writeNotice(v: string) {
  try {
    localStorage.setItem(NOTICE_KEY, v);
  } catch {
    /* ignore */
  }
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const u = getFirebaseAuth().currentUser;
  if (!u) return null;
  const token = await u.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function ConsentUpdateNotice() {
  const uid = useAuthStore((s) => s.user?.uid);
  const butlerOnboarded = useSettingsStore((s) => s.butlerOnboarded);
  const tier = useSettingsStore((s) => s.butlerTier);
  const setButlerTier = useSettingsStore((s) => s.setButlerTier);
  const wizardMode = useButlerWizardStore((s) => s.mode);
  const inviteMode = useSovereignInviteStore((s) => s.mode);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !butlerOnboarded) return;
    if (wizardMode !== 'closed' || inviteMode !== 'closed') return;
    if (isSimulationActive()) return;

    const mark = readNotice();
    if (mark === 'done') return;
    if (mark && Date.now() < Number(mark)) return;

    let cancelled = false;
    (async () => {
      try {
        const h = await authHeaders();
        if (!h) return;
        const res = await fetch(apiUrl('/api/telemetry/consent'), { headers: h });
        if (!res.ok) return; // đọc hỏng thì thôi, lần mở app sau hỏi lại
        const data = await res.json();
        if (data?.granted === true) {
          writeNotice('done'); // đã bật từ trước (Hồ sơ / quản gia Thông thái)
          return;
        }
        if (!cancelled) setOpen(true);
      } catch {
        /* im lặng */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, butlerOnboarded, wizardMode, inviteMode]);

  if (!open) return null;

  async function accept() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const h = await authHeaders();
      if (!h) throw new Error('no auth');
      const res = await fetch(apiUrl('/api/telemetry/consent'), {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ granted: true, scope: 'analytics' }),
      });
      if (!res.ok) throw new Error('write failed');
      // Cấp 'basic' nghĩa là "không ghi dữ liệu" → đồng ý rồi thì lên Thông thái.
      if (tier === 'basic') setButlerTier('wise');
      writeNotice('done');
      requestSnapshotNow();
      setOpen(false);
    } catch {
      // Không đóng hộp: đóng lại là người dùng tưởng đã bật trong khi server chưa ghi.
      setError('Chưa lưu được. Thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }

  function later() {
    writeNotice(String(Date.now() + LATER_DAYS * 86_400_000));
    setOpen(false);
  }

  return (
    <div className="bo-overlay" role="dialog" aria-modal="true" aria-labelledby="cun-title">
      <div className="bo-card">
        <div className="bo-step">
          <span className="cun-badge">Bản cập nhật mới</span>
          <div className="cun-icon" aria-hidden><ShieldCheck size={22} /></div>
          <h2 id="cun-title" className="bo-title">Để quản gia tư vấn sát với bạn hơn</h2>
          <p className="bo-lead">
            Bản này cho quản gia học thói quen ghi chép của bạn, để nhắc đúng lúc và tư vấn
            hợp với riêng bạn. Theo <strong>Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu
            cá nhân, việc này cần bạn đồng ý.
          </p>

          <ul className="cun-list">
            <li className="cun-yes">Có lấy: số ngày bạn ghi chép, ghi ngay hay dồn cuối ngày, tính năng bạn dùng</li>
            <li className="cun-no">Không lấy: số tiền, tên khoản chi, ghi chú của bạn</li>
            <li className="cun-use">Chỉ dùng để quản gia cá nhân hoá lời tư vấn cho bạn</li>
            <li className="cun-no">Không mua bán dữ liệu của bạn</li>
          </ul>

          <p className="bo-sub">
            Không đồng ý thì app vẫn dùng bình thường. Đổi ý lúc nào cũng được ở
            Hồ sơ → Đóng góp dữ liệu.
          </p>
          {error && <p className="cun-error">{error}</p>}

          <button className="bo-btn bo-btn-primary" onClick={accept} disabled={saving}>
            {saving ? <Loader2 size={16} className="cun-spin" /> : 'Đồng ý và nâng cấp'}
          </button>
          <button className="bo-btn bo-btn-ghost" onClick={later} disabled={saving}>
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}
