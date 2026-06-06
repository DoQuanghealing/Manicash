/* AccountDeletionDialog - 30-day account deletion request */
'use client';

import { useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { signOut as firebaseSignOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { downloadUserDataJSON } from '@/lib/exportUserData';
import './AccountDeletionDialog.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

async function getIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('NO_AUTH_USER');
  return user.getIdToken(true);
}

export default function AccountDeletionDialog({ isOpen, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logout = useAuthStore((state) => state.logout);

  if (!isOpen) return null;

  async function requestDeletion() {
    if (!confirmed || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/account/deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'request',
          reason,
        }),
      });

      if (!res.ok) throw new Error('REQUEST_FAILED');

      await firebaseSignOut().catch(() => undefined);
      logout();
      window.location.assign('/login?deletion=requested');
    } catch {
      setError('Không thể gửi yêu cầu xóa tài khoản. Vui lòng đăng nhập lại và thử tiếp.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="acct-del-backdrop" role="presentation" onClick={onClose}>
      <section
        className="acct-del-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acct-del-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="acct-del-header">
          <p className="acct-del-eyebrow">Xóa tài khoản</p>
          <h2 id="acct-del-title">Cho bạn 30 ngày để suy nghĩ lại</h2>
          <p>
            ManiCash sẽ lên lịch xóa tài khoản sau 30 ngày. Trong thời gian đó,
            nếu đăng nhập lại bạn có thể khôi phục toàn bộ thông tin.
          </p>
        </header>

        <div className="acct-del-list">
          <span>Dữ liệu tài chính, mục tiêu, wishlist và nhiệm vụ sẽ bị xóa.</span>
          <span>Webhook token và giao dịch đang chờ sẽ bị xóa.</span>
          <span>Sau ngày xóa dự kiến, tài khoản không thể khôi phục.</span>
        </div>

        {/* Export data before deletion */}
        <div className="acct-del-export">
          <p className="acct-del-export-label">
            💾 Tải dữ liệu trước khi xóa
            {exportDone && <span className="acct-del-export-done"> ✓ Đã tải</span>}
          </p>
          <button
            type="button"
            className="acct-del-export-btn"
            disabled={isExporting}
            onClick={() => {
              setIsExporting(true);
              try {
                downloadUserDataJSON();
                setExportDone(true);
              } finally {
                setIsExporting(false);
              }
            }}
          >
            {isExporting ? 'Đang xuất...' : 'Tải JSON'}
          </button>
        </div>

        <label className="acct-del-field">
          <span>Lý do xóa (không bắt buộc)</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Điều gì khiến bạn muốn rời ManiCash?"
          />
        </label>

        <label className="acct-del-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>Tôi hiểu tài khoản sẽ bị xóa vĩnh viễn sau 30 ngày nếu tôi không khôi phục.</span>
        </label>

        {error && <p className="acct-del-error">{error}</p>}

        <footer className="acct-del-actions">
          <button type="button" className="acct-del-secondary" onClick={onClose}>
            Suy nghĩ thêm
          </button>
          <button
            type="button"
            className="acct-del-danger"
            disabled={!confirmed || isSubmitting}
            onClick={requestDeletion}
          >
            {isSubmitting ? 'Đang gửi...' : 'Yêu cầu xóa tài khoản'}
          </button>
        </footer>
      </section>
    </div>
  );
}
