'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { apiUrl } from '@/lib/apiBase';
import { useAuthStore } from '@/stores/useAuthStore';
import { PRO_JUST_ACTIVATED_KEY } from '@/components/ui/ProActivatedCelebration';
import '../payment.css';

type State = 'checking' | 'paid' | 'pending';

/** Webhook thường tới trong vài giây, nhưng có thể trễ — poll thay vì hỏi 1 lần rồi bỏ mặc user. */
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // ~60s

export default function SuccessClient() {
  const params = useSearchParams();
  const orderCode = params.get('orderCode') || '';
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkOnce(): Promise<boolean> {
      try {
        const { getFirebaseAuth } = await import('@/lib/firebase/config');
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(apiUrl(`/api/payos/status?orderCode=${encodeURIComponent(orderCode)}`), { headers });
        const data = await res.json().catch(() => null);
        if (cancelled) return true;
        if (data?.paid) {
          updateUserProfile({
            tier: 'pro',
            plan: 'premium',
            isPremium: true,
            billingProvider: 'payos',
            ...(typeof data.premiumExpiresAt === 'string' ? { premiumExpiresAt: data.premiumExpiresAt } : {}),
          });
          try { sessionStorage.setItem(PRO_JUST_ACTIVATED_KEY, '1'); } catch { /* privacy mode — bỏ qua */ }
          setState('paid');
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    (async () => {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        const done = await checkOnce();
        if (cancelled || done) return;
        // Hiện "đang chờ" từ lượt thứ 2 trở đi — lượt đầu vẫn giữ spinner "đang xác nhận".
        if (attempt === 0) setState('pending');
        await new Promise((resolve) => {
          timer = setTimeout(resolve, POLL_INTERVAL_MS);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderCode, updateUserProfile]);

  return (
    <div className="pay-card">
      {state === 'checking' && (
        <>
          <Loader2 size={48} className="pay-spin pay-icon-muted" />
          <h1>Đang xác nhận thanh toán…</h1>
          <p>Chờ mình một chút nhé.</p>
        </>
      )}
      {state === 'paid' && (
        <>
          <div className="pay-icon pay-icon-ok"><CheckCircle2 size={40} /></div>
          <h1>Chúc mừng! Bạn đã là Pro 💎</h1>
          <p>Cảm ơn bạn đã đồng hành cùng ManiCash. Toàn bộ tính năng Pro đã được mở khoá.</p>
        </>
      )}
      {state === 'pending' && (
        <>
          <div className="pay-icon pay-icon-wait"><Clock size={36} /></div>
          <h1>Đang chờ xác nhận</h1>
          <p>Nếu bạn vừa thanh toán, Pro sẽ được kích hoạt trong giây lát. Mở lại app sau ít phút nhé.</p>
        </>
      )}
      <Link href="/money" className="pay-btn">Về trang chính</Link>
    </div>
  );
}
