/* ═══ Reward Catalog — Bộ sưu tập cosmetic & utility unlock ═══
 *
 * Đây là single source of truth cho mọi vật phẩm có thể unlock.
 * Mỗi item có: id, type, rarity, source (cách lấy), preview metadata.
 *
 * Khi user hoàn thành mission/quest/badge → thêm id vào useRewardStore.
 *
 * Lưu ý: 12 con giáp có 2 trạng thái:
 *   - Mệnh chủ (zodiac của user theo yearOfBirth): mặc định unlocked
 *   - 11 con còn lại: unlock dần qua hành vi
 */

export type RewardType =
  | 'zodiac'         // 12 con giáp chạy header
  | 'theme'          // Theme nền app
  | 'avatar_emoji'   // Avatar emoji hiếm (ngoài 20 default)
  | 'butler_outfit'  // Bộ trang phục butler
  | 'sound_pack'     // Sound effect ghi tiền
  | 'effect_input'   // Hiệu ứng nút "Ghi tiền"
  | 'frame'          // Khung viền profile
  | 'title'          // Title sau tên
  | 'elearning';     // Cross-product: video/ebook trong app eLearning tương lai

export type Rarity = 'thuong' | 'hiem' | 'suThi' | 'huyenThoai';

export interface RewardItem {
  id: string;
  type: RewardType;
  name: string;
  description: string;
  icon: string;            // emoji preview
  rarity: Rarity;
  source: string;          // human-readable cách lấy
  payload?: Record<string, unknown>; // dữ liệu riêng (e.g. chiIndex cho zodiac, color cho theme)
}

export const RARITY_META: Record<Rarity, { label: string; color: string; glow: string }> = {
  thuong:     { label: 'Thường',      color: '#9CA3AF', glow: 'rgba(156, 163, 175, 0.3)' },
  hiem:       { label: 'Hiếm',        color: '#0EA5E9', glow: 'rgba(14, 165, 233, 0.4)' },
  suThi:      { label: 'Sử Thi',      color: '#7C3AED', glow: 'rgba(124, 58, 237, 0.5)' },
  huyenThoai: { label: 'Huyền Thoại', color: '#F97316', glow: 'rgba(249, 115, 22, 0.6)' },
};

