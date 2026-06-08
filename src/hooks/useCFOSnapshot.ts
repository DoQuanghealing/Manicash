/* ═══ useCFOSnapshot — Aggregate finance data for CFO analysis ═══
 * Gom data từ useFinanceStore + useBudgetStore + useSafeBalance → CFO payload.
 * Phase 1B: healthScore dùng getFinancialHealthScore (moneyBrain/healthScore),
 * không còn computeHealthScore từ cfoHealthScore.ts.
 *
 * Tính sẵn healthScore (client-side) để:
 *   - HealthScoreGauge render ngay không chờ API
 *   - Cache key của useCFOReport đổi khi data đổi
 *   - API route vẫn tính lại độc lập (guard against client tampering)
 */
'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useSafeBalance } from './useSafeBalance';
import { useMoneySnapshotV1 } from './useMoneySnapshotV1';
import {
  getFinancialHealthScore,
  type HealthScoreBreakdown,
} from '@/lib/moneyBrain/healthScore';
import { getSavingsRateForPeriod } from '@/lib/moneyBrain/financeMetrics';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';
import type {
  CFOPayload,
  WatchedCategoryDetail,
  FlaggedTransactionDetail,
} from '@/lib/groqClient';
import { daysAgo } from '@/lib/categoryStats';

/** Cap số watched-category gửi cho AI — giữ prompt nhẹ + cache key gọn. */
const MAX_WATCHED = 5;
/** Cap số flagged-transaction gửi cho AI — top by amount. */
const MAX_FLAGGED_TXNS = 5;

export interface CFOSnapshotBundle {
  /** Full MoneySnapshotV1 — phục vụ downstream hooks nếu cần. */
  snapshot: MoneySnapshotV1;
  payload: CFOPayload;
  /** Phase 1B: breakdown từ engine moneyBrain/healthScore (6 components). */
  breakdown: HealthScoreBreakdown;
  /** Stable key — đổi khi bất kỳ field business-relevant đổi. */
  cacheKey: string;
}

