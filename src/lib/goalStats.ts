/* ═══ Goal Stats Utilities — Streak + Memory bump + Urgency ═══
 *
 * Pure functions không phụ thuộc UI — dễ test.
 */

import type { Goal, GoalDeposit } from '@/types/budget';

/** Tính số tuần liên tiếp gần nhất có ít nhất 1 deposit. */
export function calcDepositStreakWeeks(deposits: GoalDeposit[]): number {
  if (!deposits || deposits.length === 0) return 0;

  // Set các tuần có deposit (YYYY-WW)
  const weekSet = new Set<string>();
  for (const dep of deposits) {
    weekSet.add(getWeekKey(new Date(dep.createdAt)));
  }

  // Đếm streak từ tuần hiện tại lùi về
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 520; i++) {
    // Lùi i tuần
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const key = getWeekKey(d);
    if (weekSet.has(key)) {
      streak++;
    } else if (i === 0) {
      // Cho phép tuần hiện tại trống nếu tuần trước có
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function getWeekKey(d: Date): string {
  // ISO week number
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Tìm deposit cùng ngày năm trước (±3 ngày). */
export function findAnniversaryDeposit(deposits: GoalDeposit[], now: Date = new Date()): GoalDeposit | null {
  if (!deposits || deposits.length === 0) return null;
  const targetMs = now.getTime() - 365 * 24 * 60 * 60 * 1000;
  const tolerance = 3 * 24 * 60 * 60 * 1000;
  let best: GoalDeposit | null = null;
  let bestDelta = Infinity;
  for (const dep of deposits) {
    const t = new Date(dep.createdAt).getTime();
    const delta = Math.abs(t - targetMs);
    if (delta <= tolerance && delta < bestDelta) {
      best = dep;
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Trạng thái urgency dựa trên deadline + progress.
 *   ok       — chưa lo
 *   warning  — < 6 tháng & progress < 70%
 *   critical — < 1 tháng & progress < 90%
 */
export type GoalUrgency = 'ok' | 'warning' | 'critical';

export function calcUrgency(goal: Goal): GoalUrgency {
  if (!goal.deadline) return 'ok';
  const deadlineMs = new Date(goal.deadline).getTime();
  const daysLeft = Math.floor((deadlineMs - Date.now()) / (24 * 60 * 60 * 1000));
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

  if (daysLeft <= 30 && progress < 90) return 'critical';
  if (daysLeft <= 180 && progress < 70) return 'warning';
  return 'ok';
}

/**
 * Check milestone vừa đạt — return 25 | 50 | 75 | 100 nếu vượt qua mốc
 * lần đầu (so với lastCelebratedMilestone), hoặc null nếu không có mốc mới.
 */
export function checkNewMilestone(
  goal: Goal,
): 25 | 50 | 75 | 100 | null {
  const progress = goal.targetAmount > 0
    ? (goal.currentAmount / goal.targetAmount) * 100
    : 0;
  const last = goal.lastCelebratedMilestone || 0;

  const milestones: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
  for (let i = milestones.length - 1; i >= 0; i--) {
    const m = milestones[i];
    if (progress >= m && last < m) return m;
  }
  return null;
}
