/* ═══ Expense Categories with Icons ═══ */

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const EXPENSE_CATEGORIES: CategoryItem[] = [
  { id: 'food',        name: 'Ăn uống',       icon: '🍜', color: '#F97316' },
  { id: 'transport',   name: 'Di chuyển',      icon: '🚗', color: '#3B82F6' },
  { id: 'shopping',    name: 'Mua sắm',        icon: '🛍️', color: '#EC4899' },
  { id: 'coffee',      name: 'Cà phê',         icon: '☕', color: '#92400E' },
  { id: 'entertain',   name: 'Giải trí',       icon: '🎬', color: '#8B5CF6' },
  { id: 'health',      name: 'Sức khỏe',       icon: '💊', color: '#10B981' },
  { id: 'education',   name: 'Học tập',        icon: '📚', color: '#6366F1' },
  { id: 'bills',       name: 'Hóa đơn',       icon: '📄', color: '#EF4444' },
  { id: 'rent',        name: 'Thuê nhà',       icon: '🏠', color: '#F59E0B' },
  { id: 'gift',        name: 'Quà tặng',       icon: '🎁', color: '#EC4899' },
  { id: 'pet',         name: 'Thú cưng',       icon: '🐕', color: '#D97706' },
  { id: 'other',       name: 'Khác',           icon: '📦', color: '#6B7280' },
];

export const INCOME_CATEGORIES: CategoryItem[] = [
  { id: 'salary',      name: 'Lương',          icon: '💰', color: '#22C55E' },
  { id: 'freelance',   name: 'Freelance',      icon: '💻', color: '#3B82F6' },
  { id: 'business',    name: 'Kinh doanh',     icon: '🏪', color: '#F97316' },
  { id: 'investment',  name: 'Đầu tư',         icon: '📈', color: '#8B5CF6' },
  { id: 'bonus',       name: 'Thưởng',         icon: '🎉', color: '#F59E0B' },
  { id: 'gift-in',     name: 'Quà nhận',       icon: '🎁', color: '#EC4899' },
  { id: 'other-in',    name: 'Thu nhập khác',   icon: '💵', color: '#6B7280' },
];
