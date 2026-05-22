/* ═══ Bát Tự (Four Pillars of Destiny) — Tính lá số 4 trụ ═══
 *
 * 4 trụ — mỗi trụ là 1 cặp Can-Chi:
 *   - Trụ Năm   (depends on year)
 *   - Trụ Tháng (depends on month + year's stem)
 *   - Trụ Ngày  (depends on full date, 60-day cycle)
 *   - Trụ Giờ   (depends on hour + day's stem) — optional, cần giờ sinh
 *
 * Mỗi trụ có Can (Thiên Can), Chi (Địa Chi), và Nạp Âm Ngũ Hành.
 *
 * Reference: 1900-01-31 = ngày Giáp Tý (widely used anchor).
 * Lưu ý: dùng dương lịch để đơn giản. Phong thủy chuẩn nên dùng giờ
 * tiết khí (节气) làm ranh giới tháng, nhưng app này dùng tháng dương
 * lịch — đủ cho hiển thị phổ thông.
 */

import type { Menh } from '@/lib/banMenh';

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

/** Bảng 60 nạp âm — mỗi entry là 1 cặp 2 năm/ngày liên tiếp cùng nạp âm. */
const NAP_AM: Array<{ menh: Menh; detail: string }> = [
  { menh: 'Kim', detail: 'Hải Trung Kim' },
  { menh: 'Hỏa', detail: 'Lư Trung Hỏa' },
  { menh: 'Mộc', detail: 'Đại Lâm Mộc' },
  { menh: 'Thổ', detail: 'Lộ Bàng Thổ' },
  { menh: 'Kim', detail: 'Kiếm Phong Kim' },
  { menh: 'Hỏa', detail: 'Sơn Đầu Hỏa' },
  { menh: 'Thủy', detail: 'Giản Hạ Thủy' },
  { menh: 'Thổ', detail: 'Thành Đầu Thổ' },
  { menh: 'Kim', detail: 'Bạch Lạp Kim' },
  { menh: 'Mộc', detail: 'Dương Liễu Mộc' },
  { menh: 'Thủy', detail: 'Tuyền Trung Thủy' },
  { menh: 'Thổ', detail: 'Ốc Thượng Thổ' },
  { menh: 'Hỏa', detail: 'Tích Lịch Hỏa' },
  { menh: 'Mộc', detail: 'Tùng Bách Mộc' },
  { menh: 'Thủy', detail: 'Trường Lưu Thủy' },
  { menh: 'Kim', detail: 'Sa Trung Kim' },
  { menh: 'Hỏa', detail: 'Sơn Hạ Hỏa' },
  { menh: 'Mộc', detail: 'Bình Địa Mộc' },
  { menh: 'Thổ', detail: 'Bích Thượng Thổ' },
  { menh: 'Kim', detail: 'Kim Bạch Kim' },
  { menh: 'Hỏa', detail: 'Phú Đăng Hỏa' },
  { menh: 'Thủy', detail: 'Thiên Hà Thủy' },
  { menh: 'Thổ', detail: 'Đại Trạch Thổ' },
  { menh: 'Kim', detail: 'Thoa Xuyến Kim' },
  { menh: 'Mộc', detail: 'Tang Đố Mộc' },
  { menh: 'Thủy', detail: 'Đại Khê Thủy' },
  { menh: 'Thổ', detail: 'Sa Trung Thổ' },
  { menh: 'Hỏa', detail: 'Thiên Thượng Hỏa' },
  { menh: 'Mộc', detail: 'Thạch Lựu Mộc' },
  { menh: 'Thủy', detail: 'Đại Hải Thủy' },
];

const PILLAR_LABELS = {
  year: { label: 'Trụ Năm', desc: 'Tổ tiên, gốc rễ' },
  month: { label: 'Trụ Tháng', desc: 'Cha mẹ, môi trường' },
  day: { label: 'Trụ Ngày', desc: 'Bản thân, vợ/chồng' },
  hour: { label: 'Trụ Giờ', desc: 'Con cháu, hậu vận' },
} as const;

