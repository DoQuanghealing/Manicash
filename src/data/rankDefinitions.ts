/* ═══ Rank Definitions — 7 Ranks ═══ */
import type { RankDefinition } from '@/types/gamification';
import type { UserRank } from '@/types/user';

export const RANKS: RankDefinition[] = [
  {
    id: 'iron',
    name: 'Sắt',
    icon: '🗡️',
    xpRequired: 0,
    gradientFrom: '#71717A',
    gradientTo: '#A1A1AA',
    encouragement: 'Hành trình ngàn dặm bắt đầu từ bước chân đầu tiên!',
    perkDescription: 'Tất cả tính năng cơ bản',
    unlockedCourse: null,
  },
  {
    id: 'bronze',
    name: 'Đồng',
    icon: '🥉',
    xpRequired: 500,
    gradientFrom: '#B45309',
    gradientTo: '#D97706',
    encouragement: 'Bạn đang khởi đầu tuyệt vời!',
    perkDescription: 'Mở khóa "Quản lý chi tiêu 101"',
    unlockedCourse: 'spending-101',
  },
  {
    id: 'silver',
    name: 'Bạc',
    icon: '🥈',
    xpRequired: 2000,
    gradientFrom: '#6B7280',
    gradientTo: '#D1D5DB',
    encouragement: 'Tư duy tiền bạc đang hình thành!',
    perkDescription: 'Mở khóa "Tư duy tiết kiệm"',
    unlockedCourse: 'savings-mindset',
  },
  {
    id: 'gold',
    name: 'Vàng',
    icon: '🥇',
    xpRequired: 5000,
    gradientFrom: '#B45309',
    gradientTo: '#FCD34D',
    encouragement: 'Bạn là chiến binh tài chính!',
    perkDescription: 'Mở khóa "Đầu tư cơ bản" + AI CFO nâng cao',
    unlockedCourse: 'investing-basics',
  },
  {
    id: 'platinum',
    name: 'Bạch Kim',
    icon: '💎',
    xpRequired: 12000,
    gradientFrom: '#6366F1',
    gradientTo: '#A78BFA',
    encouragement: 'Đẳng cấp quản lý tiền bạc!',
    perkDescription: 'Mở khóa "Chiến lược thu nhập thụ động"',
    unlockedCourse: 'passive-income',
  },
  {
    id: 'emerald',
    name: 'Lục Bảo',
    icon: '🟢',
    xpRequired: 25000,
    gradientFrom: '#059669',
    gradientTo: '#34D399',
    encouragement: 'Bậc thầy kiếm tiền!',
    perkDescription: 'Mở khóa "Xây dựng mạng lưới kinh doanh"',
    unlockedCourse: 'business-network',
  },
  {
    id: 'diamond',
    name: 'Kim Cương',
    icon: '💠',
    xpRequired: 50000,
    gradientFrom: '#06B6D4',
    gradientTo: '#67E8F9',
    encouragement: 'Huyền thoại tài chính!',
    perkDescription: 'MỞ KHÓA TẤT CẢ khóa học đầu tư cao cấp',
    unlockedCourse: 'advanced-investing',
  },
];

export const RANK_HIERARCHY: UserRank[] = [
  'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond',
];

export function getRankByXP(xp: number): RankDefinition {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.xpRequired) {
      current = rank;
    }
  }
  return current;
}

export function getNextRank(currentRank: UserRank): RankDefinition | null {
  const idx = RANK_HIERARCHY.indexOf(currentRank);
  if (idx < 0 || idx >= RANKS.length - 1) return null;
  return RANKS[idx + 1];
}

export function getRankProgress(xp: number): { current: RankDefinition; next: RankDefinition | null; progress: number } {
  const current = getRankByXP(xp);
  const next = getNextRank(current.id);
  if (!next) return { current, next: null, progress: 100 };

  const xpInRange = xp - current.xpRequired;
  const totalRange = next.xpRequired - current.xpRequired;
  const progress = Math.min(100, Math.round((xpInRange / totalRange) * 100));

  return { current, next, progress };
}
