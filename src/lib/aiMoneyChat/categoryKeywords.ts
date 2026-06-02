export interface CategoryKeywordRule {
  categoryId: string;
  categoryName: string;
  keywords: string[];
}

export const EXPENSE_KEYWORD_RULES: CategoryKeywordRule[] = [
  {
    categoryId: 'food',
    categoryName: 'An uong',
    keywords: [
      'an',
      'bun',
      'com',
      'dau hu',
      'do an',
      'ga ran',
      'mi',
      'pho',
      'tra sua',
    ],
  },
  {
    categoryId: 'coffee',
    categoryName: 'Ca phe',
    keywords: ['bac xiu', 'ca phe', 'cafe', 'coffee', 'latte'],
  },
  {
    categoryId: 'groceries',
    categoryName: 'Di cho/Sieu thi',
    keywords: [
      'bach hoa',
      'di cho',
      'gia vi',
      'rau',
      'sieu thi',
      'thit',
      'vinmart',
      'winmart',
    ],
  },
  {
    categoryId: 'transport',
    categoryName: 'Di chuyen',
    keywords: ['be', 'grab', 'gui xe', 'taxi', 'xang', 'xe om'],
  },
  {
    categoryId: 'clothing',
    categoryName: 'Quan ao',
    keywords: ['ao', 'dam', 'giay', 'quan', 'tui xach', 'vay'],
  },
  {
    categoryId: 'cosmetics',
    categoryName: 'My pham',
    keywords: ['kem chong nang', 'my pham', 'nuoc hoa', 'son'],
  },
  {
    categoryId: 'shopping',
    categoryName: 'Mua sam khac',
    keywords: ['lazada', 'mua sam', 'shopee', 'tiki', 'dat hang'],
  },
  {
    categoryId: 'entertain',
    categoryName: 'Giai tri',
    keywords: ['netflix', 'phim', 'spotify', 'tarot', 've xem'],
  },
  {
    categoryId: 'health',
    categoryName: 'Suc khoe',
    keywords: ['bac si', 'benh vien', 'dong y', 'kham', 'thuoc'],
  },
  {
    categoryId: 'education',
    categoryName: 'Hoc tap',
    keywords: ['khoa hoc', 'sach', 'tai lieu', 'workshop'],
  },
  {
    categoryId: 'bills',
    categoryName: 'Hoa don',
    keywords: ['bill', 'dien', 'internet', 'nuoc', 'wifi'],
  },
  {
    categoryId: 'rent',
    categoryName: 'Thue nha',
    keywords: ['mat bang', 'phong tro', 'thue nha', 'tien nha'],
  },
  {
    categoryId: 'gift',
    categoryName: 'Qua tang',
    keywords: ['bieng', 'di dam', 'mung', 'qua tang', 'sinh nhat'],
  },
];

export const INCOME_KEYWORD_RULES: CategoryKeywordRule[] = [
  {
    categoryId: 'salary',
    categoryName: 'Luong',
    keywords: ['luong', 'salary'],
  },
  {
    categoryId: 'freelance',
    categoryName: 'Freelance',
    keywords: ['freelance', 'job ngoai', 'viec ngoai'],
  },
  {
    categoryId: 'business',
    categoryName: 'Kinh doanh',
    keywords: ['ban hang', 'chot don', 'doanh thu', 'kinh doanh'],
  },
  {
    categoryId: 'investment',
    categoryName: 'Dau tu',
    keywords: ['co tuc', 'dau tu', 'lai', 'loi nhuan'],
  },
  {
    categoryId: 'bonus',
    categoryName: 'Thuong',
    keywords: ['bonus', 'hoa hong', 'thuong'],
  },
  {
    categoryId: 'gift-in',
    categoryName: 'Qua nhan',
    keywords: ['duoc tang', 'duoc cho', 'qua nhan'],
  },
];