export type PillarType = keyof typeof PILLAR_LABELS;

export interface Pillar {
  type: PillarType;
  label: string;
  desc: string;
  can: string;
  chi: string;
  canIndex: number;
  chiIndex: number;
  fullName: string;       // "Giáp Tý"
  menh: Menh;             // Kim/Mộc/Thủy/Hỏa/Thổ
  menhDetail: string;     // "Hải Trung Kim"
}

export interface BatTu {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;    // null nếu thiếu giờ sinh
  /** Mệnh chính = nạp âm của Trụ Năm (theo phong thủy phổ thông). */
  primaryMenh: Menh;
}

/** Mod luôn dương. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Build Pillar từ canIndex (0-9) + chiIndex (0-11). */
function buildPillar(type: PillarType, canIdx: number, chiIdx: number): Pillar {
  // Tìm 60-cycle index từ (can, chi) — chỉ tồn tại khi can%2 === chi%2
  // (ví dụ Giáp[0] chỉ ghép với Chi index chẵn: Tý, Dần, Thìn, Ngọ, Thân, Tuất)
  let cycleIdx = -1;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === canIdx && i % 12 === chiIdx) {
      cycleIdx = i;
      break;
    }
  }
  // Fallback nếu tổ hợp không hợp lệ (không bao giờ xảy ra với tính đúng)
  if (cycleIdx < 0) cycleIdx = 0;

  const napAmIdx = Math.floor(cycleIdx / 2);
  const napAm = NAP_AM[napAmIdx];
  const meta = PILLAR_LABELS[type];

  return {
    type,
    label: meta.label,
    desc: meta.desc,
    can: CAN[canIdx],
    chi: CHI[chiIdx],
    canIndex: canIdx,
    chiIndex: chiIdx,
    fullName: `${CAN[canIdx]} ${CHI[chiIdx]}`,
    menh: napAm.menh,
    menhDetail: napAm.detail,
  };
}

/** Trụ Năm — dùng năm dương lịch (anchor 1984 = Giáp Tý). */
function getYearPillar(year: number): Pillar {
  const offset = year - 1984;
  return buildPillar('year', mod(offset, 10), mod(offset, 12));
}

/**
 * Trụ Tháng — Chi tháng cố định (T1=Dần, T2=Mão, …), Can theo Ngũ Hổ Độn:
 *   Giáp/Kỷ năm → Bính Dần (T1)
 *   Ất/Canh năm → Mậu Dần
 *   Bính/Tân năm → Canh Dần
 *   Đinh/Nhâm năm → Nhâm Dần
 *   Mậu/Quý năm → Giáp Dần
 */
function getMonthPillar(year: number, month: number): Pillar {
  const yearCan = mod(year - 1984, 10);
  // Can tháng 1 (Dần) tương ứng từng nhóm năm
  const monthStartCanByYearGroup = [
    2, // Giáp(0)/Kỷ(5) → Bính
    4, // Ất(1)/Canh(6) → Mậu
    6, // Bính(2)/Tân(7) → Canh
    8, // Đinh(3)/Nhâm(8) → Nhâm
    0, // Mậu(4)/Quý(9) → Giáp
  ];
  const groupIdx = yearCan % 5;
  const startCan = monthStartCanByYearGroup[groupIdx];
  // Tháng 1 = Dần (chi index 2), tháng 12 = Sửu (chi index 1)
  const chiIdx = mod(month + 1, 12); // T1→2 (Dần), T2→3 (Mão), …, T11→0 (Tý), T12→1 (Sửu)
  // Can tăng theo từng tháng, bắt đầu từ startCan tại tháng 1
  const canIdx = mod(startCan + (month - 1), 10);
  return buildPillar('month', canIdx, chiIdx);
}

