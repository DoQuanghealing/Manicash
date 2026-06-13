/* AccountDeletionGate - blocks app shell for accounts pending deletion */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { signOut as firebaseSignOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { clearLocalMoneyPersistence } from '@/stores/clearLocalPersistence';
import { apiUrl } from '@/lib/apiBase';
import './AccountDeletionGate.css';

interface Props {
  children: React.ReactNode;
}

async function getIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('NO_AUTH_USER');
  return user.getIdToken(true);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'đang đến hạn xóa';
  const totalHours = Math.ceil(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days <= 0) return `${hours} giờ`;
  return `${days} ngày ${hours} giờ`;
}

export default function AccountDeletionGate({ children }: Props) {
  const user = useAuthStore((state) => state.user);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const logout = useAuthStore((state) => state.logout);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmation, setConfirmation] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const scheduledAtMs = useMemo(() => {
    if (!user?.deletionScheduledAt) return null;
    const parsed = new Date(user.deletionScheduledAt).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }, [user?.deletionScheduledAt]);

  if (user?.accountStatus !== 'pending_deletion') {
    return <>{children}</>;
  }

  const pendingUser = user;
  const remaining = scheduledAtMs === null
    ? '30 ngay'
    : formatRemaining(scheduledAtMs - nowMs);
  const scheduledDate = user.deletionScheduledAt
    ? new Date(user.deletionScheduledAt).toLocaleString('vi-VN')
    : 'chua xac dinh';

  async function cancelDeletion() {
    setIsBusy(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(apiUrl('/api/account/deletion'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) throw new Error('CANCEL_FAILED');
      const next = await res.json();
      setUserProfile({
        ...pendingUser,
        accountStatus: next.accountStatus,
        deletionRequestedAt: undefined,
        deletionScheduledAt: undefined,
        deletionReason: undefined,
        deletionMode: undefined,
        deletionCancelledAt: new Date().toISOString(),
      });
    } catch {
      setError('Không thể khôi phục tài khoản lúc này. Vui lòng thử lại.');
    } finally {
      setIsBusy(false);
    }
  }

  async function continueWaiting() {
    setIsBusy(true);
    await fetch(apiUrl('/api/auth/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => undefined);
    await firebaseSignOut().catch(() => undefined);
    logout();
    clearLocalMoneyPersistence();
    window.location.assign('/login');
  }

  async function deleteImmediately() {
    if (confirmation !== 'DELETE') return;
    setIsBusy(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(apiUrl('/api/account/deletion'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'immediate', confirmation }),
      });
      if (!res.ok) throw new Error('DELETE_FAILED');
      await firebaseSignOut().catch(() => undefined);
      logout();
      clearLocalMoneyPersistence();
      window.location.assign('/login?deletion=completed');
    } catch {
      setError('Không thể xóa vĩnh viễn lúc này. Vui lòng đăng nhập lại và thử tiếp.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="acct-gate">
      <section className="acct-gate-panel">
        <p className="acct-gate-eyebrow">Tài khoản đang chờ xóa</p>
        <h1>Bạn còn {remaining} để đổi ý</h1>
        <p className="acct-gate-copy">
          Tài khoản ManiCash này đã được lên lịch xóa vào {scheduledDate}. Nếu
          khôi phục bây giờ, toàn bộ thông tin hiện có sẽ được giữ lại.
        </p>

        <div className="acct-gate-actions">
          <button type="button" onClick={cancelDeletion} disabled={isBusy}>
            Khôi phục tài khoản
          </button>
          <button type="button" onClick={continueWaiting} disabled={isBusy}>
            Tiếp tục chờ xóa
          </button>
        </div>

        <div className="acct-gate-immediate">
          <h2>Xóa vĩnh viễn ngay</h2>
          <p>
            Lựa chọn này bỏ qua thời gian chờ 30 ngày. Nhập DELETE để xác nhận.
          </p>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
          />
          <button
            type="button"
            className="acct-gate-danger"
            onClick={deleteImmediately}
            disabled={isBusy || confirmation !== 'DELETE'}
          >
            Xóa vĩnh viễn
          </button>
        </div>

        {error && <p className="acct-gate-error">{error}</p>}
      </section>
    </main>
  );
}
