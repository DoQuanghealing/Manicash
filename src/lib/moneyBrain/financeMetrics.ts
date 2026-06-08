/* ═══ Money Brain — Finance Metrics (Phase 1) ═══
 * PURE functions. Không import React / Zustand / API / Date.now() cho logic period.
 * Dùng snapshot.clientNow + snapshot.timezone cho mọi tính toán thời gian.
 */

import type { MoneySnapshotV1, MoneyTransactionSnapshot } from './types';
import { isTransactionInPeriod, type MoneyPeriod } from './dateRange';
import { normalizeCategoryId } from './normalize';

// ─── Transactions for period ─────────────────────────────────────────────────

export function getTransactionsForPeriod(
  snapshot: MoneySnapshotV1,
  period: MoneyPeriod,
): MoneyTransactionSnapshot[] {
  const ctx = { clientNow: snapshot.clientNow, timezone: snapshot.timezone };
  return snapshot.transactions.filter((t) => isTransactionInPeriod(t, period, ctx));
}

// ─── Aggregated totals ────────────────────────────────────────────────────────

export function getIncomeForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  return getTransactionsForPeriod(snapshot, period)
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getExpenseForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  return getTransactionsForPeriod(snapshot, period)
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getTransferForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  return getTransactionsForPeriod(snapshot, period)
    .filter((t) => t.type === 'transfer')
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getNetCashflowForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  return getIncomeForPeriod(snapshot, period) - getExpenseForPeriod(snapshot, period);
}

/**
 * savingsRate = (income - expense) / income * 100
 * Special cases:
 *   income <= 0, expense > 0  → -100
 *   income = 0, expense = 0   → 0
 */
export function getSavingsRateForPeriod(snapshot: MoneySnapshotV1, period: MoneyPeriod): number {
  const income = getIncomeForPeriod(snapshot, period);
  const expense = getExpenseForPeriod(snapshot, period);
  if (income <= 0) return expense > 0 ? -100 : 0;
  return ((income - expense) / income) * 100;
}

// ─── Category breakdown ───────────────────────────────────────────────────────

export interface TopExpenseCategory {
  categoryId: string;
  categoryName?: string;
  amount: number;
  count: number;
  percentageOfExpense: number;
}

export function getTopExpenseCategoriesForPeriod(
  snapshot: MoneySnapshotV1,
  period: MoneyPeriod,
  limit = 5,
): TopExpenseCategory[] {
  const txns = getTransactionsForPeriod(snapshot, period).filter((t) => t.type === 'expense');
  const totalExpense = txns.reduce((s, t) => s + t.amount, 0);

  const map = new Map<string, { name?: string; amount: number; count: number }>();
  for (const t of txns) {
    const catId = normalizeCategoryId(t.categoryId) ?? 'other';
    const entry = map.get(catId) ?? { amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    if (!entry.name && t.categoryName) entry.name = t.categoryName;
    map.set(catId, entry);
  }

  return [...map.entries()]
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      amount: data.amount,
      count: data.count,
      percentageOfExpense: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function getLargestExpenseTransactionsForPeriod(
  snapshot: MoneySnapshotV1,
  period: MoneyPeriod,
  limit = 5,
): MoneyTransactionSnapshot[] {
  return getTransactionsForPeriod(snapshot, period)
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
