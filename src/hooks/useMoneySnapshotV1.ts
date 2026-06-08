/* ═══ Phase 1 — Bridge hook: Zustand stores → MoneySnapshotV1 ═══
 * Pure mapping, no side effects. useMemo re-builds only when store data changes.
 * This is the SINGLE source of truth that feeds both the UI (safe-to-spend,
 * health score) and the Chat engine — ensuring the same numbers everywhere.
 */
'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import {
  getDateKey,
  getMonthKey,
  getISOWeekKey,
  getCurrentMonthKey,
} from '@/lib/moneyBrain/dateRange';
import { normalizeCategoryId } from '@/lib/moneyBrain/normalize';
import type { MoneySnapshotV1, MoneyTransactionSnapshot } from '@/lib/moneyBrain/types';

function resolveClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}

/**
 * Builds a MoneySnapshotV1 from all relevant Zustand stores.
 * Subscriptions are selective — each selector reads only what it needs.
 * The memo re-computes only when subscribed store slices change.
 */
export function useMoneySnapshotV1(): MoneySnapshotV1 {
  // ── Finance store ────────────────────────────────────────────────────────
  const transactions     = useFinanceStore((s) => s.transactions);
  const mainBalance      = useFinanceStore((s) => s.mainBalance);
  const emergencyBalance = useFinanceStore((s) => s.emergencyBalance);
  const billFundBalance  = useFinanceStore((s) => s.billFundBalance);
  const fixedBills       = useFinanceStore((s) => s.fixedBills);

  // ── Budget store ─────────────────────────────────────────────────────────
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const carryOver       = useBudgetStore((s) => s.carryOver);

  // ── Goals + Tasks ────────────────────────────────────────────────────────
  const goals = useGoalsStore((s) => s.goals);
  const tasks = useTaskStore((s) => s.tasks);

  return useMemo<MoneySnapshotV1>(() => {
    const timezone  = resolveClientTimezone();
    const clientNow = new Date().toISOString();
    const monthKey  = getCurrentMonthKey(clientNow, timezone);

    // ── Transactions: all history (engine filters by period) ─────────────
    const txns: MoneyTransactionSnapshot[] = transactions.map((t) => ({
      id:         t.id,
      type:       t.type,
      amount:     t.amount,
      categoryId: normalizeCategoryId(t.categoryId) ?? t.categoryId,
      wallet:     t.wallet,
      note:       t.note,
      date:       t.date,
      // Reuse pre-computed dateKey from the store; fallback to tz-aware recompute.
      dateKey:    t.dateKey || getDateKey(t.date, timezone),
      weekKey:    getISOWeekKey(t.date, timezone),
      monthKey:   getMonthKey(t.date, timezone),
      time:       t.time,
    }));

    return {
      version:  'money_snapshot_v1',
      clientNow,
      timezone,

      wallets: {
        main:      mainBalance,
        emergency: emergencyBalance,
        billFund:  billFundBalance,
      },

      transactions: txns,

      // Only current-month budgets (engine formula uses this_month budgets)
      budgets: categoryBudgets
        .filter((b) => b.month === monthKey)
        .map((b) => ({
          categoryId:   normalizeCategoryId(b.categoryId) ?? b.categoryId,
          monthlyLimit: b.monthlyLimit,
          monthKey:     b.month,
        })),

      bills: fixedBills.map((b) => ({
        id:     b.id,
        name:   b.name,
        amount: b.amount,
        dueDay: b.dueDay,
        isPaid: b.isPaid,
      })),

      goals: goals.map((g) => ({
        id:                        g.id,
        name:                      g.name,
        targetAmount:              g.targetAmount,
        currentAmount:             g.currentAmount,
        deadline:                  g.deadline,
        monthlyContributionTarget: g.monthlyContributionTarget,
      })),

      tasks: tasks.map((t) => ({
        id:             t.id,
        name:           t.name,
        expectedAmount: t.expectedAmount,
        actualAmount:   t.actualAmount,
        startDate:      t.startDate,
        endDate:        t.endDate,
        completedAt:    t.completedAt,
        deletedAt:      t.deletedAt,
        subTasks:       (t.subTasks ?? []).map((s) => ({
          id:          s.id,
          isCompleted: s.isCompleted,
        })),
      })),

      carryOver,
    };
  }, [
    transactions,
    mainBalance, emergencyBalance, billFundBalance, fixedBills,
    categoryBudgets, carryOver,
    goals,
    tasks,
  ]);
}
