import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/data/categories';

export type TaxonomyDirection = 'income' | 'expense';

export type TaxonomyBucket =
  | 'food_and_drink'
  | 'groceries'
  | 'transport'
  | 'home_and_living'
  | 'shopping'
  | 'health'
  | 'learning'
  | 'bills'
  | 'housing'
  | 'giving'
  | 'entertainment'
  | 'income_work'
  | 'income_business'
  | 'income_investment'
  | 'income_other'
  | 'other';

export interface TaxonomyCategory {
  id: string;
  direction: TaxonomyDirection;
  displayName: string;
  bucket: TaxonomyBucket;
  allowAsUserCategory: boolean;
  itemTagExamples: string[];
  aliases: string[];
}

export const AI_MONEY_CHAT_TAXONOMY: TaxonomyCategory[] = [
  { id: 'food', direction: 'expense', displayName: 'An uong', bucket: 'food_and_drink', allowAsUserCategory: true, itemTagExamples: ['tra sua', 'dau hu', 'pho', 'com'], aliases: ['food', 'meal'] },
  { id: 'coffee', direction: 'expense', displayName: 'Ca phe', bucket: 'food_and_drink', allowAsUserCategory: true, itemTagExamples: ['ca phe', 'bac xiu', 'latte'], aliases: ['cafe', 'coffee'] },
  { id: 'groceries', direction: 'expense', displayName: 'Di cho/Sieu thi', bucket: 'groceries', allowAsUserCategory: true, itemTagExamples: ['sieu thi', 'gia vi', 'rau', 'bot giat'], aliases: ['market', 'supermarket'] },
  { id: 'transport', direction: 'expense', displayName: 'Di chuyen', bucket: 'transport', allowAsUserCategory: true, itemTagExamples: ['grab', 'taxi', 'xang'], aliases: ['travel', 'ride'] },
  { id: 'clothing', direction: 'expense', displayName: 'Quan ao', bucket: 'shopping', allowAsUserCategory: true, itemTagExamples: ['ao', 'quan', 'giay'], aliases: ['fashion'] },
  { id: 'cosmetics', direction: 'expense', displayName: 'My pham', bucket: 'shopping', allowAsUserCategory: true, itemTagExamples: ['son', 'kem chong nang', 'nuoc hoa'], aliases: ['beauty'] },
  { id: 'shopping', direction: 'expense', displayName: 'Mua sam khac', bucket: 'shopping', allowAsUserCategory: true, itemTagExamples: ['shopee', 'moc phoi do', 'do phong thuy'], aliases: ['online shopping'] },
  { id: 'entertain', direction: 'expense', displayName: 'Giai tri', bucket: 'entertainment', allowAsUserCategory: true, itemTagExamples: ['phim', 'netflix', 'tarot'], aliases: ['entertainment'] },
  { id: 'health', direction: 'expense', displayName: 'Suc khoe', bucket: 'health', allowAsUserCategory: true, itemTagExamples: ['thuoc', 'dong y', 'bac si'], aliases: ['medical'] },
  { id: 'education', direction: 'expense', displayName: 'Hoc tap', bucket: 'learning', allowAsUserCategory: true, itemTagExamples: ['khoa hoc', 'sach'], aliases: ['learning'] },
  { id: 'bills', direction: 'expense', displayName: 'Hoa don', bucket: 'bills', allowAsUserCategory: true, itemTagExamples: ['dien', 'nuoc', 'internet'], aliases: ['utility'] },
  { id: 'rent', direction: 'expense', displayName: 'Thue nha', bucket: 'housing', allowAsUserCategory: true, itemTagExamples: ['tien nha', 'phong tro'], aliases: ['rent', 'housing'] },
  { id: 'gift', direction: 'expense', displayName: 'Qua tang', bucket: 'giving', allowAsUserCategory: true, itemTagExamples: ['sinh nhat', 'di dam'], aliases: ['gift'] },
  { id: 'pet', direction: 'expense', displayName: 'Thu cung', bucket: 'home_and_living', allowAsUserCategory: true, itemTagExamples: ['thuc an thu cung'], aliases: ['pet'] },
  { id: 'other', direction: 'expense', displayName: 'Khac', bucket: 'other', allowAsUserCategory: true, itemTagExamples: [], aliases: ['unknown expense'] },
  { id: 'salary', direction: 'income', displayName: 'Luong', bucket: 'income_work', allowAsUserCategory: true, itemTagExamples: ['luong thang'], aliases: ['paycheck'] },
  { id: 'freelance', direction: 'income', displayName: 'Freelance', bucket: 'income_work', allowAsUserCategory: true, itemTagExamples: ['job ngoai', 'viec ngoai'], aliases: ['side job'] },
  { id: 'business', direction: 'income', displayName: 'Kinh doanh', bucket: 'income_business', allowAsUserCategory: true, itemTagExamples: ['ban hang', 'doanh thu'], aliases: ['sales'] },
  { id: 'investment', direction: 'income', displayName: 'Dau tu', bucket: 'income_investment', allowAsUserCategory: true, itemTagExamples: ['co tuc', 'lai dau tu'], aliases: ['investing return'] },
  { id: 'bonus', direction: 'income', displayName: 'Thuong', bucket: 'income_work', allowAsUserCategory: true, itemTagExamples: ['bonus', 'hoa hong'], aliases: ['commission'] },
  { id: 'gift-in', direction: 'income', displayName: 'Qua nhan', bucket: 'income_other', allowAsUserCategory: true, itemTagExamples: ['duoc cho', 'duoc tang'], aliases: ['gift received'] },
  { id: 'other-in', direction: 'income', displayName: 'Thu nhap khac', bucket: 'income_other', allowAsUserCategory: true, itemTagExamples: [], aliases: ['unknown income'] },
];

export const DEFAULT_EXPENSE_CATEGORY_ID = 'other';
export const DEFAULT_INCOME_CATEGORY_ID = 'other-in';

export function getTaxonomyCategory(categoryId: string): TaxonomyCategory | undefined {
  return AI_MONEY_CHAT_TAXONOMY.find((category) => category.id === categoryId);
}

export function getTaxonomyByDirection(direction: TaxonomyDirection): TaxonomyCategory[] {
  return AI_MONEY_CHAT_TAXONOMY.filter((category) => category.direction === direction);
}

export function isKnownTaxonomyCategory(categoryId: string): boolean {
  return Boolean(getTaxonomyCategory(categoryId));
}

export function isKnownAppCategory(categoryId: string): boolean {
  return [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].some((category) => category.id === categoryId);
}

export function getDefaultCategoryId(direction: TaxonomyDirection): string {
  return direction === 'income' ? DEFAULT_INCOME_CATEGORY_ID : DEFAULT_EXPENSE_CATEGORY_ID;
}

export function getCategoryDisplayName(categoryId: string): string {
  return getTaxonomyCategory(categoryId)?.displayName ?? categoryId;
}

