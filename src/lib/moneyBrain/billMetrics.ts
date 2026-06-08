/* ═══ Money Brain — Bill Metrics (Phase 1) ═══
 * PURE functions. Tính coverage, upcoming bills dựa trên dueDay và clientNow/timezone.
 * Không dùng Date.now() / server timezone.
 */

import type { MoneySnapshotV1, MoneyBillSnapshot } from './types';
import { getTodayKey, shiftDateKey } from './dateRange';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Trả ra dateKey (YYYY-MM-DD) cho ngày đến hạn của bill trong tháng được chỉ định.
 *  Trả null nếu dueDay vượt quá số ngày trong tháng. */
function getBillDueDateKey(year: number, month: number, dueDay: number): string | null {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // month là 1-based → UTC(y, m, 0) = last day of month m
  if (dueDay < 1 || dueDay > lastDay) return null;
  return `${year}-${pad2(month)}-${pad2(dueDay)}`;
}

// ─── Paid / unpaid ────────────────────────────────────────────────────────────

export function getUnpaidBills(snapshot: MoneySnapshotV1): MoneyBillSnapshot[] {
  return snapshot.bills.filter((b) => !b.isPaid);
}

export function getPaidBills(snapshot: MoneySnapshotV1): MoneyBillSnapshot[] {
  return snapshot.bills.filter((b) => b.isPaid);
}

// ─── Totals ───────────────────────────────────────────────────────────────────

/** Tổng tất cả bills (kể cả đã đóng) — dùng để tính coverage của billFund. */
export function getTotalFixedBills(snapshot: MoneySnapshotV1): number {
  return snapshot.bills.reduce((sum, b) => sum + b.amount, 0);
}

/** Tổng bills chưa đóng — dùng cho safe-to-spend. */
export function getTotalUnpaidBills(snapshot: MoneySnapshotV1): number {
  return getUnpaidBills(snapshot).reduce((sum, b) => sum + b.amount, 0);
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

/**
 * Tỷ lệ billFund / tổng bills chưa đóng.
 * Nếu không có bill chưa đóng → coverage = 1 (full).
 */
export function getBillFundCoverageRate(snapshot: MoneySnapshotV1): number {
  const unpaid = getTotalUnpaidBills(snapshot);
  if (unpaid <= 0) return 1;
  return snapshot.wallets.billFund / unpaid;
}

/** Số tiền billFund còn thiếu để đủ trả hết bills chưa đóng. */
export function getBillFundGap(snapshot: MoneySnapshotV1): number {
  return Math.max(0, getTotalUnpaidBills(snapshot) - snapshot.wallets.billFund);
}

/** Số dư ví chính sau khi trừ bills chưa đóng. */
export function getRemainingMainBalanceAfterUnpaidBills(snapshot: MoneySnapshotV1): number {
  return snapshot.wallets.main - getTotalUnpaidBills(snapshot);
}

// ─── Upcoming bills ───────────────────────────────────────────────────────────

/**
 * Các bill chưa đóng có due date trong khoảng [hôm nay, hôm nay + days].
 * Tính theo dueDay trong tháng hiện tại và tháng tiếp theo (nếu range bắc cầu).
 * Bill với dueDay vượt số ngày trong tháng → bỏ qua.
 */
export function getUpcomingBills(
  snapshot: MoneySnapshotV1,
  days: number,
): MoneyBillSnapshot[] {
  const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);
  const endKey = shiftDateKey(todayKey, Math.max(0, days));

  const [ty, tm] = todayKey.split('-').map(Number);

  // Tháng cần check: current + optionally next (nếu endKey spans into next month)
  const monthsToCheck: [number, number][] = [[ty, tm]];
  const [ey, em] = endKey.split('-').map(Number);
  if (ey !== ty || em !== tm) {
    monthsToCheck.push([ey, em]);
  }

  const results: MoneyBillSnapshot[] = [];
  const seen = new Set<string>();

  for (const bill of snapshot.bills) {
    if (bill.isPaid) continue;
    for (const [y, m] of monthsToCheck) {
      const dueDateKey = getBillDueDateKey(y, m, bill.dueDay);
      if (!dueDateKey) continue;
      if (dueDateKey >= todayKey && dueDateKey <= endKey && !seen.has(bill.id)) {
        results.push(bill);
        seen.add(bill.id);
      }
    }
  }

  return results.sort((a, b) => a.dueDay - b.dueDay);
}
