/* ═══ Split Fund Presets — 3 scenarios for quick fund allocation ═══ */

export interface SplitPreset {
  id: string;
  icon: string;
  name: string;
  description: string;
  billPercent: number;
  savingsPercent: number;
  savingsBreakdown: {
    reserve: number;   // % of savings → Dự phòng
    goals: number;     // % of savings → Mục tiêu
    investment: number; // % of savings → Đầu tư
  };
  /** Accent color for card gradient/border */
  color: string;
}

export const SPLIT_PRESETS: SplitPreset[] = [
  {
    id: 'safe',
    icon: '🛡️',
    name: 'An toàn',
    description: 'Ưu tiên trả bill, giữ ổn định',
    billPercent: 60,
    savingsPercent: 40,
    savingsBreakdown: { reserve: 60, goals: 25, investment: 15 },
    color: '#10B981', // teal/green
  },
  {
    id: 'balanced',
    icon: '⚖️',
    name: 'Cân bằng',
    description: 'Phân bổ đều, phù hợp đa số',
    billPercent: 50,
    savingsPercent: 50,
    savingsBreakdown: { reserve: 40, goals: 40, investment: 20 },
    color: '#8B5CF6', // purple
  },
  {
    id: 'growth',
    icon: '🚀',
    name: 'Tăng trưởng',
    description: 'Ưu tiên đầu tư, mục tiêu dài hạn',
    billPercent: 40,
    savingsPercent: 60,
    savingsBreakdown: { reserve: 20, goals: 30, investment: 50 },
    color: '#F97316', // orange
  },
];

/** Default preset index (Cân bằng) */
export const DEFAULT_PRESET_INDEX = 1;
