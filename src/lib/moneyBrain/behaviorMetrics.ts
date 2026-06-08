/* ═══ Money Brain — Behavior Metrics (Phase 3) ═══
 * PURE functions. Phân tích hành vi chi tiêu THÁNG HIỆN TẠI từ transactions.
 * Không Date.now(); weekday suy từ dateKey (đã theo timezone client).
 */

import type { MoneySnapshotV1, MoneyTransactionSnapshot } from './types';
import { getTransactionsForPeriod } from './financeMetrics';
import { normalizeCategoryId } from './normalize';

function monthExpenses(snapshot: MoneySnapshotV1): MoneyTransactionSnapshot[] {
  return getTransactionsForPeriod(snapshot, 'this_month').filter((t) => t.type === 'expense');
}

/** Chi lớn nhất tháng này, desc theo amount. */
export function getLargestExpenses(
  snapshot: MoneySnapshotV1,
  limit = 5,
): MoneyTransactionSnapshot[] {
  return [...monthExpenses(snapshot)]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, Math.max(0, limit));
}

/**
 * Chi bất thường: trong danh mục có >= minCount giao dịch, giao dịch nào có
 * amount >= categoryAvg * multiplier thì bị gắn cờ.
 */
export function getUnusualExpenses(
  snapshot: MoneySnapshotV1,
  options: { multiplier?: number; minCount?: number; limit?: number } = {},
): Array<MoneyTransactionSnapshot & { reason: string }> {
  const multiplier = options.multiplier ?? 2.5;
  const minCount = options.minCount ?? 3;
  const limit = options.limit ?? 5;

  const txns = monthExpenses(snapshot);
  const byCat = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    const cid = normalizeCategoryId(t.categoryId) ?? 'other';
    const e = byCat.get(cid) ?? { total: 0, count: 0 };
    e.total += t.amount;
    e.count += 1;
    byCat.set(cid, e);
  }

  const flagged: Array<MoneyTransactionSnapshot & { reason: string }> = [];
  for (const t of txns) {
    const cid = normalizeCategoryId(t.categoryId) ?? 'other';
    const stat = byCat.get(cid);
    if (!stat || stat.count < minCount) continue;
    const avg = stat.total / stat.count;
    if (avg > 0 && t.amount >= avg * multiplier) {
      flagged.push({
        ...t,
        reason: `Cao gấp ${(t.amount / avg).toFixed(1)}× trung bình danh mục (${Math.round(avg)}đ)`,
      });
    }
  }

  return flagged.sort((a, b) => b.amount - a.amount).slice(0, Math.max(0, limit));
}

/**
 * Rò rỉ nhỏ lặp lại: giao dịch nhỏ (<= maxSingleAmount) lặp >= minCount lần
 * trong cùng danh mục. Sort theo tổng tiền desc.
 */
export function getRepeatedSmallLeaks(
  snapshot: MoneySnapshotV1,
  options: { maxSingleAmount?: number; minCount?: number; limit?: number } = {},
): Array<{
  categoryId: string;
  categoryName?: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
}> {
  const maxSingleAmount = options.maxSingleAmount ?? 100_000;
  const minCount = options.minCount ?? 3;
  const limit = options.limit ?? 5;

  const byCat = new Map<string, { name?: string; count: number; total: number }>();
  for (const t of monthExpenses(snapshot)) {
    if (t.amount > maxSingleAmount) continue;
    const cid = normalizeCategoryId(t.categoryId) ?? 'other';
    const e = byCat.get(cid) ?? { name: t.categoryName, count: 0, total: 0 };
    e.count += 1;
    e.total += t.amount;
    if (!e.name && t.categoryName) e.name = t.categoryName;
    byCat.set(cid, e);
  }

  return [...byCat.entries()]
    .filter(([, e]) => e.count >= minCount)
    .map(([categoryId, e]) => ({
      categoryId,
      categoryName: e.name,
      count: e.count,
      totalAmount: e.total,
      avgAmount: Math.round(e.total / e.count),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, Math.max(0, limit));
}

/** Cuối tuần (Thứ 7 / Chủ nhật) theo dateKey. */
function isWeekendDateKey(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=CN, 6=T7
  return day === 0 || day === 6;
}

/** Tổng chi cuối tuần tháng này + % trên tổng chi. */
export function getWeekendSpending(snapshot: MoneySnapshotV1): {
  totalAmount: number;
  count: number;
  percentageOfExpense: number;
} {
  const txns = monthExpenses(snapshot);
  const totalExpense = txns.reduce((s, t) => s + t.amount, 0);
  let totalAmount = 0;
  let count = 0;
  for (const t of txns) {
    if (t.dateKey && isWeekendDateKey(t.dateKey)) {
      totalAmount += t.amount;
      count += 1;
    }
  }
  return {
    totalAmount,
    count,
    percentageOfExpense: totalExpense > 0 ? (totalAmount / totalExpense) * 100 : 0,
  };
}
