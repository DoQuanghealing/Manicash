/* ═══ Task Eval — Điểm khả năng hoàn thành (deterministic · 0đ · realtime) ═══
 * PURE. "Chuẩn nhà": mọi CON SỐ do engine tính (tiến độ, pace, tỷ lệ lịch sử) — AI
 * (taskEvalService) CHỈ diễn giải + gợi ý nhiệm vụ phụ/rủi ro, KHÔNG bịa điểm.
 *
 * Score = trọng số:  tiến độ subtask (45%) · pace vs deadline (30%) · tỷ lệ hoàn
 * thành lịch sử (25%);  quá hạn chưa xong → phạt ×0.5.
 */

import type { MoneyTaskSnapshot } from '@/lib/moneyBrain/types';

export interface TaskFeasibilitySignals {
  /** % subtask đã xong (0–100). Không có subtask → 0, dùng neutralProgress. */
  subtaskProgress: number;
  /** Số ngày còn lại tới deadline (âm = đã quá hạn). */
  daysLeft: number;
  /** Tổng số ngày của nhiệm vụ (start→end), tối thiểu 1. */
  totalDays: number;
  /** Đang đúng/nhanh hơn tiến độ kỳ vọng theo thời gian? */
  onPace: boolean;
  /** Tỷ lệ hoàn thành lịch sử của user (0–100). */
  historicalRate: number;
  /** Nhiệm vụ đã quá hạn mà chưa hoàn thành. */
  overdue: boolean;
  subtaskDone: number;
  subtaskTotal: number;
}

export interface TaskFeasibilityResult {
  /** 0–100. */
  score: number;
  signals: TaskFeasibilitySignals;
}

const NEUTRAL_PROGRESS = 0.35; // chưa có subtask → coi như mới khởi động nhẹ
const DEFAULT_HISTORICAL_RATE = 60; // user mới (chưa có lịch sử) — trung tính lạc quan

function toDayNumber(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : NaN;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Tỷ lệ hoàn thành lịch sử: trong các nhiệm vụ ĐÃ CÓ KẾT CỤC
 * (hoàn thành / bỏ / quá hạn qua rồi), bao nhiêu % hoàn thành.
 * Loại trừ chính task đang xét. Không đủ lịch sử → DEFAULT_HISTORICAL_RATE.
 */
export function computeHistoricalCompletionRate(
  allTasks: MoneyTaskSnapshot[],
  clientNow: string,
  excludeId?: string,
): number {
  const nowDay = toDayNumber(clientNow);
  let completed = 0;
  let outcomes = 0;
  for (const t of allTasks) {
    if (t.id === excludeId) continue;
    const done = !!t.completedAt;
    const abandoned = !!t.deletedAt;
    const endDay = toDayNumber(t.endDate);
    const pastDue = Number.isFinite(endDay) && Number.isFinite(nowDay) && endDay < nowDay;
    // Chỉ tính các task đã "chốt sổ": xong, bỏ, hoặc quá hạn (không còn active).
    if (done || abandoned || (pastDue && !done)) {
      outcomes += 1;
      if (done) completed += 1;
    }
  }
  if (outcomes === 0) return DEFAULT_HISTORICAL_RATE;
  return Math.round((completed / outcomes) * 100);
}

export function computeTaskFeasibility(
  task: MoneyTaskSnapshot,
  allTasks: MoneyTaskSnapshot[],
  clientNow: string,
): TaskFeasibilityResult {
  const subs = task.subTasks ?? [];
  const subtaskTotal = subs.length;
  const subtaskDone = subs.filter((s) => s.isCompleted).length;
  const actualProgress = subtaskTotal > 0 ? subtaskDone / subtaskTotal : NEUTRAL_PROGRESS;

  const nowDay = toDayNumber(clientNow);
  const startDay = toDayNumber(task.startDate);
  const endDay = toDayNumber(task.endDate);
  const totalDays = Math.max(1, Number.isFinite(endDay) && Number.isFinite(startDay) ? endDay - startDay : 1);
  const daysLeft = Number.isFinite(endDay) && Number.isFinite(nowDay) ? endDay - nowDay : totalDays;
  const elapsed = clamp(
    Number.isFinite(nowDay) && Number.isFinite(startDay) ? nowDay - startDay : 0,
    0,
    totalDays,
  );
  const expectedProgress = elapsed / totalDays; // 0..1
  const paceRatio = actualProgress / Math.max(expectedProgress, 0.01);
  const onPace = actualProgress + 1e-9 >= expectedProgress;

  const completed = !!task.completedAt;
  const overdue = !completed && daysLeft < 0;

  const historicalRate = computeHistoricalCompletionRate(allTasks, clientNow, task.id);

  // Trọng số.
  let score =
    45 * clamp(actualProgress, 0, 1) +
    30 * clamp(paceRatio, 0, 1) +
    25 * clamp(historicalRate / 100, 0, 1);

  if (completed) score = 100;
  else if (overdue) score *= 0.5; // quá hạn chưa xong → kéo mạnh

  return {
    score: Math.round(clamp(score, 0, 100)),
    signals: {
      subtaskProgress: Math.round(actualProgress * 100),
      daysLeft,
      totalDays,
      onPace,
      historicalRate,
      overdue,
      subtaskDone,
      subtaskTotal,
    },
  };
}
