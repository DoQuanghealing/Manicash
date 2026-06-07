export interface CategoryKeywordRule {
  categoryId: string;
  categoryName: string;
  keywords: string[];
}

/**
 * Keyword đã chuẩn hoá: chữ thường + bỏ dấu + đ→d (khớp normalizeText trong parser).
 * Matching theo RANH GIỚI TỪ (\b...\b) nên keyword ngắn an toàn, nhưng vẫn ưu tiên
 * cụm cụ thể cho từ mơ hồ (vd "nuoc" → dùng "tien nuoc"/"nuoc hoa"/"nuoc mam",
 * KHÔNG để "nuoc" trần). Cụm nhiều chữ ăn điểm cao hơn → thắng khi trùng.
 */
export const EXPENSE_KEYWORD_RULES: CategoryKeywordRule[] = [
  {
    categoryId: 'food',
    categoryName: 'An uong',
    keywords: [
      'an', 'an co', 'an dem', 'an sang', 'an toi', 'an trua', 'an tiem', 'an ngoai',
      'banh canh', 'banh mi', 'banh trang tron', 'bap nuong', 'buffet',
      'bun', 'bun bo', 'bun cha', 'ca vien chien', 'com', 'com ga', 'com tam',
      'com trua', 'com van phong', 'dat do an', 'dau hu', 'do an', 'ga ran',
      'goi cuon', 'grabfood', 'hau', 'hot vit lon', 'hu tieu', 'lau', 'lien hoan',
      'mi', 'mi cay', 'mi quang', 'nem chua', 'nuong', 'oc', 'pha lau', 'pho',
      'pizza', 'quan an', 'ship do an', 'shopeefood', 'sushi', 'tiec', 'tra sua',
      'trung', 'xien que', 'xuc xich',
    ],
  },
  {
    categoryId: 'coffee',
    categoryName: 'Ca phe',
    keywords: [
      'bac xiu', 'bac siu', 'bia', 'ca phe', 'cafe', 'cf', 'cappuccino', 'coca',
      'coffee', 'highlands', 'katinat', 'latte', 'matcha', 'nuoc ep', 'nuoc ngot',
      'nuoc suoi', 'pepsi', 'phuc long', 'ruou', 'sinh to', 'starbuck', 'starbucks',
      'ta tua', 'the coffee house', 'tra chanh', 'tra da', 'tra dao', 'tra tac',
    ],
  },
  {
    categoryId: 'groceries',
    categoryName: 'Di cho/Sieu thi',
    keywords: [
      'bach hoa', 'bach hoa xanh', 'ban chai', 'bigc', 'big c', 'bot giat', 'ca',
      'cho dau moi', 'coopmart', 'dau an', 'dau goi', 'di cho', 'dua hau', 'gao',
      'gia vi', 'giay ve sinh', 'hai san tuoi', 'hanh toi', 'kem danh rang',
      'khan giay', 'mi goi', 'nuoc giat', 'nuoc mam', 'nuoc rua chen', 'nuoc xa',
      'rau', 'rau cu', 'sieu thi', 'sua dac', 'sua tam', 'sua tuoi', 'tap hoa',
      'thit', 'thit bo', 'thit heo', 'tom', 'trai cay', 'vinmart', 'winmart',
    ],
  },
  {
    categoryId: 'transport',
    categoryName: 'Di chuyen',
    keywords: [
      'be', 'cao toc', 'day binh', 'do xang', 'grab', 'giu xe', 'gui xe',
      'limousine', 'parking', 'phat giao thong', 'phi bot', 'phi gui xe',
      'phu tung', 'rua xe', 'sua xe', 'sua xe may', 'taxi', 'thay nhot',
      'thue xe', 'tram bot', 'va xe', 've cau duong', 've may bay', 've tau',
      've xe buyt', 've xe khach', 'xang', 'xanh sm', 'xe khach', 'xe om',
    ],
  },
  {
    categoryId: 'clothing',
    categoryName: 'Quan ao',
    keywords: [
      'ao', 'ao doi', 'ao khoac', 'ao len', 'ao so mi', 'ao thun', 'balo',
      'cao got', 'dam', 'dep', 'do lot', 'do ngu', 'giay', 'giay tay',
      'giay the thao', 'local brand', 'mat kinh', 'mu', 'non', 'quan',
      'quan jean', 'quan legging', 'quan tay', 'sandals', 'that lung',
      'tui xach', 'vay', 'vay dam', 'vi tien',
    ],
  },
  {
    categoryId: 'cosmetics',
    categoryName: 'My pham',
    keywords: [
      'cushion', 'guardian', 'hasaki', 'ke mat', 'kem chong nang', 'kem duong',
      'kem nen', 'ma hong', 'mascara', 'mat na', 'my pham', 'nuoc hoa',
      'phan mat', 'serum', 'son', 'son moi', 'son mong tay', 'sua rua mat',
      'tay te bao chet', 'tay trang', 'tiem my pham', 'toner',
    ],
  },
  {
    categoryId: 'shopping',
    categoryName: 'Mua sam khac',
    keywords: [
      'ban ghe', 'ban phim', 'bat dua', 'bong den', 'chuot', 'dat hang', 'deal',
      'day cap', 'dien thoai', 'do dien', 'do gia dung', 'lazada',
      'mua online', 'mua sam', 'noi com dien', 'noi that', 'op lung', 'quat',
      'sac du phong', 'san sale', 'sendo', 'shopee', 'tai nghe', 'tiki',
      'tiktok shop', 'usb',
    ],
  },
  {
    categoryId: 'entertain',
    categoryName: 'Giai tri',
    keywords: [
      'bida', 'bowling', 'cgv', 'choi game', 'concert', 'cong vien', 'di bar',
      'du lich', 'galaxy play', 'homestay', 'icloud', 'karaoke', 'khach san',
      'khu vui choi', 'luot net', 'nap game', 'netflix', 'phim', 'ps plus',
      'resort', 'spotify', 'tarot', 'trien lam', 've ca nhac', 've concert',
      've xem', 'xem phim', 'youtube premium',
    ],
  },
  {
    categoryId: 'health',
    categoryName: 'Suc khoe',
    keywords: [
      'bac si', 'benh vien', 'bong bang', 'cat kinh', 'cau long', 'da bong',
      'dong y', 'gym', 'kham', 'kham benh', 'nha khoa', 'nho rang', 'phong kham',
      'the gym', 'the tap', 'thuc pham chuc nang', 'thue san', 'thuoc',
      'thuoc cam', 'tien gym', 'vitamin', 'vot', 'yoga',
    ],
  },
  {
    categoryId: 'education',
    categoryName: 'Hoc tap',
    keywords: [
      'but', 'do dung hoc tap', 'giao trinh', 'hoc code', 'hoc phi', 'hoc them',
      'hoc tieng anh', 'hoi thao', 'khoa hoc', 'mua tai lieu', 'sach',
      'sach giao khoa', 'tai lieu', 'tap vo', 'tien hoc', 'tien quy lop',
      'van phong pham', 'workshop',
    ],
  },
  {
    categoryId: 'bills',
    categoryName: 'Hoa don',
    keywords: [
      '4g', 'bill', 'cao the', 'cap quang', 'cuoc dien thoai', 'cuoc tra sau',
      'dien', 'goi 4g', 'hoa don', 'hoa don dien', 'hoa don nuoc', 'internet',
      'nap the', 'phi quan ly', 'phi quan ly chung cu', 'tien dien',
      'tien dien thoai', 'tien mang', 'tien nuoc', 'tien rac', 'tien wifi', 'wifi',
    ],
  },
  {
    categoryId: 'rent',
    categoryName: 'Thue nha',
    keywords: [
      'coc nha', 'dat coc nha', 'mat bang', 'phong tro', 'thue chung cu',
      'thue nha', 'tien mat bang', 'tien nha', 'tien phong', 'tien tro',
    ],
  },
  {
    categoryId: 'gift',
    categoryName: 'Qua tang',
    keywords: [
      'bao ban', 'bieu', 'bieu bo me', 'dam cuoi', 'day thang', 'di dam',
      'donate', 'li xi', 'moi nuoc', 'mung', 'mung cuoi', 'mung tuoi',
      'qua tang', 'qua tet', 'qua trung thu', 'quoc te phu nu', 'quyen gop',
      'sinh nhat', 'tang qua', 'tet', 'thoi noi', 'trung thu', 'tu thien',
      'valentine',
    ],
  },
  {
    categoryId: 'pet',
    categoryName: 'Thu cung',
    keywords: [
      'banh thuong', 'cat ve sinh', 'cho meo', 'co meo', 'day xich',
      'do choi thu cung', 'hat cho meo', 'kham thu y', 'pate', 'spa thu cung',
      'thu cung', 'thu y', 'thuc an cho meo', 'thuc an thu cung', 'tiem phong',
    ],
  },
];

