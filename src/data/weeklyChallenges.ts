/* ═══ Weekly Challenges — Thử thách 7 ngày ═══
 *
 * 4 chủ đề xoay vòng theo tuần:
 *   Tuần 0 → Tiết Kiệm
 *   Tuần 1 → Kiềm Chế
 *   Tuần 2 → Kiếm Thêm
 *   Tuần 3 → Tỉnh Táo Wishlist
 *
 * Reset thứ 2 hàng tuần. 1 challenge active tại 1 thời điểm.
 *
 * Threshold dynamic — % thu nhập tháng trước. User thu nhập cao thì
 * threshold cao, user mới thì threshold thấp. Có floor + cap để fair.
 */

export type WeeklyMetric =
  | 'saved_this_week'         // VND tiết kiệm tuần này (transfer kind=split → goals/reserve/investment)
  | 'resist_count_this_week'  // số lần resist tuần này
  | 'tasks_completed_this_week' // earning task hoàn thành tuần này
  | 'wishlist_rejected_this_week'; // wishlist items rejected tuần này

import type { QuestAction } from '@/data/dailyQuestPool';

export interface WeeklyChallengeTemplate {
  id: string;
  rotationIndex: 0 | 1 | 2 | 3;
  theme: 'saver' | 'discipline' | 'earner' | 'wishlist';
  title: string;
  description: string;
  icon: string;
  metric: WeeklyMetric;
  /**
   * Function tính target theo income tháng trước.
   * Trả về { target, displayHint } để UI hiển thị.
   */
  computeTarget: (lastMonthIncome: number) => { target: number; displayHint: string };
  xpReward: number;
  rewardItemIds?: string[];
  /** Deep-link action — dẫn user thẳng tới nơi cần làm. */
  action?: QuestAction;
}

export const WEEKLY_CHALLENGES: WeeklyChallengeTemplate[] = [
  {
    id: 'weekly-saver',
    rotationIndex: 0,
    theme: 'saver',
    title: 'Thử thách Tiết Kiệm 7 ngày',
    description:
      'Chuyển vào các quỹ (Dự phòng / Mục tiêu / Đầu tư) ít nhất ngưỡng tuần này. Mỗi đồng tích lũy là một bước tiến.',
    icon: '🛡️',
    metric: 'saved_this_week',
    computeTarget: (income) => {
      // 5% income tháng trước, floor 500k, cap 5M
      const raw = income * 0.05;
      const target = Math.max(500_000, Math.min(raw, 5_000_000));
      const rounded = Math.round(target / 100_000) * 100_000;
      return {
        target: rounded,
        displayHint: `${(rounded / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr (≈5% thu nhập tháng trước)`,
      };
    },
    xpReward: 300,
    rewardItemIds: ['effect-coinrain'],
    action: {
      kind: 'navigate',
      target: '/input',
      query: { type: 'income' },
      buttonLabel: 'Mở Ghi tiền',
    },
  },
  {
    id: 'weekly-discipline',
    rotationIndex: 1,
    theme: 'discipline',
    title: 'Thử thách Kiềm Chế 7 ngày',
    description:
      'Mỗi lần bạn bấm "Kiềm chế" thay vì "Mua" là một thắng lợi nhỏ. Đạt số lần thử thách tuần này.',
    icon: '🧊',
    metric: 'resist_count_this_week',
    computeTarget: (income) => {
      // Income cao → target cao hơn (giả định người chi tiêu nhiều)
      // <10M: 2 lần, 10-30M: 3 lần, >30M: 5 lần
      let target = 2;
      if (income >= 10_000_000) target = 3;
      if (income >= 30_000_000) target = 5;
      return {
        target,
        displayHint: `${target} lần kiềm chế trong tuần`,
      };
    },
    xpReward: 350,
    rewardItemIds: ['title-saver'],
    action: {
      kind: 'openWishlist',
      buttonLabel: 'Mở Wishlist',
    },
  },
  {
    id: 'weekly-earner',
    rotationIndex: 2,
    theme: 'earner',
    title: 'Thử thách Kiếm Thêm 7 ngày',
    description:
      'Hoàn thành ít nhất 1 nhiệm vụ kiếm tiền tuần này. Side hustle, freelance, bán đồ — đều tính.',
    icon: '⚒️',
    metric: 'tasks_completed_this_week',
    computeTarget: () => ({
      target: 1,
      displayHint: '1 nhiệm vụ kiếm tiền hoàn thành',
    }),
    xpReward: 400,
    rewardItemIds: ['elearning-vitien'],
    action: {
      kind: 'openMoney',
      buttonLabel: 'Mở Tab Tiền',
    },
  },
  {
    id: 'weekly-wishlist',
    rotationIndex: 3,
    theme: 'wishlist',
    title: 'Thử thách Tỉnh Táo 7 ngày',
    description:
      'Sau cooling period 24-168h, nếu bạn từ chối ít nhất 1 item wishlist → thắng. Bạn không cần thứ đó, thật đấy.',
    icon: '🛍️',
    metric: 'wishlist_rejected_this_week',
    computeTarget: () => ({
      target: 1,
      displayHint: 'Từ chối 1 item wishlist sau cooling',
    }),
    xpReward: 300,
    rewardItemIds: ['elearning-thieuduc'],
    action: {
      kind: 'openWishlist',
      buttonLabel: 'Mở Wishlist',
    },
  },
];

export const WEEKLY_CHALLENGE_BY_ID = Object.fromEntries(
  WEEKLY_CHALLENGES.map((c) => [c.id, c])
);

/**
 * Lấy challenge cho tuần hiện tại theo rotation.
 * Tuần được tính từ thứ 2 đầu năm (week of year số 0).
 */
export function getWeekIndex(date: Date = new Date()): number {
  const start = new Date(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(dayOfYear / 7);
}

export function pickWeeklyChallenge(date: Date = new Date()): WeeklyChallengeTemplate {
  const weekIdx = getWeekIndex(date);
  const rotation = (weekIdx % WEEKLY_CHALLENGES.length) as 0 | 1 | 2 | 3;
  return WEEKLY_CHALLENGES[rotation];
}

/** ID key duy nhất cho 1 tuần — YYYY-WW. */
export function getWeekKey(date: Date = new Date()): string {
  const wk = getWeekIndex(date);
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