/** Trụ Ngày — 60-day cycle, anchor 1900-01-31 = Giáp Tý. */
function getDayPillar(date: Date): Pillar {
  const anchor = Date.UTC(1900, 0, 31); // 1900-01-31
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((target - anchor) / 86_400_000);
  const cycleIdx = mod(days, 60);
  const canIdx = cycleIdx % 10;
  const chiIdx = cycleIdx % 12;
  return buildPillar('day', canIdx, chiIdx);
}

/**
 * Trụ Giờ — Chi giờ theo 12 khung 2h:
 *   23-01: Tý, 01-03: Sửu, 03-05: Dần, …, 21-23: Hợi
 *
 * Can giờ theo Ngũ Thử Độn (dựa vào Can ngày):
 *   Giáp/Kỷ ngày → Giáp Tý (giờ Tý đầu)
 *   Ất/Canh ngày → Bính Tý
 *   Bính/Tân ngày → Mậu Tý
 *   Đinh/Nhâm ngày → Canh Tý
 *   Mậu/Quý ngày → Nhâm Tý
 */
function getHourPillar(hourOfDay: number, dayCanIdx: number): Pillar {
  // Chi giờ: hour 23-0 → Tý (chi 0). hour 1-2 → Sửu (chi 1). ...
  // Công thức: chi = floor((hour + 1) / 2) % 12
  const chiIdx = Math.floor((hourOfDay + 1) / 2) % 12;
  // Can giờ Tý đầu mỗi ngày
  const hourStartCanByDayGroup = [
    0, // Giáp/Kỷ → Giáp
    2, // Ất/Canh → Bính
    4, // Bính/Tân → Mậu
    6, // Đinh/Nhâm → Canh
    8, // Mậu/Quý → Nhâm
  ];
  const groupIdx = dayCanIdx % 5;
  const startCan = hourStartCanByDayGroup[groupIdx];
  const canIdx = mod(startCan + chiIdx, 10);
  return buildPillar('hour', canIdx, chiIdx);
}

/**
 * Tính Bát Tự đầy đủ từ ngày sinh + giờ sinh (optional).
 * `birthDate` format YYYY-MM-DD. `birthTime` format HH:mm.
 */
export function calcBatTu(birthDate?: string, birthTime?: string): BatTu | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [yStr, mStr, dStr] = birthDate.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (!y || !m || !d) return null;
  if (y < 1900 || y > 2100) return null;

  const date = new Date(y, m - 1, d);
  const yearP = getYearPillar(y);
  const monthP = getMonthPillar(y, m);
  const dayP = getDayPillar(date);

  let hourP: Pillar | null = null;
  if (birthTime && /^\d{2}:\d{2}$/.test(birthTime)) {
    const h = parseInt(birthTime.slice(0, 2), 10);
    if (h >= 0 && h <= 23) {
      hourP = getHourPillar(h, dayP.canIndex);
    }
  }

  return {
    year: yearP,
    month: monthP,
    day: dayP,
    hour: hourP,
    primaryMenh: yearP.menh,
  };
}

/** Helper: short description cho mỗi mệnh — phục vụ UI hint. */
export const MENH_DESC: Record<Menh, { color: string; emoji: string; trait: string }> = {
  Kim:  { color: '#E5E7EB', emoji: '⚪', trait: 'Sắc bén, kiên cường, kỷ luật' },
  Mộc:  { color: '#22C55E', emoji: '🌳', trait: 'Linh hoạt, phát triển, sáng tạo' },
  Thủy: { color: '#0EA5E9', emoji: '🌊', trait: 'Thông minh, mềm dẻo, thích nghi' },
  Hỏa:  { color: '#F97316', emoji: '🔥', trait: 'Đam mê, năng động, lãnh đạo' },
  Thổ:  { color: '#A16207', emoji: '🌾', trait: 'Vững chãi, trung thành, ổn định' },
};