export function useCFOSnapshot(): CFOSnapshotBundle {
  // === Safe-to-spend derived values (wraps Finance + Budget, engine-backed) ===
  const { safeToSpend, monthlyIncome, totalSpent: monthlyExpense } = useSafeBalance();

  // === Direct finance store reads (for AI payload construction) ===
  const emergencyBalance       = useFinanceStore((s) => s.emergencyBalance);
  const fixedBills             = useFinanceStore((s) => s.fixedBills);
  const transactions           = useFinanceStore((s) => s.transactions);

  // === Budget store reads ===
  const categoryBudgets        = useBudgetStore((s) => s.categoryBudgets);
  const currentMonth           = useBudgetStore((s) => s.currentMonth);
  const flaggedCategories      = useBudgetStore((s) => s.flaggedCategories);
  const flaggedTransactionIds  = useBudgetStore((s) => s.flaggedTransactionIds);

  // === Category store reads (lookup name from categoryId) ===
  const categoryItems          = useCategoryStore((s) => s.expenseCategories);

  // === Phase 1B: MoneySnapshotV1 for engine-based health score ===
  const moneySnapshot = useMoneySnapshotV1();

  return useMemo<CFOSnapshotBundle>(() => {
    const now        = new Date();
    const dayOfMonth = now.getDate();
    const todayIso   = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // === Budget counts — chỉ trong tháng hiện tại ===
    const monthCats           = categoryBudgets.filter((b) => b.month === currentMonth);
    const categoriesTotal     = monthCats.length;
    const categoriesOverBudget = monthCats.filter((b) => b.spent > b.monthlyLimit).length;

    // === Spending per category từ transactions ===
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
    const spendingMap: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (new Date(t.date) < monthStart) continue;
      spendingMap[t.categoryId] = (spendingMap[t.categoryId] || 0) + t.amount;
    }

    // === Build watched-category details — union(flagged, over-budget) ===
    const candidateIds = new Set<string>(flaggedCategories);
    for (const b of monthCats) {
      if (b.spent > b.monthlyLimit) candidateIds.add(b.categoryId);
    }

    const watchedCategories: WatchedCategoryDetail[] = Array.from(candidateIds)
      .map((catId): WatchedCategoryDetail | null => {
        const cat    = categoryItems.find((c) => c.id === catId);
        if (!cat) return null;
        const budget = monthCats.find((b) => b.categoryId === catId);
        const limit  = budget?.monthlyLimit || 0;
        const spent  = spendingMap[catId] || budget?.spent || 0;
        const overBy = Math.max(0, spent - limit);
        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        return {
          name:          cat.name,
          spent,
          limit,
          overBy,
          percent:       Math.round(percent),
          isFlagged:     flaggedCategories.includes(catId),
          isOver:        limit > 0 && spent > limit,
          savingsAt20pct: Math.round(spent * 0.2),
        };
      })
      .filter((x): x is WatchedCategoryDetail => x !== null)
      .sort((a, b) => {
        if (a.isFlagged !== b.isFlagged) return a.isFlagged ? -1 : 1;
        if (a.isOver !== b.isOver) return a.isOver ? -1 : 1;
        return b.spent - a.spent;
      })
      .slice(0, MAX_WATCHED);

    // === Build top flagged transactions ===
    const flagSet = new Set(flaggedTransactionIds);
    const topFlaggedTransactions: FlaggedTransactionDetail[] = transactions
      .filter((t) => t.type === 'expense' && flagSet.has(t.id))
      .map((t): FlaggedTransactionDetail => {
        const cat = categoryItems.find((c) => c.id === t.categoryId);
        return {
          categoryName: cat?.name || 'Khác',
          note:         t.note || '',
          amount:       t.amount,
          daysAgo:      daysAgo(t.date, now),
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_FLAGGED_TXNS);

    // === Bill counts ===
    const dueBills        = fixedBills.filter((b) => b.dueDay <= dayOfMonth);
    const billsDueByNow   = dueBills.length;
    const billsPaidOfDue  = dueBills.filter((b) => b.isPaid).length;

    // === Transaction count — tháng hiện tại ===
    const transactionCount = transactions.filter((t) => {
      const d = new Date(t.date);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return m === currentMonth;
    }).length;

    // ─── Phase 1B: engine health score (replaces computeHealthScore) ────────
    const breakdown = getFinancialHealthScore(moneySnapshot);

    // savingsRate for AI payload — ratio (0-1), computed from engine
    const savingsRatePercent = getSavingsRateForPeriod(moneySnapshot, 'this_month');
    const savingsRate        = savingsRatePercent / 100;

    const payload: CFOPayload = {
      monthlyIncome,
      monthlyExpense,
      savingsRate,
      safeToSpend,
      emergencyBalance,
      categoriesTotal,
      categoriesOverBudget,
      billsDueByNow,
      billsPaidOfDue,
      transactionCount,
      watchedCategories,
      topFlaggedTransactions,
    };

    const watchedSig = watchedCategories
      .map((w) => `${w.name}:${w.spent}:${w.isFlagged ? 'F' : ''}${w.isOver ? 'O' : ''}`)
      .join('|');
    const txnSig = topFlaggedTransactions
      .map((t) => `${t.categoryName}:${t.amount}`)
      .join('|');
    const cacheKey =
      `${todayIso}_${monthlyIncome}_${monthlyExpense}_${transactionCount}` +
      `_${categoriesOverBudget}_${billsPaidOfDue}_${emergencyBalance}` +
      `_${watchedSig}_${txnSig}`;

    return { snapshot: moneySnapshot, payload, breakdown, cacheKey };
  }, [
    monthlyIncome,
    monthlyExpense,
    safeToSpend,
    emergencyBalance,
    fixedBills,
    categoryBudgets,
    currentMonth,
    flaggedCategories,
    flaggedTransactionIds,
    categoryItems,
    transactions,
    moneySnapshot,
  ]);
}
