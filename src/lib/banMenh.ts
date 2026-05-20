/* ═══ Bản Mệnh — Phong thủy lookup từ yearOfBirth ═══
 *
 * Tính:
 *   - Thiên Can (10): Giáp Ất Bính Đinh Mậu Kỷ Canh Tân Nhâm Quý
 *   - Địa Chi (12): Tý Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi
 *   - Nạp Âm ngũ hành (5): Kim / Mộc / Thủy / Hỏa / Thổ
 *   - Màu hợp mệnh + ngũ hành tương sinh
 *
 * Reference: 1984 = Giáp Tý (mốc khởi đầu chu kỳ 60 hoa giáp gần nhất).
 * Công thức: offset = year - 1984, can = offset % 10, chi = offset % 12,
 * nạp âm = Math.floor((offset % 60 + 60) % 60 / 2).
 *
 * Lưu ý: dùng năm dương lịch để đơn giản. Nếu user sinh tháng 1 trước Tết
 * thì sai 1 năm — chấp nhận được với phong thủy phổ thông.
 */

export type Menh = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ';

export interface BanMenh {
  can: string;           // "Giáp"
  chi: string;           // "Tý"
  chiIcon: string;       // "🐭"
  chiIndex: number;      // 0-11
  fullName: string;      // "Giáp Tý"
  menh: Menh;            // "Kim"
  menhDetail: string;    // "Hải Trung Kim"
  favorableColors: string[];        // hex codes
  favorableElements: Menh[];        // tương sinh
  unfavorableElements: Menh[];      // tương khắc
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];

const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

const CHI_ICONS = ['🐭', '🐂', '🐅', '🐰', '🐲', '🐍', '🐴', '🐐', '🐵', '🐔', '🐶', '🐷'];

/** Bảng nạp âm 30 cặp — mỗi cặp 2 năm liên tiếp cùng nạp âm. */
const NAP_AM: Array<{ menh: Menh; detail: string }> = [
  { menh: 'Kim', detail: 'Hải Trung Kim' },     // 0: Giáp Tý, Ất Sửu
  { menh: 'Hỏa', detail: 'Lư Trung Hỏa' },      // 1: Bính Dần, Đinh Mão
  { menh: 'Mộc', detail: 'Đại Lâm Mộc' },       // 2: Mậu Thìn, Kỷ Tỵ
  { menh: 'Thổ', detail: 'Lộ Bàng Thổ' },       // 3: Canh Ngọ, Tân Mùi
  { menh: 'Kim', detail: 'Kiếm Phong Kim' },    // 4: Nhâm Thân, Quý Dậu
  { menh: 'Hỏa', detail: 'Sơn Đầu Hỏa' },       // 5: Giáp Tuất, Ất Hợi
  { menh: 'Thủy', detail: 'Giản Hạ Thủy' },     // 6: Bính Tý, Đinh Sửu
  { menh: 'Thổ', detail: 'Thành Đầu Thổ' },     // 7: Mậu Dần, Kỷ Mão
  { menh: 'Kim', detail: 'Bạch Lạp Kim' },      // 8: Canh Thìn, Tân Tỵ
  { menh: 'Mộc', detail: 'Dương Liễu Mộc' },    // 9: Nhâm Ngọ, Quý Mùi
  { menh: 'Thủy', detail: 'Tuyền Trung Thủy' }, // 10: Giáp Thân, Ất Dậu
  { menh: 'Thổ', detail: 'Ốc Thượng Thổ' },     // 11: Bính Tuất, Đinh Hợi
  { menh: 'Hỏa', detail: 'Tích Lịch Hỏa' },     // 12: Mậu Tý, Kỷ Sửu
  { menh: 'Mộc', detail: 'Tùng Bách Mộc' },     // 13: Canh Dần, Tân Mão
  { menh: 'Thủy', detail: 'Trường Lưu Thủy' },  // 14: Nhâm Thìn, Quý Tỵ
  { menh: 'Kim', detail: 'Sa Trung Kim' },      // 15: Giáp Ngọ, Ất Mùi
  { menh: 'Hỏa', detail: 'Sơn Hạ Hỏa' },        // 16: Bính Thân, Đinh Dậu
  { menh: 'Mộc', detail: 'Bình Địa Mộc' },      // 17: Mậu Tuất, Kỷ Hợi
  { menh: 'Thổ', detail: 'Bích Thượng Thổ' },   // 18: Canh Tý, Tân Sửu
  { menh: 'Kim', detail: 'Kim Bạch Kim' },      // 19: Nhâm Dần, Quý Mão
  { menh: 'Hỏa', detail: 'Phú Đăng Hỏa' },      // 20: Giáp Thìn, Ất Tỵ
  { menh: 'Thủy', detail: 'Thiên Hà Thủy' },    // 21: Bính Ngọ, Đinh Mùi
  { menh: 'Thổ', detail: 'Đại Trạch Thổ' },     // 22: Mậu Thân, Kỷ Dậu
  { menh: 'Kim', detail: 'Thoa Xuyến Kim' },    // 23: Canh Tuất, Tân Hợi
  { menh: 'Mộc', detail: 'Tang Đố Mộc' },       // 24: Nhâm Tý, Quý Sửu
  { menh: 'Thủy', detail: 'Đại Khê Thủy' },     // 25: Giáp Dần, Ất Mão
  { menh: 'Thổ', detail: 'Sa Trung Thổ' },      // 26: Bính Thìn, Đinh Tỵ
  { menh: 'Hỏa', detail: 'Thiên Thượng Hỏa' },  // 27: Mậu Ngọ, Kỷ Mùi
  { menh: 'Mộc', detail: 'Thạch Lựu Mộc' },     // 28: Canh Thân, Tân Dậu
  { menh: 'Thủy', detail: 'Đại Hải Thủy' },     // 29: Nhâm Tuất, Quý Hợi
];