/** Toàn bộ catalog. Thêm/sửa ở đây — store chỉ tracking id đã unlock. */
export const REWARD_CATALOG: RewardItem[] = [
  // ── 12 Con Giáp chạy header ──────────────────────────────────────
  { id: 'zodiac-ty',    type: 'zodiac', name: 'Tý — Chuột Vàng',     description: 'Linh hoạt, nhanh nhẹn, tích lũy giỏi',           icon: '🐭', rarity: 'thuong', source: 'Mệnh chủ hoặc Onboarding ngày 7', payload: { chiIndex: 0 } },
  { id: 'zodiac-suu',   type: 'zodiac', name: 'Sửu — Trâu Cần Cù',   description: 'Bền bỉ, làm việc chăm chỉ',                       icon: '🐂', rarity: 'thuong', source: 'Streak 14 ngày', payload: { chiIndex: 1 } },
  { id: 'zodiac-dan',   type: 'zodiac', name: 'Dần — Hổ Dũng Mãnh',  description: 'Quyết đoán, không sợ thử thách tài chính',        icon: '🐅', rarity: 'hiem',   source: 'Hoàn thành 10 nhiệm vụ kiếm tiền', payload: { chiIndex: 2 } },
  { id: 'zodiac-mao',   type: 'zodiac', name: 'Mão — Mèo Tinh Khôn', description: 'Thận trọng, tính toán chi li',                    icon: '🐰', rarity: 'thuong', source: 'Kiềm chế chi tiêu 20 lần', payload: { chiIndex: 3 } },
  { id: 'zodiac-thin',  type: 'zodiac', name: 'Thìn — Rồng Phú Quý', description: 'Linh vật tài lộc số 1 trong văn hóa Việt',        icon: '🐲', rarity: 'huyenThoai', source: 'Đạt rank Diamond', payload: { chiIndex: 4 } },
  { id: 'zodiac-ty2',   type: 'zodiac', name: 'Tỵ — Rắn Khôn',       description: 'Thông tuệ, nhìn xa trông rộng',                   icon: '🐍', rarity: 'hiem',   source: 'Hoàn thành 3 mục tiêu lớn', payload: { chiIndex: 5 } },
  { id: 'zodiac-ngo',   type: 'zodiac', name: 'Ngọ — Ngựa Phi Nhanh',description: 'Tốc độ kiếm tiền, dòng tiền chảy mạnh',           icon: '🐴', rarity: 'hiem',   source: 'Đạt thu nhập 3 tháng liên tiếp tăng', payload: { chiIndex: 6 } },
  { id: 'zodiac-mui',   type: 'zodiac', name: 'Mùi — Dê Hiền Hậu',   description: 'Ổn định, biết đủ',                                icon: '🐐', rarity: 'thuong', source: 'Streak 30 ngày', payload: { chiIndex: 7 } },
  { id: 'zodiac-than',  type: 'zodiac', name: 'Thân — Khỉ Sáng Tạo', description: 'Đa nguồn thu, linh hoạt kinh doanh',              icon: '🐵', rarity: 'hiem',   source: 'Có 4+ nguồn thu trong tháng', payload: { chiIndex: 8 } },
  { id: 'zodiac-dau',   type: 'zodiac', name: 'Dậu — Gà Chăm Chỉ',   description: 'Dậy sớm, kỷ luật ghi chép',                       icon: '🐔', rarity: 'thuong', source: 'Ghi chép 60 ngày liên tiếp', payload: { chiIndex: 9 } },
  { id: 'zodiac-tuat',  type: 'zodiac', name: 'Tuất — Chó Trung Thành',description: 'Bảo vệ tài sản, giữ gìn quỹ dự phòng',           icon: '🐶', rarity: 'thuong', source: 'Quỹ dự phòng đạt 3 tháng lương', payload: { chiIndex: 10 } },
  { id: 'zodiac-hoi',   type: 'zodiac', name: 'Hợi — Heo Đầy Đặn',   description: 'Tiết kiệm sung túc, biểu tượng phú quý',          icon: '🐷', rarity: 'suThi',  source: 'Tiết kiệm tích lũy 50tr', payload: { chiIndex: 11 } },

  // ── Theme nền app ────────────────────────────────────────────────
  { id: 'theme-default',     type: 'theme', name: 'Tím Hoàng Hôn',    description: 'Theme mặc định',                          icon: '🌆', rarity: 'thuong',     source: 'Sẵn có', payload: { color: '#7C3AED' } },
  { id: 'theme-tet-2026',    type: 'theme', name: 'Tết Bính Ngọ',     description: 'Đỏ vàng pháo Tết — limited 2026',         icon: '🧧', rarity: 'huyenThoai', source: 'Seasonal Tết 2026',     payload: { color: '#DC2626' } },
  { id: 'theme-luxury',      type: 'theme', name: 'Hoàng Kim',        description: 'Đen vàng cao cấp',                        icon: '✨', rarity: 'suThi',      source: 'Đạt rank Gold',          payload: { color: '#EAB308' } },
  { id: 'theme-emerald',     type: 'theme', name: 'Ngọc Lục',         description: 'Xanh lá đậm thanh lịch',                  icon: '💚', rarity: 'suThi',      source: 'Hoàn thành 10 mục tiêu', payload: { color: '#059669' } },
  { id: 'theme-banmenh',     type: 'theme', name: 'Theo Bản Mệnh',    description: 'Tự động đổi màu hợp ngũ hành của bạn',    icon: '☯️', rarity: 'hiem',       source: 'Nhập năm sinh trong hồ sơ' },

  // ── Effect khi nhập tiền ─────────────────────────────────────────
  { id: 'effect-sparkle',    type: 'effect_input', name: 'Lấp Lánh',     description: 'Hiệu ứng sao sáng khi ghi income',     icon: '✨', rarity: 'hiem',  source: 'Streak 14 ngày' },
  { id: 'effect-coinrain',   type: 'effect_input', name: 'Mưa Tiền',     description: 'Tiền xu rơi xuống khi ghi income',      icon: '🪙', rarity: 'suThi', source: 'Income tháng vượt 20tr' },
  { id: 'effect-firework',   type: 'effect_input', name: 'Pháo Hoa',     description: 'Pháo bùng khi ghi income lớn',          icon: '🎆', rarity: 'huyenThoai', source: 'Đạt rank Platinum' },

  // ── Sound pack ───────────────────────────────────────────────────
  { id: 'sound-coin',        type: 'sound_pack', name: 'Tiền Xu Cling',  description: 'Tiếng tiền xu khi ghi income',          icon: '🔔', rarity: 'thuong', source: 'Onboarding ngày 5' },
  { id: 'sound-kaching',     type: 'sound_pack', name: 'Máy Đếm Tiền',   description: 'Ka-ching máy đếm tiền',                 icon: '💵', rarity: 'hiem',   source: 'Hoàn thành 5 weekly challenge' },
  { id: 'sound-tet',         type: 'sound_pack', name: 'Pháo Tết',       description: 'Tiếng pháo Tết — limited 2026',         icon: '🧨', rarity: 'suThi',  source: 'Seasonal Tết 2026' },

  // ── Title (hiển thị sau tên) ─────────────────────────────────────
  { id: 'title-newbie',      type: 'title', name: 'Tân Binh',        description: 'Mới bắt đầu hành trình',                  icon: '🌱', rarity: 'thuong', source: 'Hoàn thành tân thủ' },
  { id: 'title-saver',       type: 'title', name: 'Thợ Săn Tiết Kiệm',description:'Kiềm chế chi tiêu 50 lần',                 icon: '🛡️', rarity: 'hiem',   source: 'Resist 50 lần' },
  { id: 'title-tycoon',      type: 'title', name: 'Ông Trùm Tài Chính',description: 'Đạt 14/15 badge Lv5',                    icon: '👑', rarity: 'huyenThoai', source: 'Meta badge Lv5' },

  // ── Khung viền profile ───────────────────────────────────────────
  { id: 'frame-gold',        type: 'frame', name: 'Khung Vàng',       description: 'Viền vàng quanh avatar',                  icon: '🟡', rarity: 'suThi',  source: 'Đạt rank Gold' },
  { id: 'frame-diamond',     type: 'frame', name: 'Khung Kim Cương',  description: 'Viền lấp lánh kim cương',                 icon: '💎', rarity: 'huyenThoai', source: 'Đạt rank Diamond' },

  // ── Butler outfit ────────────────────────────────────────────────
  { id: 'butler-default',    type: 'butler_outfit', name: 'Quản Gia Mặc Định', description: 'Phong cách lịch sự cơ bản',     icon: '🤵', rarity: 'thuong', source: 'Sẵn có' },
  { id: 'butler-tet',        type: 'butler_outfit', name: 'Quản Gia Áo Dài',   description: 'Áo dài đỏ ngày Tết',            icon: '🎎', rarity: 'suThi',  source: 'Seasonal Tết 2026' },

  // ── eLearning content (placeholder — link đến app tương lai) ─────
  { id: 'elearning-tamthuc-1',  type: 'elearning', name: 'Bí mật thịnh vượng P1', description: 'Video 15p — Tần số tiền bạc',         icon: '🎥', rarity: 'hiem',       source: 'Streak 30 ngày' },
  { id: 'elearning-vitien',     type: 'elearning', name: 'Phong thủy ví tiền',    description: 'Video 10p — 5 điều đại kỵ với ví',     icon: '👛', rarity: 'hiem',       source: 'Đạt rank Bronze' },
  { id: 'elearning-banlam',     type: 'elearning', name: 'Phong thủy bàn làm việc',description:'Khóa 7 video — Bố trí tài lộc',         icon: '🪑', rarity: 'suThi',      source: 'Đạt rank Gold' },
  { id: 'elearning-tet2026',    type: 'elearning', name: 'Kích tài lộc 2026',     description: 'Khóa Tết Bính Ngọ — limited',          icon: '🐎', rarity: 'huyenThoai', source: 'Seasonal Tết 2026' },
  { id: 'elearning-thieuduc',   type: 'elearning', name: 'Triết lý thiểu dục',    description: 'Ebook — Khóa miệng ví, mở ví trời',    icon: '📖', rarity: 'suThi',      source: 'Resist 100 lần' },
  { id: 'elearning-manifest',   type: 'elearning', name: 'Manifest 1 tỷ',         description: 'Khóa độc quyền — Tâm linh + chiến lược',icon: '🌟', rarity: 'huyenThoai', source: 'Đạt rank Diamond' },
];

/** Helper: lấy item theo id. */
export function getRewardById(id: string): RewardItem | undefined {
  return REWARD_CATALOG.find((r) => r.id === id);
}

/** Helper: lấy tất cả zodiac items. */
export function getAllZodiacItems(): RewardItem[] {
  return REWARD_CATALOG.filter((r) => r.type === 'zodiac');
}

/** Helper: lấy zodiac item theo chiIndex. */
export function getZodiacByChiIndex(chiIndex: number): RewardItem | undefined {
  return REWARD_CATALOG.find(
    (r) => r.type === 'zodiac' && r.payload?.chiIndex === chiIndex
  );
}
