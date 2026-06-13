/* ═══ RolloverGuard — Run budget month rollover once on app load ═══
 * Mounts ở app layout → `checkAndRollover()` chạy 1 lần duy nhất khi app load,
 * bất kể user mở trang nào đầu tiên.
 * Idempotent — nếu cùng tháng thì no-op; nếu tháng mới → grant XP + generate report.
 */
'use client';

import { useEffect } from 'react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { areCoreStoresHydrated } from '@/stores/useHydrationStore';

export default function RolloverGuard() {
  const checkAndRollover = useBudgetStore((s) => s.checkAndRollover);

  useEffect(() => {
    // Phase 6B-1.5: KHÔNG rollover trước khi core stores hydrate (tránh dùng seed/
    // currentMonth chưa load). Persist localStorage rehydrate đồng bộ nên thường đã sẵn;
    // guard đề phòng + retry ngắn nếu chưa.
    if (areCoreStoresHydrated()) {
      checkAndRollover();
      return;
    }
    const t = setTimeout(() => {
      if (areCoreStoresHydrated()) checkAndRollover();
    }, 50);
    return () => clearTimeout(t);
  }, [checkAndRollover]);

  return null; // No UI — pure side-effect component
}
