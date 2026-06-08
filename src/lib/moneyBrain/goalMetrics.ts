/* ═══ Money Brain — Goal Metrics (Phase 1) ═══
 * PURE functions. Không dùng currentAmount làm khoản tiết kiệm/tháng.
 * monthlyContributionTarget là con số đúng cho safe-to-spend.
 */

import type { MoneySnapshotV1 } from './types';
import { getCurrentMonthKey } from './dateRange';

export interface GoalProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  gap: number;
  progress: number;           // 0..100
  deadline?: string;
  monthlyContributionTarget: number;
  requiredMonthlyContribution?: number;
  isAtRisk?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Số tháng từ clientNow đến deadline.
 * Trả 0 nếu deadline đã qua hoặc là tháng hiện tại.
 */
function getMonthsRemaining(
  clientNow: string,
  timezone: string,
  deadline: string,
): number {
  const currentMK = getCurrentMonthKey(clientNow, timezone);
  const [cy, cm] = currentMK.split('-').map(Number);
  const deadlineMK = deadline.slice(0, 7); // YYYY-MM
  const [dy, dm] = deadlineMK.split('-').map(Number);
  return Math.max(0, (dy - cy) * 12 + (dm - cm));
}

// ─── Aggregates ───────────────────────────────────────────────────────────────

/** Tổng currentAmount của tất cả goals. */
export function getTotalGoalSaved(snapshot: MoneySnapshotV1): number {
  return snapshot.goals.reduce((sum, g) => sum + g.currentAmount, 0);
}

/**
 * Tổng khoản tiết kiệm đều mỗi tháng cho goals.
 * Dùng monthlyContributionTarget — KHÔNG dùng currentAmount.
 */
export function getPlannedMonthlyGoalContributions(snapshot: MoneySnapshotV1): number {
  return snapshot.goals.reduce((sum, g) => sum + (g.monthlyContributionTarget ?? 0), 0);
}

// ─── Per-goal progress ────────────────────────────────────────────────────────

export function getGoalProgressList(snapshot: MoneySnapshotV1): GoalProgress[] {
  return snapshot.goals.map((g) => {
    const gap = Math.max(0, g.targetAmount - g.currentAmount);
    const progress =
      g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    const monthlyContributionTarget = g.monthlyContributionTarget ?? 0;

    let requiredMonthlyContribution: number | undefined;
    let isAtRisk: boolean | undefined;

    if (g.deadline) {
      const monthsLeft = getMonthsRemaining(snapshot.clientNow, snapshot.timezone, g.deadline);
      if (monthsLeft <= 0) {
        // Deadline đã qua hoặc ngay tháng này
        requiredMonthlyContribution = gap > 0 ? gap : 0;
      } else {
        requiredMonthlyContribution = gap / monthsLeft;
      }
      // isAtRisk: cần tiết kiệm nhiều hơn mục tiêu đặt ra
      isAtRisk = gap > 0 && requiredMonthlyContribution > monthlyContributionTarget;
    }

    return {
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      gap,
      progress,
      deadline: g.deadline,
      monthlyContributionTarget,
      requiredMonthlyContribution,
      isAtRisk,
    };
  });
}

export function getGoalProgressById(
  snapshot: MoneySnapshotV1,
  goalId: string,
): GoalProgress | null {
  return getGoalProgressList(snapshot).find((g) => g.id === goalId) ?? null;
}

export function getGoalGap(snapshot: MoneySnapshotV1, goalId: string): number | null {
  const g = snapshot.goals.find((g) => g.id === goalId);
  if (!g) return null;
  return Math.max(0, g.targetAmount - g.currentAmount);
}

export function getAtRiskGoals(snapshot: MoneySnapshotV1): GoalProgress[] {
  return getGoalProgressList(snapshot).filter((g) => g.isAtRisk === true);
}
