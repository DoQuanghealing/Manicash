/* ═══ Badge Definitions — 15 Behavior-Driven Badges ═══ */

export type BadgeCategory = 'earner' | 'discipline' | 'saver' | 'investor' | 'elite';

export type BadgeMetric =
  | 'income_tasks_completed'
  | 'mom_income_growth_streak'
  | 'distinct_income_categories'
  | 'tasks_per_week_max'
  | 'weekly_income_streak'
  | 'daily_streak'
  | 'on_time_tasks'
  | 'months_with_budget'
  | 'goals_completed'
  | 'resist_count'
  | 'consecutive_log_days'
  | 'savings_contributions'
  | 'months_with_investment'
  | 'completed_goals_amount'
  | 'meta_high_tier_badges';

export interface BadgeDefinition {
  id: string;                    // e.g. 'earner-01'
  category: BadgeCategory;
  name: string;                  // e.g. 'Chiến Thần Kiếm Tiền'
  fileName: string;              // e.g. '01-warrior-coins.jpg'
  description: string;           // GPT prompt mô tả nhân vật
  thresholds: [number, number, number, number, number]; // 5 levels
  metric: BadgeMetric;           // computed source
  unit: string;                  // 'task', 'tháng', 'tr', 'lần'
  fallbackIcon: string;          // Lucide icon name
}

export const BADGES: BadgeDefinition[] = [
  // ═══ NHÓM 1: Kiếm tiền ═══
  {
    id: 'earner-01',
    category: 'earner',
    name: 'Chiến Thần Kiếm Tiền',
    fileName: '01-warrior-coins.jpg',
    description: 'Chiến binh cầm tiền xu vàng phát sáng',
    thresholds: [5, 20, 50, 150, 365],
    metric: 'income_tasks_completed',
    unit: 'task',
    fallbackIcon: 'Swords',
  },
  {
    id: 'earner-02',
    category: 'earner',
    name: 'Đại Gia Mới Nổi',
    fileName: '02-rocket-money.jpg',
    description: 'Tên lửa bay lên cùng tiền',
    thresholds: [1, 2, 3, 6, 12],
    metric: 'mom_income_growth_streak',
    unit: 'tháng',
    fallbackIcon: 'Rocket',
  },
  {
    id: 'earner-03',
    category: 'earner',
    name: 'Nam Châm Hút Tiền',
    fileName: '03-magnet-money.jpg',
    description: 'Nam châm khổng lồ hút tiền vàng',
    thresholds: [2, 3, 4, 5, 6],
    metric: 'distinct_income_categories',
    unit: 'nguồn',
    fallbackIcon: 'Magnet',
  },
  {
    id: 'earner-04',
    category: 'earner',
    name: 'Cày Như Trâu',
    fileName: '04-buffalo-cart.jpg',
    description: 'Con trâu kéo xe chở đầy tiền',
    thresholds: [5, 10, 20, 30, 50],
    metric: 'tasks_per_week_max',
    unit: 'task/tuần',
    fallbackIcon: 'Tractor',
  },
  {
    id: 'earner-05',
    category: 'earner',
    name: 'Máy In Tiền',
    fileName: '05-money-printer.jpg',
    description: 'Máy in tiền đang hoạt động hết công suất',
    thresholds: [2, 4, 8, 16, 26],
    metric: 'weekly_income_streak',
    unit: 'tuần',
    fallbackIcon: 'Printer',
  },

  // ═══ NHÓM 2: Kỷ luật ═══
  {
    id: 'discipline-06',
    category: 'discipline',
    name: 'Kỷ Luật Sắt',
    fileName: '06-shield-calendar.jpg',
    description: 'Cái khiên bằng sắt có hình tờ lịch',
    thresholds: [3, 7, 14, 30, 90],
    metric: 'daily_streak',
    unit: 'ngày',
    fallbackIcon: 'ShieldCheck',
  },
  {
    id: 'discipline-07',
    category: 'discipline',
    name: 'Thợ Săn Deadline',
    fileName: '07-clock-target.jpg',
    description: 'Mũi tên bắn trúng đồng hồ đang kêu',
    thresholds: [5, 20, 50, 100, 200],
    metric: 'on_time_tasks',
    unit: 'task',
    fallbackIcon: 'Target',
  },
  {
    id: 'discipline-08',
    category: 'discipline',
    name: 'Não Tài Chính',
    fileName: '08-glowing-brain.jpg',
    description: 'Bộ não phát sáng với các ký hiệu tài chính',
    thresholds: [1, 3, 6, 12, 24],
    metric: 'months_with_budget',
    unit: 'tháng',
    fallbackIcon: 'Brain',
  },

  // ═══ NHÓM 3: Tiết kiệm ═══
  {
    id: 'saver-09',
    category: 'saver',
    name: 'Trùm Tiết Kiệm',
    fileName: '09-piggy-crown.jpg',
    description: 'Heo đất đội vương miện',
    thresholds: [1, 3, 5, 10, 20],
    metric: 'goals_completed',
    unit: 'mục tiêu',
    fallbackIcon: 'PiggyBank',
  },
  {
    id: 'saver-10',
    category: 'saver',
    name: 'Băng Giá Chi Tiêu',
    fileName: '10-frozen-wallet.jpg',
    description: 'Ví tiền bị đóng băng cứng',
    thresholds: [1, 5, 15, 50, 150],
    metric: 'resist_count',
    unit: 'lần',
    fallbackIcon: 'Snowflake',
  },
  {
    id: 'saver-11',
    category: 'saver',
    name: 'Bậc Thầy Cashflow',
    fileName: '11-cashflow-chart.jpg',
    description: 'Biểu đồ dòng tiền xanh rực rỡ',
    thresholds: [7, 21, 60, 120, 365],
    metric: 'consecutive_log_days',
    unit: 'ngày',
    fallbackIcon: 'BarChart3',
  },

  // ═══ NHÓM 4: Đầu tư ═══
  {
    id: 'investor-12',
    category: 'investor',
    name: 'Hạt Giống Tài Sản',
    fileName: '12-coin-sprout.jpg',
    description: 'Mầm cây mọc ra từ đồng tiền xu',
    thresholds: [1, 5, 20, 50, 100],
    metric: 'savings_contributions',
    unit: 'lần',
    fallbackIcon: 'Sprout',
  },
  {
    id: 'investor-13',
    category: 'investor',
    name: 'Nhà Đầu Tư Tỉnh Táo',
    fileName: '13-smart-investor.jpg',
    description: 'Người ngồi thiền trên đống vàng',
    thresholds: [1, 3, 6, 12, 24],
    metric: 'months_with_investment',
    unit: 'tháng',
    fallbackIcon: 'LineChart',
  },
  {
    id: 'investor-14',
    category: 'investor',
    name: 'Chạm Tay Hóa Vàng',
    fileName: '14-midas-touch.jpg',
    description: 'Bàn tay vàng chạm vào đồ vật biến thành vàng',
    thresholds: [5_000_000, 10_000_000, 30_000_000, 100_000_000, 500_000_000],
    metric: 'completed_goals_amount',
    unit: 'đ',
    fallbackIcon: 'HandMetal',
  },

  // ═══ NHÓM 5: Đẳng cấp ═══
  {
    id: 'elite-15',
    category: 'elite',
    name: 'Ông Trùm Tài Chính',
    fileName: '15-finance-king.jpg',
    description: 'Vị vua ngồi trên ngai vàng quyền lực',
    thresholds: [5, 10, 5, 10, 14],
    metric: 'meta_high_tier_badges',
    unit: 'huy hiệu',
    fallbackIcon: 'Crown',
  },
];
