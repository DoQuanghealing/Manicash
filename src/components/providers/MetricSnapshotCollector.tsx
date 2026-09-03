/* ═══ R&D — Thu bản ghi chỉ số theo NGÀY (client → /api/telemetry/snapshot) ═══
 * "Chụp" ở đây = LƯU MỘT HÀNG SỐ LIỆU/ngày (không phải ảnh): Health Score + hành vi
 * (rank/xp/streak + thói quen dùng app) + điểm thành phần sức khoẻ tài chính.
 * KHÔNG còn gửi số dư — xem chú thích ở `scalars`.
 * An toàn: chỉ gửi 1 lần/ngày (giờ địa phương); server tự BỎ nếu user chưa đồng ý
 * (analyticsConsent) hoặc là tài khoản test. Không gửi gì "sâu trong máy".
 */
'use client';

import { useEffect, useRef } from 'react';
import { useMoneySnapshotV1 } from '@/hooks/useMoneySnapshotV1';
import { getFinancialHealthScore } from '@/lib/moneyBrain';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useChatHistoryStore } from '@/stores/useChatHistoryStore';
import { buildUsageBehavior } from '@/lib/behavior/usageMetrics';
import { apiUrl } from '@/lib/apiBase';
import { getFirebaseAuth } from '@/lib/firebase/config';

const SENT_KEY = 'manicash-snapshot-sent-date';

/** YYYY-MM-DD theo giờ máy (KHÔNG UTC). */
function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA'); // en-CA → 2026-07-08
}

export default function MetricSnapshotCollector() {
  const snapshot = useMoneySnapshotV1();
  const user = useAuthStore((s) => s.user);
  const sending = useRef(false);

  useEffect(() => {
    if (!user || sending.current) return;

    const today = todayLocal();
    let lastSent: string | null = null;
    try {
      lastSent = localStorage.getItem(SENT_KEY);
    } catch {
      /* ignore */
    }
    if (lastSent === today) return; // đã gửi hôm nay

    sending.current = true;
    (async () => {
      try {
        const fbUser = getFirebaseAuth().currentUser;
        if (!fbUser) return;
        const token = await fbUser.getIdToken();

        const health = getFinancialHealthScore(snapshot);
        const fin = useFinanceStore.getState();

        /* Hành vi DÙNG APP — ghi chép đều không, ghi ngay hay dồn, dùng nông hay
         * sâu. Toàn bộ suy từ id + ngày của giao dịch, KHÔNG đụng số tiền.
         * Xem src/lib/behavior/usageMetrics.ts. */
        const usage = buildUsageBehavior({
          transactions: fin.transactions.map((t) => ({ id: t.id, dateKey: t.dateKey, date: t.date })),
          features: {
            goals: useGoalsStore.getState().goals.length > 0,
            chat: useChatHistoryStore.getState().messages.length > 0,
            tasks: useTaskStore.getState().tasks.length > 0,
            bills: fin.fixedBills.length > 0,
          },
        });

        const payload = {
          dateLocal: today,
          healthScore: health.total,
          behavior: {
            rank: user.rank,
            xp: user.xp,
            streak: user.streak,
            resistCount: user.resistCount ?? 0,
            usage,
          },
          /* ⚠️ ĐÃ BỎ mainBalance / emergencyBalance / billFundBalance.
           * PO chốt 03/09: CRM quản hành vi, KHÔNG lấy số liệu tiền. Ba trường
           * còn lại là ĐIỂM THÀNH PHẦN của health score (0|12|25 · 0|8|15 ·
           * 0|10|20), không phải số dư — nên giữ được.
           * Thêm lại số dư vào đây là biến tệp hành vi thành tệp tài chính, khác
           * hẳn mức nhạy cảm và khác cả thứ người dùng đã đồng ý. */
          scalars: {
            cashflow: health.cashflow,
            budgetDiscipline: health.budgetDiscipline,
            emergencyRunway: health.emergencyRunway,
          },
          schemaVersion: '2',
          appVersion: '1.0',
        };

        const res = await fetch(apiUrl('/api/telemetry/snapshot'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // Ghi guard kể cả khi server "skip" (chưa consent) → không spam trong ngày.
        if (res.ok) {
          try {
            localStorage.setItem(SENT_KEY, today);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* im lặng — thử lại lần mở app sau */
      } finally {
        sending.current = false;
      }
    })();
    // Chạy khi user sẵn sàng; snapshot đọc tại thời điểm gửi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return null;
}