/** Màu sắc + tương sinh/khắc theo ngũ hành. */
const ELEMENT_PROPS: Record<Menh, { colors: string[]; sinh: Menh[]; khac: Menh[] }> = {
  Kim:  { colors: ['#E8E8EC', '#C9A961', '#F5F5F7'], sinh: ['Thổ', 'Kim'], khac: ['Hỏa', 'Mộc'] },
  Mộc:  { colors: ['#22C55E', '#0EA5E9', '#16A34A'], sinh: ['Thủy', 'Mộc'], khac: ['Kim', 'Thổ'] },
  Thủy: { colors: ['#0EA5E9', '#1E293B', '#0284C7'], sinh: ['Kim', 'Thủy'], khac: ['Thổ', 'Hỏa'] },
  Hỏa:  { colors: ['#EF4444', '#F97316', '#FACC15'], sinh: ['Mộc', 'Hỏa'], khac: ['Thủy', 'Kim'] },
  Thổ:  { colors: ['#A16207', '#EAB308', '#92400E'], sinh: ['Hỏa', 'Thổ'], khac: ['Mộc', 'Thủy'] },
};

/** Mod hỗ trợ năm < 1984 (số âm). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Tính bản mệnh đầy đủ từ năm sinh dương lịch.
 * Trả về null nếu year không hợp lệ.
 */
export function getBanMenh(yearOfBirth: number | undefined): BanMenh | null {
  if (!yearOfBirth || !Number.isInteger(yearOfBirth)) return null;
  if (yearOfBirth < 1900 || yearOfBirth > 2100) return null;

  const offset = yearOfBirth - 1984; // 1984 = Giáp Tý
  const canIdx = mod(offset, 10);
  const chiIdx = mod(offset, 12);
  const napAmIdx = Math.floor(mod(offset, 60) / 2);

  const napAm = NAP_AM[napAmIdx];
  const props = ELEMENT_PROPS[napAm.menh];

  return {
    can: CAN[canIdx],
    chi: CHI[chiIdx],
    chiIcon: CHI_ICONS[chiIdx],
    chiIndex: chiIdx,
    fullName: `${CAN[canIdx]} ${CHI[chiIdx]}`,
    menh: napAm.menh,
    menhDetail: napAm.detail,
    favorableColors: props.colors,
    favorableElements: props.sinh,
    unfavorableElements: props.khac,
  };
}

/** Tiện ích: chỉ lấy con giáp (cho zodiac runner khi user chưa nhập yearOfBirth). */
export function getChiByYear(year: number): { chi: string; icon: string; index: number } {
  const idx = mod(year - 1984, 12);
  return { chi: CHI[idx], icon: CHI_ICONS[idx], index: idx };
}

/** Lấy con giáp của năm hiện tại (để fallback). */
export function getCurrentYearChi() {
  return getChiByYear(new Date().getFullYear());
}

export const ALL_CHI = CHI.map((chi, i) => ({ chi, icon: CHI_ICONS[i], index: i }));
