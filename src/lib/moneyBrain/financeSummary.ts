/* ═══ Money Brain — Finance Summary by Period (Phase 0 helper) ═══
 * PURE. Dùng snapshot.clientNow + snapshot.timezone. KHÔNG Date.now(), KHÔNG Zustand.
 * Phase 1 sẽ mở rộng thành engine đầy đủ; đây là tối thiểu phục vụ "hôm nay vs tháng".
 */

import type { MoneySnapshotV1 } from './types';
import { isTransactionInPeriod, type MoneyPeriod } from './dateRange';

function sumByPeriod(
  snapshot: MoneySnapshotV1,
  period: MoneyPeriod,
  type: 'income' | 'expense',
): number {
  const ctx = { clientNow: snapshot.clientNow, timezone: snapshot.timezone };
  let total = 0;
  for (const t of snapshot.transactions) {
    if (t.type !== type) continue;
    if (!isTransactionInPeriod(t, period, ctx)) continue;
    total += t.amount;
  }
  return total;
}

export function getExpenseForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  return sumByPeriod(snapshot, period, 'expense');
}

export function getIncomeForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  return sumByPeriod(snapshot, period, 'income');
}
