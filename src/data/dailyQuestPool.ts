/* ═══ Daily Quest Pool — Pool nhiệm vụ hàng ngày ═══
 *
 * Mỗi ngày engine random pick 3 quest từ pool (cùng quy luật cho cùng date
 * → cùng kết quả: hash date làm seed). Reset 0h Việt Nam.
 *
 * Mỗi quest đo được từ stores hiện có, không cần infrastructure mới.
 */

export type DailyMetric =
  | 'expense_today'           // số expense ghi hôm nay
  | 'income_today'            // số income ghi hôm nay
  | 'transactions_today'      // tổng giao dịch (expense + income) hôm nay
  | 'resist_today'            // số lần resist hôm nay (resistCount delta)
  | 'subtask_today'           // số sub-task hoàn thành hôm nay
  | 'streak_advanced'         // streak đã tăng hôm nay
  | 'overview_opened'         // đã mở overview hôm nay
  | 'budget_viewed'           // đã xem ngân sách hôm nay
  | 'wishlist_viewed';        // đã mở wishlist hôm nay

export interface DailyQuestTemplate {
  id: string;
  title: string;
  hint: string;
  icon: string;
  metric: DailyMetric;
  target: number;
  xpReward: number;
  /** Trọng số để pick — quest cao hơn = hay xuất hiện hơn. Default 1. */
  weight?: number;
}

/** Pool nguồn — ~10 quest để xoay vòng. */
export const DAILY_QUEST_POOL: DailyQuestTemplate[] = [
  {
    id: 'daily-expense-2',
    title: 'Ghi 2 chi tiêu hôm nay',
    hint: 'Nhập "+" để ghi mọi khoản tiêu trong ngày',
    icon: '💸',
    metric: 'expense_today',
    target: 2,
    xpReward: 30,
    weight: 3,
  },
  {
    id: 'daily-income-1',
    title: 'Ghi 1 khoản thu nhập',
    hint: 'Có nhận tiền hôm nay? Ghi vào nhé',
    icon: '💰',
    metric: 'income_today',
    target: 1,
    xpReward: 25,
    weight: 2,
  },
  {
    id: 'daily-checkin',
    title: 'Điểm danh hôm nay',
    hint: 'Streak tự tăng khi bạn ghi giao dịch đầu tiên',
    icon: '🔥',
    metric: 'streak_advanced',
    target: 1,
    xpReward: 15,
    weight: 3,
  },
  {
    id: 'daily-overview',
    title: 'Mở dashboard kiểm tra số dư',
    hint: 'Bạn đang xem đấy — đã coi như đạt 😄',
    icon: '📊',
    metric: 'overview_opened',
    target: 1,
    xpReward: 10,
    weight: 1,
  },
  {
    id: 'daily-resist-1',
    title: 'Kiềm chế 1 lần chi tiêu',
    hint: 'Khi sắp tiêu, bấm "Kiềm chế" thay vì "Ghi chi"',
    icon: '🛡️',
    metric: 'resist_today',
    target: 1,
    xpReward: 50,
    weight: 2,
  },
  {
    id: 'daily-subtask',
    title: 'Hoàn thành 1 sub-task',
    hint: 'Có nhiệm vụ kiếm tiền? Tick xong 1 việc nhỏ',
    icon: '✅',
    metric: 'subtask_today',
    target: 1,
    xpReward: 35,
    weight: 2,
  },
  {
    id: 'daily-transactions-3',
    title: 'Ghi 3 giao dịch trong ngày',
    hint: 'Thu nhập hay chi tiêu đều tính',
    icon: '📝',
    metric: 'transactions_today',
    target: 3,
    xpReward: 40,
    weight: 1,
  },
  {
    id: 'daily-wishlist',
    title: 'Xem lại Wishlist',
    hint: 'Mở Wishlist để tỉnh táo trước cám dỗ',
    icon: '🛍️',
    metric: 'wishlist_viewed',
    target: 1,
    xpReward: 20,
    weight: 1,
  },
  {
    id: 'daily-budget',
    title: 'Kiểm tra ngân sách tháng',
    hint: 'Tab Sổ Cái → xem các danh mục còn bao nhiêu',
    icon: '📋',
    metric: 'budget_viewed',
    target: 1,
    xpReward: 20,
    weight: 1,
  },
];

export const DAILY_QUEST_BY_ID = Object.fromEntries(
  DAILY_QUEST_POOL.map((q) => [q.id, q])
);

/**
 * Pick 3 quest cho ngày theo dateKey (YYYY-MM-DD). Cùng date → cùng kết quả.
 * Đảm bảo có ít nhất 1 quest "checkin" để user luôn có 1 mục tiêu dễ đạt.
 */
export function pickDailyQuests(dateKey: string): DailyQuestTemplate[] {
  // Deterministic seed từ dateKey
  let seed = 0;
  for (const ch of dateKey) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;

  // Build weighted pool
  const weighted: DailyQuestTemplate[] = [];
  for (const q of DAILY_QUEST_POOL) {
    const w = q.weight ?? 1;
    for (let i = 0; i < w; i++) weighted.push(q);
  }

  const picked: DailyQuestTemplate[] = [];
  const usedIds = new Set<string>();

  // Bảo đảm checkin (id daily-checkin) luôn có
  const checkin = DAILY_QUEST_POOL.find((q) => q.id === 'daily-checkin');
  if (checkin) {
    picked.push(checkin);
    usedIds.add(checkin.id);
  }

  // Pick thêm 2 quest unique
  let attempts = 0;
  while (picked.length < 3 && attempts < 100) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const idx = seed % weighted.length;
    const q = weighted[idx];
    if (!usedIds.has(q.id)) {
      picked.push(q);
      usedIds.add(q.id);
    }
    attempts++;
  }

  return picked;
}
