/* ═══ DailyCheckinReminderGuard — Lên lịch nhắc "Tổng kết tối" 21h ═══
 * Chạy 1 lần trong app layout khi dailyReminderEnabled = true.
 * Dùng setTimeout tới 21h00 → hiện Web Notification (works khi app mở / tab ẩn).
 * Khi app tắt hoàn toàn cần push server — TODO phase sau.
 */
'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { createDailyCheckIn } from '@/lib/aiMoneyChat/dailyCheckin';

export default function DailyCheckinReminderGuard() {
  const enabled = useSettingsStore((s) => s.dailyReminderEnabled);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    let timer: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const now = new Date();
      const target = new Date(now);
      target.setHours(21, 0, 0, 0);
      if (now >= target) target.setDate(target.getDate() + 1);
      const ms = target.getTime() - now.getTime();

      timer = setTimeout(() => {
        try {
          const checkIn = createDailyCheckIn({
            slot: 'evening',
            now: new Date(),
            transactions: useFinanceStore.getState().transactions,
            monthlySpendingLimit: useBudgetStore.getState().getTotalCategoryLimits(),
          });
          new Notification('ManiCash · Tổng kết 21h', {
            body: checkIn.message,
            icon: '/icons/icon-192.png',
            tag: 'daily-checkin',
          });
        } catch {
          // Notification blocked or API unavailable — ignore
        }
        scheduleNext();
      }, ms);
    }

    scheduleNext();
    return () => clearTimeout(timer);
  }, [enabled]);

  return null;
}
