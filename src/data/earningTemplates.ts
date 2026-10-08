/* ═══ Thư viện ý tưởng kiếm tiền — 6 chủ đề, 34 mẫu (Đợt 1) ═══
 * Spec: docs/SPEC_DOT_1_THU_VIEN_MAU.md mục 5. Dữ liệu tĩnh, chạy trên máy, 0đ.
 * Bấm + trên mẫu → form điền sẵn (tên, tiền kỳ vọng = giữa khung giá, hạn, checklist).
 *
 * ⚠️ `id` của mẫu được lưu vào task (`templateId`) để đo "mẫu nào ra tiền" —
 *    KHÔNG đổi id sau khi phát hành; muốn bỏ mẫu thì xoá, đừng tái dùng id.
 * ⚠️ Giá là khung tham khảo thị trường VN, không phải cam kết thu nhập.
 */

export type EarningThemeId =
  | 'sell-online'
  | 'freelance'
  | 'tutoring'
  | 'declutter'
  | 'weekend'
  | 'idle-assets';

export type EarningPriceUnit = 'lượt' | 'buổi' | 'ca' | 'ngày' | 'giờ' | 'tháng' | 'đợt' | 'bộ' | 'trang' | 'khoá';

/** Danh mục thu (id trong INCOME_CATEGORIES) ghi khi nhận tiền. */
export type EarningIncomeCategory = 'freelance' | 'business' | 'other-in';

export interface EarningTheme {
  id: EarningThemeId;
  emoji: string;
  name: string;
  /** Một dòng giới thiệu chủ đề. */
  blurb: string;
  /** Kỹ năng (id trong SKILL_OPTIONS của La bàn năng lực) đẩy chủ đề này lên đầu. */
  skills: string[];
}

export interface EarningTemplate {
  id: string;
  themeId: EarningThemeId;
  emoji: string;
  name: string;
  priceRange: { min: number; max: number; unit: EarningPriceUnit };
  /** Số ngày thường mất → hạn = hôm nay + typicalDays. */
  typicalDays: number;
  /** 3–5 bước → checklist (subTasks). */
  steps: string[];
  incomeCategory: EarningIncomeCategory;
  skills: string[];
}

export const EARNING_THEMES: EarningTheme[] = [
  { id: 'sell-online', emoji: '🛍️', name: 'Bán hàng online', blurb: 'Bán món mình làm được hoặc lấy được giá tốt', skills: ['sales', 'marketing', 'handcraft'] },
  { id: 'freelance', emoji: '💻', name: 'Nhận việc tự do', blurb: 'Bán tay nghề theo từng việc nhỏ', skills: ['writing', 'design', 'coding', 'video', 'finance'] },
  { id: 'tutoring', emoji: '📚', name: 'Dạy kèm', blurb: 'Dạy điều mình giỏi, thu theo tháng', skills: ['teaching', 'language', 'counsel'] },
  { id: 'declutter', emoji: '♻️', name: 'Thanh lý đồ cũ', blurb: 'Đồ không dùng nữa đổi ra tiền', skills: [] },
  { id: 'weekend', emoji: '⏰', name: 'Làm thêm cuối tuần', blurb: 'Ca ngắn, nhận tiền ngay trong ngày', skills: ['ops'] },
  { id: 'idle-assets', emoji: '🔑', name: 'Tài sản nhàn rỗi', blurb: 'Đồ, chỗ, file đang để không cũng ra tiền', skills: [] },
];

const k = 1_000;
const tr = 1_000_000;

