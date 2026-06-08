/* ═══ Money Brain — History Metrics (Phase 3) ═══
 * PURE functions. Tính lịch sử thu/chi theo tháng TỪ transactions có sẵn.
 * KHÔNG fabricate tháng thiếu dữ liệu.
 */

import type { MoneySnapshotV1, MoneyTransactionSnapshot } from './types';
import { getMonthKey } from './dateRange';

export interface MonthlyHistoryPoint {
  monthKey: string;
  income: number;
  expense: number;
  netCashflow: number;
  savingsRate: number;
}

function txMonthKey(t: MoneyTransactionSnapshot, timezone: string): string {
  return t.monthKey ?? (t.dateKey ? t.dateKey.slice(0, 7) : getMonthKey(t.date, timezone));
}

/** Các monthKey có dữ liệu giao dịch, sort tăng dần. */
export function getAvailableMonthKeys(snapshot: MoneySnapshotV1): string[] {
  const set = new Set<string>();
  for (const t of snapshot.transactions) {
    set.add(txMonthKey(t, snapshot.timezone));
  }
  return [...set].sort();
}

function savingsRate(income: number, expense: number): number {
  if (income <= 0) return expense > 0 ? -100 : 0;
  return ((income - expense) / income) * 100;
}

/**
 * Lịch sử thu/chi theo tháng (tăng dần). Nếu `months` cho trước, lấy N tháng GẦN NHẤT.
 * Chỉ gồm tháng thật sự có giao dịch — không bịa tháng trống.
 */
export function getMonthlyHistory(
  snapshot: MoneySnapshotV1,
  months?: number,
): MonthlyHistoryPoint[] {
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const t of snapshot.transactions) {
    if (t.type === 'transfer') continue;
    const mk = txMonthKey(t, snapshot.timezone);
    const e = byMonth.get(mk) ?? { income: 0, expense: 0 };
    if (t.type === 'income') e.income += t.amount;
    else if (t.type === 'expense') e.expense += t.amount;
    byMonth.set(mk, e);
  }

  const points = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([monthKey, e]) => ({
      monthKey,
      income: e.income,
      expense: e.expense,
      netCashflow: e.income - e.expense,
      savingsRate: savingsRate(e.income, e.expense),
    }));

  if (typeof months === 'number' && months > 0 && points.length > months) {
    return points.slice(points.length - months);
  }
  return points;
}

/** Có đủ tối thiểu `minMonths` tháng dữ liệu không. */
export function hasEnoughHistory(snapshot: MoneySnapshotV1, minMonths = 3): boolean {
  return getAvailableMonthKeys(snapshot).length >= minMonths;
}
