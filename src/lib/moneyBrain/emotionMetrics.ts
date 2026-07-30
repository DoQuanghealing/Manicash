/* ═══ Money Brain — Emotion Spending Metrics ═══
 * PURE functions. Cảm xúc là tự khai (emotionTag trên transaction), không suy diễn.
 * Không phán xét: self_reward/preference/excited KHÔNG tính vào nhóm "impulsive".
 */

import type { MoneySnapshotV1, MoneyEmotionTag } from './types';
import { getCurrentMonthKey } from './dateRange';
import { getGoalProgressList } from './goalMetrics';

/** Nhóm cảm xúc gắn với chi tiêu để xả stress/tiêu cực — nhóm được CFO cảnh báo.
 * self_reward/preference/excited là chi tiêu vui, không đáng lo, chỉ hiển thị breakdown. */
export const IMPULSIVE_EMOTION_TAGS: readonly MoneyEmotionTag[] = ['stress', 'sad', 'anger', 'jealousy'];

export interface EmotionSpendingBreakdown {
  monthKey: string;
  /** Tổng chi tháng này (kể cả chưa gắn tag). */
  totalExpense: number;
  /** Tổng chi ĐÃ gắn tag cảm xúc. */
  taggedTotal: number;
  /** Chi theo từng tag — chỉ chứa tag có phát sinh. */
  byTag: Partial<Record<MoneyEmotionTag, number>>;
  /** Tổng chi thuộc nhóm impulsive (stress/sad/anger/jealousy). */
  impulsiveTotal: number;
  /** impulsiveTotal / totalExpense — 0 nếu totalExpense = 0. */
  impulsiveRatioOfExpense: number;
}

export function getEmotionSpendingBreakdown(snapshot: MoneySnapshotV1): EmotionSpendingBreakdown {
  const monthKey = getCurrentMonthKey(snapshot.clientNow, snapshot.timezone);
  const byTag: Partial<Record<MoneyEmotionTag, number>> = {};
  let totalExpense = 0;
  let taggedTotal = 0;

  for (const t of snapshot.transactions) {
    if (t.type !== 'expense' || t.monthKey !== monthKey) continue;
    totalExpense += t.amount;
    if (t.emotionTag) {
      byTag[t.emotionTag] = (byTag[t.emotionTag] ?? 0) + t.amount;
      taggedTotal += t.amount;
    }
  }

  const impulsiveTotal = IMPULSIVE_EMOTION_TAGS.reduce((sum, tag) => sum + (byTag[tag] ?? 0), 0);

  return {
    monthKey,
    totalExpense,
    taggedTotal,
    byTag,
    impulsiveTotal,
    impulsiveRatioOfExpense: totalExpense > 0 ? impulsiveTotal / totalExpense : 0,
  };
}

export interface GoalEmotionDelay {
  id: string;
  name: string;
  /** Số tháng để hoàn thành mục tiêu ở tốc độ tiết kiệm ĐÃ ĐẶT (monthlyContributionTarget). */
  baselineMonths: number;
  /** Số tháng nếu duy trì mức chi impulsive tháng này — null nếu impulsive ăn hết phần tiết kiệm (mục tiêu đứng im). */
  projectedMonths: number | null;
  /** % chậm đi so với baseline — null khi projectedMonths null (không tính được %, chỉ báo "đứng im"). */
  delayPercent: number | null;
}

/**
 * Phân bổ impulsiveTotal theo tỷ trọng monthlyContributionTarget của từng mục tiêu,
 * rồi so tốc độ hoàn thành gốc vs tốc độ nếu duy trì mức chi impulsive này.
 * Trả [] nếu không có mục tiêu nào đang có kế hoạch tiết kiệm (không có gì để cảnh báo).
 */
export function getGoalDelayFromEmotionSpending(
  snapshot: MoneySnapshotV1,
  impulsiveTotal: number,
): GoalEmotionDelay[] {
  if (impulsiveTotal <= 0) return [];

  const goals = getGoalProgressList(snapshot).filter(
    (g) => g.gap > 0 && g.monthlyContributionTarget > 0,
  );
  const totalPlanned = goals.reduce((sum, g) => sum + g.monthlyContributionTarget, 0);
  if (totalPlanned <= 0) return [];

  return goals.map((g) => {
    const share = g.monthlyContributionTarget / totalPlanned;
    const hit = impulsiveTotal * share;
    const baselineMonths = g.gap / g.monthlyContributionTarget;
    const reducedMonthly = g.monthlyContributionTarget - hit;
    const projectedMonths = reducedMonthly > 0 ? g.gap / reducedMonthly : null;
    const delayPercent =
      projectedMonths !== null
        ? Math.round(((projectedMonths - baselineMonths) / baselineMonths) * 100)
        : null;

    return { id: g.id, name: g.name, baselineMonths, projectedMonths, delayPercent };
  });
}