export const EARNING_TEMPLATES: EarningTemplate[] = [
  // ── 🛍️ Bán hàng online ──
  { id: 'sell-preorder-snacks', themeId: 'sell-online', emoji: '🍪', name: 'Bán đồ ăn vặt nhận đặt trước',
    priceRange: { min: 300 * k, max: 1.5 * tr, unit: 'đợt' }, typicalDays: 3, incomeCategory: 'business', skills: ['sales', 'handcraft'],
    steps: ['Chốt menu + giá vốn', 'Đăng bài nhận đặt', 'Thu cọc khi chốt đơn', 'Làm & giao', 'Thu nốt tiền'] },
  { id: 'sell-seasonal', themeId: 'sell-online', emoji: '🌹', name: 'Bán hàng theo dịp (20/10, Trung thu, Tết)',
    priceRange: { min: 500 * k, max: 3 * tr, unit: 'đợt' }, typicalDays: 10, incomeCategory: 'business', skills: ['sales', 'marketing'],
    steps: ['Chọn 1 món theo dịp', 'Hỏi giá 2 nguồn hàng', 'Đăng bài trước dịp 7 ngày', 'Chốt đơn + cọc', 'Giao đúng ngày'] },
  { id: 'sell-handmade', themeId: 'sell-online', emoji: '🧶', name: 'Bán đồ handmade',
    priceRange: { min: 200 * k, max: 1 * tr, unit: 'đợt' }, typicalDays: 7, incomeCategory: 'business', skills: ['handcraft', 'design'],
    steps: ['Làm 5–10 mẫu', 'Chụp ảnh nền sáng', 'Đăng Facebook/Shopee', 'Trả lời tin nhắn trong ngày', 'Đóng gói & giao'] },
  { id: 'sell-order-for-others', themeId: 'sell-online', emoji: '📦', name: 'Nhận đặt hàng hộ từ nguồn quen',
    priceRange: { min: 300 * k, max: 2 * tr, unit: 'đợt' }, typicalDays: 7, incomeCategory: 'business', skills: ['sales'],
    steps: ['Chọn 1 nguồn tin cậy', 'Giá bán = vốn + ship + lãi', 'Đăng 3 bài', 'Thu cọc 50%', 'Giao & thu đủ'] },
  { id: 'sell-one-hero-shop', themeId: 'sell-online', emoji: '🏪', name: 'Mở gian Shopee/TikTok Shop 1 món chủ lực',
    priceRange: { min: 500 * k, max: 3 * tr, unit: 'tháng' }, typicalDays: 14, incomeCategory: 'business', skills: ['sales', 'marketing', 'video'],
    steps: ['Chọn 1 sản phẩm', 'Đăng ký gian', 'Đăng sản phẩm có ảnh thật', 'Làm 1 clip ngắn', 'Đơn đầu tiên'] },
  { id: 'sell-succulents', themeId: 'sell-online', emoji: '🌵', name: 'Bán sen đá / cây cảnh nhỏ',
    priceRange: { min: 200 * k, max: 800 * k, unit: 'đợt' }, typicalDays: 14, incomeCategory: 'business', skills: ['handcraft'],
    steps: ['Nhân giống hoặc nhập 20 chậu', 'Chụp ảnh từng chậu', 'Đăng nhóm cây cảnh', 'Hẹn giao'] },

  // ── 💻 Nhận việc tự do ──
  { id: 'free-social-design', themeId: 'freelance', emoji: '🎨', name: 'Thiết kế bài đăng / banner cho shop nhỏ',
    priceRange: { min: 150 * k, max: 500 * k, unit: 'bộ' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['design'],
    steps: ['Hỏi rõ yêu cầu + màu thương hiệu', 'Gửi 2 phương án', 'Sửa tối đa 2 lần', 'Giao file', 'Thu tiền'] },
  { id: 'free-10-captions', themeId: 'freelance', emoji: '✍️', name: 'Viết gói 10 caption bán hàng',
    priceRange: { min: 300 * k, max: 1 * tr, unit: 'bộ' }, typicalDays: 3, incomeCategory: 'freelance', skills: ['writing', 'marketing'],
    steps: ['Đọc trang khách', 'Viết 2 bài mẫu cho duyệt', 'Viết đủ 10', 'Giao & thu tiền'] },
  { id: 'free-short-video', themeId: 'freelance', emoji: '🎬', name: 'Dựng video ngắn cho quán',
    priceRange: { min: 200 * k, max: 700 * k, unit: 'lượt' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['video'],
    steps: ['Nhận cảnh quay', 'Dựng bản nháp', 'Sửa 1 lần', 'Xuất đúng khổ dọc', 'Thu tiền'] },
  { id: 'free-data-entry', themeId: 'freelance', emoji: '📊', name: 'Nhập liệu / làm bảng Excel',
    priceRange: { min: 200 * k, max: 800 * k, unit: 'lượt' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['finance', 'ops', 'coding'],
    steps: ['Chốt mẫu đầu ra', 'Làm 10% gửi khách duyệt', 'Làm hết', 'Kiểm lỗi', 'Thu tiền'] },
  { id: 'free-translate', themeId: 'freelance', emoji: '🌐', name: 'Dịch tài liệu Anh–Việt',
    priceRange: { min: 80 * k, max: 150 * k, unit: 'trang' }, typicalDays: 3, incomeCategory: 'freelance', skills: ['language', 'writing'],
    steps: ['Báo giá theo trang', 'Thu cọc', 'Dịch', 'Soát lại 1 lượt', 'Giao & thu nốt'] },
  { id: 'free-product-photo', themeId: 'freelance', emoji: '📸', name: 'Chụp ảnh sản phẩm cho shop',
    priceRange: { min: 300 * k, max: 1.5 * tr, unit: 'buổi' }, typicalDays: 1, incomeCategory: 'freelance', skills: ['design', 'video'],
    steps: ['Chốt số sản phẩm + phong cách', 'Chuẩn bị nền & đèn', 'Chụp', 'Chỉnh màu', 'Giao ảnh & thu tiền'] },

  // ── 📚 Dạy kèm ──
  { id: 'tutor-primary', themeId: 'tutoring', emoji: '✏️', name: 'Gia sư Toán/Văn cấp 1–2',
    priceRange: { min: 1.2 * tr, max: 2 * tr, unit: 'tháng' }, typicalDays: 30, incomeCategory: 'freelance', skills: ['teaching'],
    steps: ['Chốt lịch với phụ huynh', 'Kiểm tra đầu vào', 'Lộ trình 4 tuần', 'Báo kết quả cuối tháng', 'Thu học phí'] },
  { id: 'tutor-english-1on1', themeId: 'tutoring', emoji: '🗣️', name: 'Kèm tiếng Anh giao tiếp online 1-1',
    priceRange: { min: 1.5 * tr, max: 3 * tr, unit: 'tháng' }, typicalDays: 30, incomeCategory: 'freelance', skills: ['language', 'teaching'],
    steps: ['Buổi thử miễn phí 20 phút', 'Chốt mục tiêu', 'Lịch 8 buổi', 'Thu học phí đầu tháng'] },
  { id: 'tutor-music', themeId: 'tutoring', emoji: '🎸', name: 'Dạy guitar/ukulele/piano cơ bản',
    priceRange: { min: 1.2 * tr, max: 2.5 * tr, unit: 'tháng' }, typicalDays: 30, incomeCategory: 'freelance', skills: ['teaching'],
    steps: ['Chuẩn bị giáo trình 8 buổi', 'Tìm 1 học viên quen', 'Dạy', 'Quay clip tiến bộ gửi học viên', 'Thu học phí'] },
  { id: 'tutor-exam-prep', themeId: 'tutoring', emoji: '🎯', name: 'Luyện thi phần mình giỏi (IELTS/TOEIC…)',
    priceRange: { min: 2 * tr, max: 4 * tr, unit: 'khoá' }, typicalDays: 30, incomeCategory: 'freelance', skills: ['language', 'teaching'],
    steps: ['Chọn đúng 1 kỹ năng', 'Soạn đề luyện', 'Mở nhóm 3–5 người', 'Thi thử cuối khoá', 'Thu học phí'] },
  { id: 'tutor-office-skills', themeId: 'tutoring', emoji: '💻', name: 'Dạy tin học văn phòng cho người lớn',
    priceRange: { min: 500 * k, max: 1.5 * tr, unit: 'khoá' }, typicalDays: 14, incomeCategory: 'freelance', skills: ['teaching', 'ops', 'counsel'],
    steps: ['Soạn 5 buổi (Word, Excel, Zalo, email)', 'Tìm học viên qua người quen', 'Dạy', 'Thu tiền'] },

  // ── ♻️ Thanh lý đồ cũ ──
  { id: 'declutter-clothes', themeId: 'declutter', emoji: '👕', name: 'Thanh lý quần áo không mặc',
    priceRange: { min: 200 * k, max: 1 * tr, unit: 'đợt' }, typicalDays: 7, incomeCategory: 'other-in', skills: [],
    steps: ['Lọc đồ không mặc 6 tháng', 'Giặt, là', 'Chụp ảnh treo', 'Đăng nhóm pass đồ', 'Giao/hẹn gặp'] },
  { id: 'declutter-phone-laptop', themeId: 'declutter', emoji: '📱', name: 'Bán lại điện thoại/laptop cũ',
    priceRange: { min: 1 * tr, max: 8 * tr, unit: 'lượt' }, typicalDays: 7, incomeCategory: 'other-in', skills: [],
    steps: ['Sao lưu, xoá dữ liệu, đăng xuất mọi tài khoản', 'Xem giá 3 nơi', 'Chụp ảnh + ghi lỗi trung thực', 'Gặp nơi đông người, nhận đủ tiền mới giao'] },
  { id: 'declutter-books', themeId: 'declutter', emoji: '📖', name: 'Pass sách / giáo trình cũ',
    priceRange: { min: 100 * k, max: 500 * k, unit: 'đợt' }, typicalDays: 7, incomeCategory: 'other-in', skills: [],
    steps: ['Gom sách', 'Chụp gáy sách thành 1 ảnh', 'Đăng nhóm sách cũ', 'Giao'] },
  { id: 'declutter-baby-gear', themeId: 'declutter', emoji: '🍼', name: 'Bán đồ em bé đã dùng (xe đẩy, nôi…)',
    priceRange: { min: 300 * k, max: 2 * tr, unit: 'đợt' }, typicalDays: 7, incomeCategory: 'other-in', skills: [],
    steps: ['Vệ sinh sạch', 'Chụp ảnh đủ góc', 'Đăng nhóm mẹ bỉm', 'Hẹn xem hàng', 'Thu tiền'] },
  { id: 'declutter-moving', themeId: 'declutter', emoji: '🏠', name: 'Thanh lý đồ gia dụng khi chuyển nhà',
    priceRange: { min: 500 * k, max: 3 * tr, unit: 'đợt' }, typicalDays: 10, incomeCategory: 'other-in', skills: [],
    steps: ['Lập danh sách + giá', 'Đăng 1 bài gộp', 'Ưu tiên khách tự chở', 'Thu tiền'] },
  { id: 'declutter-scrap', themeId: 'declutter', emoji: '🗞️', name: 'Bán ve chai, giấy, lon',
    priceRange: { min: 50 * k, max: 200 * k, unit: 'lượt' }, typicalDays: 1, incomeCategory: 'other-in', skills: [],
    steps: ['Phân loại giấy/nhựa/kim loại', 'Gọi người thu mua', 'Cân & nhận tiền'] },

  // ── ⏰ Làm thêm cuối tuần ──
  { id: 'weekend-event-staff', themeId: 'weekend', emoji: '🎉', name: 'Phục vụ tiệc cưới / sự kiện',
    priceRange: { min: 200 * k, max: 400 * k, unit: 'ca' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['ops'],
    steps: ['Vào nhóm tuyển ca', 'Đăng ký ca', 'Chuẩn bị đồng phục', 'Làm ca', 'Nhận tiền cuối ca'] },
  { id: 'weekend-delivery', themeId: 'weekend', emoji: '🛵', name: 'Chạy giao hàng / xe công nghệ cuối tuần',
    priceRange: { min: 300 * k, max: 700 * k, unit: 'ngày' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['ops'],
    steps: ['Kiểm tra xe + giấy tờ', 'Chọn khung giờ cao điểm', 'Chạy', 'Ghi thu sau khi trừ xăng & phí app'] },
  { id: 'weekend-sitting', themeId: 'weekend', emoji: '🐶', name: 'Trông trẻ / trông nhà / chăm thú cưng hộ',
    priceRange: { min: 150 * k, max: 400 * k, unit: 'ngày' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['counsel'],
    steps: ['Chốt việc cụ thể + giờ', 'Lưu số người nhà', 'Làm', 'Gửi ảnh cập nhật', 'Nhận tiền'] },
  { id: 'weekend-cleaning', themeId: 'weekend', emoji: '🧹', name: 'Dọn nhà theo giờ',
    priceRange: { min: 80 * k, max: 120 * k, unit: 'giờ' }, typicalDays: 1, incomeCategory: 'freelance', skills: ['ops'],
    steps: ['Chốt số giờ + việc', 'Mang dụng cụ cần', 'Làm', 'Khách kiểm', 'Nhận tiền'] },
  { id: 'weekend-sampling', themeId: 'weekend', emoji: '🛒', name: 'PG/PB, phát mẫu thử ở siêu thị',
    priceRange: { min: 250 * k, max: 500 * k, unit: 'ca' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['sales'],
    steps: ['Ứng tuyển qua nhóm việc', 'Học thông tin sản phẩm', 'Làm ca', 'Nhận tiền'] },
  { id: 'weekend-kitchen-help', themeId: 'weekend', emoji: '🍳', name: 'Phụ bếp / phụ quán',
    priceRange: { min: 200 * k, max: 350 * k, unit: 'ca' }, typicalDays: 2, incomeCategory: 'freelance', skills: ['ops', 'handcraft'],
    steps: ['Hỏi quán quen gần nhà', 'Chốt ca', 'Làm', 'Nhận tiền'] },

  // ── 🔑 Tài sản nhàn rỗi ──
  { id: 'idle-room-rent', themeId: 'idle-assets', emoji: '🛏️', name: 'Cho thuê phòng trống / ở ghép',
    priceRange: { min: 1.5 * tr, max: 4 * tr, unit: 'tháng' }, typicalDays: 14, incomeCategory: 'other-in', skills: [],
    steps: ['Dọn & chụp phòng', 'Đăng tin có giá rõ', 'Hợp đồng ngắn + cọc', 'Khai báo tạm trú', 'Thu tiền tháng đầu'] },
  { id: 'idle-gear-rent', themeId: 'idle-assets', emoji: '📷', name: 'Cho thuê đồ ít dùng (máy ảnh, lều, váy dạ hội)',
    priceRange: { min: 100 * k, max: 500 * k, unit: 'lượt' }, typicalDays: 3, incomeCategory: 'other-in', skills: [],
    steps: ['Chụp ảnh + ghi tình trạng', 'Đặt tiền cọc', 'Biên bản giao/nhận', 'Kiểm đồ khi trả', 'Nhận tiền'] },
  { id: 'idle-parking-space', themeId: 'idle-assets', emoji: '🏍️', name: 'Cho thuê chỗ để xe / kho nhỏ',
    priceRange: { min: 200 * k, max: 600 * k, unit: 'tháng' }, typicalDays: 7, incomeCategory: 'other-in', skills: [],
    steps: ['Đo chỗ', 'Hỏi hàng xóm/khu trọ gần', 'Thoả thuận giờ ra vào', 'Thu tiền tháng'] },
  { id: 'idle-digital-templates', themeId: 'idle-assets', emoji: '🗂️', name: 'Bán file mẫu làm một lần bán nhiều lần (Canva, Excel)',
    priceRange: { min: 50 * k, max: 1 * tr, unit: 'tháng' }, typicalDays: 14, incomeCategory: 'business', skills: ['design', 'finance', 'ops'],
    steps: ['Làm 1 mẫu thật tốt', 'Đăng lên 1 kênh bán', 'Viết hướng dẫn dùng', 'Đơn đầu tiên'] },
  { id: 'idle-stock-photos', themeId: 'idle-assets', emoji: '🌄', name: 'Bán ảnh/video tự chụp lên kho ảnh',
    priceRange: { min: 50 * k, max: 500 * k, unit: 'tháng' }, typicalDays: 14, incomeCategory: 'other-in', skills: ['design', 'video'],
    steps: ['Chọn 20 ảnh đẹp nhất', 'Đăng ký 1 kho ảnh', 'Gắn từ khoá', 'Theo dõi lượt bán'] },
];

const TEMPLATE_BY_ID = new Map(EARNING_TEMPLATES.map((t) => [t.id, t]));

export function getEarningTemplate(id: string): EarningTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

/** Tiền kỳ vọng điền sẵn = giữa khung giá, làm tròn nghìn. */
export function suggestedAmount(tpl: EarningTemplate): number {
  return Math.round((tpl.priceRange.min + tpl.priceRange.max) / 2 / 1_000) * 1_000;
}

function overlap(a: string[], b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

/** Xếp chủ đề theo kỹ năng La bàn năng lực. Không có kỹ năng → thứ tự mặc định.
 * Ổn định: cùng điểm giữ thứ tự gốc. `matched` = các chủ đề có ít nhất 1 kỹ năng trùng. */
export function rankThemesBySkills(skills: string[]): { themes: EarningTheme[]; matched: Set<EarningThemeId> } {
  const set = new Set(skills);
  const scored = EARNING_THEMES.map((t, i) => ({ t, i, score: overlap(t.skills, set) }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return {
    themes: scored.map((s) => s.t),
    matched: new Set(scored.filter((s) => s.score > 0).map((s) => s.t.id)),
  };
}

/** Mẫu trong một chủ đề, mẫu trùng nhiều kỹ năng lên trước (ổn định). */
export function templatesForTheme(themeId: EarningThemeId, skills: string[] = []): EarningTemplate[] {
  const set = new Set(skills);
  return EARNING_TEMPLATES
    .map((t, i) => ({ t, i, score: overlap(t.skills, set) }))
    .filter((x) => x.t.themeId === themeId)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.t);
}

/** Dữ liệu điền sẵn cho form tạo nhiệm vụ từ mẫu. `today` truyền vào để test được. */
export function taskDraftFromTemplate(tpl: EarningTemplate, today: Date = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(1, tpl.typicalDays));
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    name: tpl.name,
    expectedAmount: suggestedAmount(tpl),
    startDate: iso(start),
    endDate: iso(end),
    templateId: tpl.id,
    subTasks: tpl.steps.map((name) => ({ name })),
  };
}
