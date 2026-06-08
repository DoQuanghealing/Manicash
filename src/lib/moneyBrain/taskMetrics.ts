/* ═══ Money Brain — Task Metrics (Phase 1) ═══
 * PURE functions. Dùng clientNow/timezone để xác định overdue.
 * Không dùng Date.now() / new Date() cho logic ngày tháng.
 */

import type { MoneySnapshotV1, MoneyTaskSnapshot } from './types';
import type { MoneyPeriod } from './dateRange';
import {
  getTodayKey,
  isTransactionInPeriod,
  getDateKey,
  getMonthKey,
  getISOWeekKey,
} from './dateRange';

export type MoneyTaskStatus = 'active' | 'overdue' | 'completed' | 'deleted';

// ─── Per-task status ──────────────────────────────────────────────────────────

export function getTaskStatus(
  task: MoneyTaskSnapshot,
  snapshot: MoneySnapshotV1,
): MoneyTaskStatus {
  if (task.completedAt) return 'completed';
  if (task.deletedAt) return 'deleted';
  const todayKey = getTodayKey(snapshot.clientNow, snapshot.timezone);
  const endKey = task.endDate ? task.endDate.slice(0, 10) : '';
  if (endKey && endKey < todayKey) return 'overdue';
  return 'active';
}

// ─── Filtered lists ───────────────────────────────────────────────────────────

export function getActiveTasks(snapshot: MoneySnapshotV1): MoneyTaskSnapshot[] {
  return snapshot.tasks.filter((t) => getTaskStatus(t, snapshot) === 'active');
}

export function getOverdueTasks(snapshot: MoneySnapshotV1): MoneyTaskSnapshot[] {
  return snapshot.tasks.filter((t) => getTaskStatus(t, snapshot) === 'overdue');
}

export function getCompletedTasks(snapshot: MoneySnapshotV1): MoneyTaskSnapshot[] {
  return snapshot.tasks.filter((t) => getTaskStatus(t, snapshot) === 'completed');
}

// ─── Income pipeline ──────────────────────────────────────────────────────────

/** Tổng thu nhập kỳ vọng từ tasks đang active hoặc overdue. */
export function getExpectedIncomePipeline(snapshot: MoneySnapshotV1): number {
  return [...getActiveTasks(snapshot), ...getOverdueTasks(snapshot)].reduce(
    (sum, t) => sum + t.expectedAmount,
    0,
  );
}

/** Tổng thu nhập thực tế từ tasks đã hoàn thành trong period (dựa vào completedAt). */
export function getActualTaskIncomeForPeriod(
  snapshot: MoneySnapshotV1,
  period: MoneyPeriod,
): number {
  const ctx = { clientNow: snapshot.clientNow, timezone: snapshot.timezone };
  const tz = snapshot.timezone;
  return snapshot.tasks
    .filter((t) => t.completedAt && (t.actualAmount ?? 0) > 0)
    .filter((t) => {
      // Dùng completedAt như date của 1 "transaction" để lọc theo period
      const completedTx = {
        date: t.completedAt!,
        dateKey: getDateKey(t.completedAt!, tz),
        monthKey: getMonthKey(t.completedAt!, tz),
        weekKey: getISOWeekKey(t.completedAt!, tz),
      };
      return isTransactionInPeriod(completedTx, period, ctx);
    })
    .reduce((sum, t) => sum + (t.actualAmount ?? 0), 0);
}

// ─── Sub-task progress ────────────────────────────────────────────────────────

export function getTaskCompletionProgress(task: MoneyTaskSnapshot): {
  done: number;
  total: number;
  progress: number; // 0..100
} {
  const total = task.subTasks?.length ?? 0;
  const done = task.subTasks?.filter((s) => s.isCompleted).length ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, progress };
}

// ─── Priority ordering ────────────────────────────────────────────────────────

/**
 * Top priority tasks để bắt đầu ngay:
 *  1. overdue first
 *  2. nearer endDate
 *  3. higher expectedAmount
 */
export function getHighestPriorityIncomeTasks(
  snapshot: MoneySnapshotV1,
  limit = 5,
): MoneyTaskSnapshot[] {
  const active = getActiveTasks(snapshot);
  const overdue = getOverdueTasks(snapshot);
  const pool = [...overdue, ...active];

  return pool
    .sort((a, b) => {
      const aOverdue = getTaskStatus(a, snapshot) === 'overdue';
      const bOverdue = getTaskStatus(b, snapshot) === 'overdue';
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      // Nearer endDate first
      const aEnd = a.endDate || '9999-12-31';
      const bEnd = b.endDate || '9999-12-31';
      if (aEnd !== bEnd) return aEnd < bEnd ? -1 : 1;
      // Higher expectedAmount first
      return b.expectedAmount - a.expectedAmount;
    })
    .slice(0, limit);
}
