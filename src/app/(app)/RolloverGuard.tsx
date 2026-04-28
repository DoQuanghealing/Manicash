/* ═══ RolloverGuard — Run budget month rollover once on app load ═══
 * Mounts ở app layout → `checkAndRollover()` chạy 1 lần duy nhất khi app load,
 * bất kể user mở trang nào đầu tiên.
 * Idempotent — nếu cùng tháng thì no-op; nếu tháng mới → grant XP + generate report.
 */
'use client';

import { useEffect } from 'react';
import { useBudgetStore } from '@/stores/useBudgetStore';

export default function RolloverGuard() {
  const checkAndRollover = useBudgetStore((s) => s.checkAndRollover);

  useEffect(() => {
    checkAndRollover();
  }, [checkAndRollover]);

  return null; // No UI — pure side-effect component
}