export const INCOME_KEYWORD_RULES: CategoryKeywordRule[] = [
  {
    categoryId: 'salary',
    categoryName: 'Luong',
    keywords: ['luong', 'luong thang', 'luong thuong', 'salary', 'tien luong'],
  },
  {
    categoryId: 'freelance',
    categoryName: 'Freelance',
    keywords: ['freelance', 'job ngoai', 'lam them', 'viec freelance', 'viec ngoai'],
  },
  {
    categoryId: 'business',
    categoryName: 'Kinh doanh',
    keywords: ['ban duoc', 'ban hang', 'chot don', 'doanh thu', 'kinh doanh', 'tien hang'],
  },
  {
    categoryId: 'investment',
    categoryName: 'Dau tu',
    keywords: ['co tuc', 'dau tu', 'lai', 'lai ngan hang', 'lai suat', 'loi nhuan', 'tien lai'],
  },
  {
    categoryId: 'bonus',
    categoryName: 'Thuong',
    keywords: ['bonus', 'hoa hong', 'thuong', 'thuong tet'],
  },
  {
    categoryId: 'gift-in',
    categoryName: 'Qua nhan',
    keywords: ['duoc cho', 'duoc li xi', 'duoc tang', 'mung tuoi', 'qua nhan'],
  },
];
