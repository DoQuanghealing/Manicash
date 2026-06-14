'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { apiUrl } from '@/lib/apiBase';
import { useAuthStore } from '@/stores/useAuthStore';
import '../payment.css';

type State = 'checking' | 'paid' | 'pending';

export default function SuccessClient() {
  const params = useSearchParams();
  const orderCode = params.get('orderCode') || '';
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getFirebaseAuth } = await import('@/lib/firebase/config');
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(apiUrl(`/api/payos/status?orderCode=${encodeURIComponent(orderCode)}`), { headers });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.paid) {
          updateUserProfile({
            tier: 'pro',
            plan: 'premium',
            isPremium: true,
            billingProvider: 'payos',
            ...(typeof data.premiumExpiresAt === 'string' ? { premiumExpiresAt: data.premiumExpiresAt } : {}),
          });
          setState('paid');
        } else {
          setState('pending');
        }
      } catch {
        if (!cancelled) setState('pending');
      }
    })();
    return () => {
      cancelled = true;
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
