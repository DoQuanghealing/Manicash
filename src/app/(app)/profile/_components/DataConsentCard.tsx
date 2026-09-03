/* ═══ Profile — Đóng góp dữ liệu hành vi (Nghị định 13/2023) ═══
 *
 * MẶC ĐỊNH TẮT, và phải tắt được bất cứ lúc nào. Đây là điều kiện pháp lý, không
 * phải lựa chọn thiết kế: hành vi gắn với danh tính là dữ liệu cá nhân.
 *
 * Chữ trong thẻ này cố ý nói THẲNG lấy gì và KHÔNG lấy gì. Viết mơ hồ kiểu "giúp
 * cải thiện trải nghiệm" thì người dùng bật mà không hiểu mình vừa đồng ý gì —
 * đó không phải đồng ý thật, và cũng không bảo vệ được ai khi có chuyện.
 *
 * Trạng thái thật nằm ở SERVER (users/{uid}.analyticsConsent). Thẻ này đọc bằng
 * GET lúc mở, không tự đoán từ bộ nhớ máy — nếu người dùng tắt ở máy khác thì
 * máy này phải thấy đúng.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';
import './data-consent.css';

async function authHeaders(): Promise<Record<string, string> | null> {
  const u = getFirebaseAuth().currentUser;
  if (!u) return null;
  const token = await u.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function DataConsentCard() {
  const [granted, setGranted] = useState<boolean | null>(null); // null = đang đọc
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await authHeaders();
      if (!h) return;
      const res = await fetch(apiUrl('/api/telemetry/consent'), { headers: h });
      if (!res.ok) throw new Error('read failed');
      const data = await res.json();
      setGranted(data?.analyticsConsent === true);
    } catch {
      // Đọc hỏng thì coi như CHƯA đồng ý — mặc định phải nghiêng về phía không thu.
      setGranted(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    if (saving || granted === null) return;
    const next = !granted;
    setSaving(true);
    setError(null);
    try {
      const h = await authHeaders();
      if (!h) throw new Error('no auth');
      const res = await fetch(apiUrl('/api/telemetry/consent'), {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ granted: next, scope: 'analytics' }),
      });
      if (!res.ok) throw new Error('write failed');
      setGranted(next);
    } catch {
      // KHÔNG đổi công tắc khi ghi hỏng: hiện "đã bật" mà server chưa ghi là nói dối
      // người dùng về một thứ thuộc quyền riêng tư của họ.
      setError('Chưa lưu được. Thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dcc-card">
      <h2 className="profile-section-title">Đóng góp dữ liệu</h2>

      <div className="dcc-body">
        <div className="dcc-icon" aria-hidden><ShieldCheck size={18} /></div>

        <div className="dcc-text">
          <strong className="dcc-title">Cho quản gia học thói quen của bạn</strong>
          <p className="dcc-desc">
            Bật thì quản gia biết bạn ghi chép đều hay hay quên, ghi ngay hay dồn cuối ngày,
            dùng những tính năng nào — để nhắc đúng lúc thay vì nhắc bừa.
          </p>

          <ul className="dcc-list">
            <li className="dcc-yes">Có lấy: số ngày bạn ghi chép, khoảng cách từ lúc tiêu tới lúc ghi, tính năng bạn mở</li>
            <li className="dcc-no">Không lấy: số tiền, tên khoản chi, ghi chú của bạn</li>
          </ul>

          <p className="dcc-note">Mặc định tắt. Tắt lại lúc nào cũng được, dữ liệu cũ sẽ ngừng dùng.</p>
          {error && <p className="dcc-error">{error}</p>}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={granted === true}
          aria-label="Đóng góp dữ liệu hành vi"
          className={`dcc-switch ${granted ? 'is-on' : ''}`}
          disabled={saving || granted === null}
          onClick={toggle}
        >
          {saving ? <Loader2 size={13} className="dcc-spin" /> : <span className="dcc-knob" />}
        </button>
      </div>
    </section>
  );
}
