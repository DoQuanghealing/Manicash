/* ═══ Onboarding Quests — 7 nhiệm vụ tân thủ ═══
 *
 * Mục tiêu: 1 quest mỗi ngày trong tuần đầu. Mỗi quest dạy 1 tính năng
 * thông qua TÌNH HUỐNG (không phải mệnh lệnh "bấm nút X").
 *
 * Gating: quest N chỉ mở sau khi quest N-1 hoàn thành VÀ đã 24h trôi qua
 * (hoặc user bấm "Tôi muốn làm tiếp ngay").
 *
 * Detection: mỗi quest có 1 metric đo được từ stores. Engine check khi
 * user mở overview / sau mỗi action.
 */

export type OnboardingMetric =
  | 'profile_completed'         // user.displayName + yearOfBirth có
  | 'expense_logged_count'      // số expense đã ghi từ khi quest start
  | 'income_logged_count'       // số income đã ghi
  | 'wishlist_count'            // số item trong wishlist
  | 'goal_created'              // có ít nhất 1 goal
  | 'earning_task_created'      // có ít nhất 1 earning task
  | 'app_open_days'             // số ngày unique đã mở app
  | 'overview_visit_count';     // số lần vào trang overview

import type { QuestAction } from '@/data/dailyQuestPool';

export interface OnboardingQuest {
  id: string;
  order: number;             // 1..7
  title: string;
  scenario: string;          // câu chuyện/tình huống, không mệnh lệnh
  hint: string;              // gợi ý cụ thể cách làm
  icon: string;
  metric: OnboardingMetric;
  target: number;            // ngưỡng đạt
  xpReward: number;
  rewardItemIds?: string[];  // reward catalog ids
  /** Deep-link action — dẫn user thẳng tới nơi cần làm. */
  action?: QuestAction;
}

export const ONBOARDING_QUESTS: OnboardingQuest[] = [
  {
    id: 'onb-1-profile',
    order: 1,
    title: 'Giới thiệu bản thân với app',
    scenario:
      'Trước khi nói chuyện tiền bạc, hãy để app biết bạn là ai. Tên gọi, năm sinh — chỉ cần thế để app cá nhân hóa theo bản mệnh.',
    hint: 'Vào Hồ Sơ → Sửa hồ sơ → Điền tên + năm sinh',
    icon: '👤',
    metric: 'profile_completed',
    target: 1,
    xpReward: 30,
    rewardItemIds: ['title-newbie'],
    action: {
      kind: 'navigate',
      target: '/profile',
      query: { edit: '1' },
      buttonLabel: 'Mở Sửa Hồ Sơ',
    },
  },
  {
    id: 'onb-2-expense',
    order: 2,
    title: 'Lần đầu ghi chi tiêu',
    scenario:
      'Hôm nay bạn đã tiêu gì? Một ly cà phê, một cuốc xe, một bữa ăn — bất cứ gì. Ghi lại để app bắt đầu hiểu thói quen của bạn.',
    hint: 'Bấm nút "+" giữa thanh dưới → chọn Chi tiêu',
    icon: '💸',
    metric: 'expense_logged_count',
    target: 1,
    xpReward: 25,
    action: {
      kind: 'navigate',
      target: '/input',
      query: { type: 'expense' },
      buttonLabel: 'Ghi chi tiêu ngay',
    },
  },
  {
    id: 'onb-3-income',
    order: 3,
    title: 'Ghi 1 khoản thu nhập',
    scenario:
      'Tiền chỉ "tăng" trong app khi bạn ghi vào. Có thể là lương, freelance, hoặc thậm chí 50k mẹ cho — đều ghi được.',
    hint: 'Bấm "+" → chọn Thu nhập → nhập số tiền',
    icon: '💰',
    metric: 'income_logged_count',
    target: 1,
    xpReward: 25,
    rewardItemIds: ['sound-coin'],
    action: {
      kind: 'navigate',
      target: '/input',
      query: { type: 'income' },
      buttonLabel: 'Ghi thu nhập ngay',
    },
  },
  {
    id: 'onb-4-wishlist',
    order: 4,
    title: 'Thêm 1 món muốn mua vào Wishlist',
    scenario:
      'Có thứ gì bạn muốn mua hơn 500k không? Bỏ vào Wishlist xem sau 7 ngày bạn còn muốn không. Đây là cách app giúp bạn tỉnh táo trước cám dỗ.',
    hint: 'Tab Mục Tiêu → Wishlist → Thêm món muốn mua',
    icon: '🛍️',
    metric: 'wishlist_count',
    target: 1,
    xpReward: 30,
    action: {
      kind: 'openWishlist',
      buttonLabel: 'Mở Wishlist',
    },
  },
  {
    id: 'onb-5-goal',
    order: 5,
    title: 'Đặt 1 mục tiêu lớn',
    scenario:
      'Người không có mục tiêu thì tiền bay đi hết. 1 mục tiêu — du lịch, mua xe, quỹ dự phòng — đủ làm bạn có lý do để giữ tiền.',
    hint: 'Tab Mục Tiêu → "Thêm mục tiêu mới"',
    icon: '🎯',
    metric: 'goal_created',
    target: 1,
    xpReward: 40,
    action: {
      kind: 'navigate',
      target: '/goals',
      buttonLabel: 'Mở Mục Tiêu',
    },
  },
  {
    id: 'onb-6-task',
    order: 6,
    title: 'Tạo 1 nhiệm vụ kiếm tiền',
    scenario:
      'Đây là tính năng đắt giá nhất app. Đặt 1 việc kiếm thêm (freelance, bán đồ cũ, dạy kèm) kèm deadline — app sẽ thưởng XP nếu bạn hoàn thành đúng/sớm hạn.',
    hint: 'Tab Tiền → Nhiệm vụ kiếm tiền → "+"',
    icon: '⚒️',
    metric: 'earning_task_created',
    target: 1,
    xpReward: 50,
    rewardItemIds: ['effect-sparkle'],
    action: {
      kind: 'openMoney',
      buttonLabel: 'Mở Tab Tiền',
    },
  },
  {
    id: 'onb-7-streak',
    order: 7,
    title: 'Điểm danh đủ 3 ngày để nhận quà',
    scenario:
      'Tài chính không phải sprint, là marathon. Mở app 3 ngày khác nhau để chứng minh bạn nghiêm túc — app sẽ tặng linh vật chạy trên header.',
    hint: 'Chỉ cần mở app mỗi ngày — streak tự tăng',
    icon: '🔥',
    metric: 'app_open_days',
    target: 3,
    xpReward: 80,
    rewardItemIds: ['zodiac-ty'], // unlock 1 zodiac mặc định cho ai chưa có mệnh chủ
    action: {
      kind: 'checkin',
      buttonLabel: 'Xem điểm danh',
    },
  },
];

export const ONBOARDING_QUEST_BY_ID = Object.fromEntries(
  ONBOARDING_QUESTS.map((q) => [q.id, q])
);

export const TOTAL_ONBOARDING_QUESTS = ONBOARDING_QUESTS.length;
