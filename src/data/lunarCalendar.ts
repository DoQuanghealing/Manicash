/* ═══ Lunar Calendar — Key Vietnamese holidays 2025-2028 ═══
 *
 * Hardcode các ngày lễ âm lịch quan trọng (đỡ phụ thuộc lib bên ngoài).
 * Convert âm → dương đã tính sẵn cho 4 năm.
 *
 * Use: getUpcomingLunarHoliday(now) → { name, gregorianDate, lunarLabel }
 */

export interface LunarHoliday {
  /** ID ngắn để map vào event. */
  id: string;
  /** Tên hiển thị. */
  name: string;
  /** YYYY-MM-DD dương lịch. */
  gregorianDate: string;
  /** Label âm lịch human-readable. */
  lunarLabel: string;
  /** Emoji */
  icon: string;
}

export const LUNAR_HOLIDAYS: LunarHoliday[] = [
  // ═══ 2026 ═══
  { id: 'tet-2026',         name: 'Tết Bính Ngọ',     gregorianDate: '2026-02-17', lunarLabel: 'Mùng 1 Tết Bính Ngọ',           icon: '🐎' },
  { id: 'thuong-nguyen-2026', name: 'Rằm tháng Giêng', gregorianDate: '2026-03-03', lunarLabel: 'Rằm tháng Giêng',                icon: '🏮' },
  { id: 'gio-to-2026',      name: 'Giỗ Tổ Hùng Vương', gregorianDate: '2026-04-26', lunarLabel: 'Mùng 10 tháng 3',                icon: '⛩️' },
  { id: 'doan-ngo-2026',    name: 'Tết Đoan Ngọ',     gregorianDate: '2026-06-19', lunarLabel: 'Mùng 5 tháng 5',                 icon: '🌿' },
  { id: 'vu-lan-2026',      name: 'Vu Lan Báo Hiếu',  gregorianDate: '2026-08-28', lunarLabel: 'Rằm tháng 7',                    icon: '🪷' },
  { id: 'trung-thu-2026',   name: 'Tết Trung Thu',    gregorianDate: '2026-09-25', lunarLabel: 'Rằm tháng 8',                    icon: '🌕' },
  { id: 'trung-cuu-2026',   name: 'Tết Trùng Cửu',    gregorianDate: '2026-10-19', lunarLabel: 'Mùng 9 tháng 9',                 icon: '🍂' },

  // ═══ 2027 ═══
  { id: 'tet-2027',         name: 'Tết Đinh Mùi',     gregorianDate: '2027-02-06', lunarLabel: 'Mùng 1 Tết Đinh Mùi',            icon: '🐐' },
  { id: 'thuong-nguyen-2027', name: 'Rằm tháng Giêng', gregorianDate: '2027-02-21', lunarLabel: 'Rằm tháng Giêng',                icon: '🏮' },
  { id: 'gio-to-2027',      name: 'Giỗ Tổ Hùng Vương', gregorianDate: '2027-04-16', lunarLabel: 'Mùng 10 tháng 3',                icon: '⛩️' },
  { id: 'doan-ngo-2027',    name: 'Tết Đoan Ngọ',     gregorianDate: '2027-06-09', lunarLabel: 'Mùng 5 tháng 5',                 icon: '🌿' },
  { id: 'vu-lan-2027',      name: 'Vu Lan Báo Hiếu',  gregorianDate: '2027-08-17', lunarLabel: 'Rằm tháng 7',                    icon: '🪷' },
  { id: 'trung-thu-2027',   name: 'Tết Trung Thu',    gregorianDate: '2027-09-15', lunarLabel: 'Rằm tháng 8',                    icon: '🌕' },
];

/** Trả về holiday gần nhất sắp đến (trong vòng 90 ngày tới). */
export function getUpcomingLunarHoliday(now: Date = new Date()): LunarHoliday | null {
  const today = now.toISOString().slice(0, 10);
  const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcoming = LUNAR_HOLIDAYS.filter(
    (h) => h.gregorianDate >= today && h.gregorianDate <= next90
  );
  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => a.gregorianDate.localeCompare(b.gregorianDate));
  return upcoming[0];
}

/** Tính số ngày còn lại đến holiday. */
export function daysUntilHoliday(holiday: LunarHoliday, now: Date = new Date()): number {
  const today = new Date(now.toISOString().slice(0, 10));
  const target = new Date(holiday.gregorianDate);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Map id holiday → seasonal event id (nếu có liên kết). */
export const HOLIDAY_TO_EVENT: Record<string, string> = {
  'tet-2026': 'event-tet-2026',
  'trung-thu-2026': 'event-midautumn-2026',
};
