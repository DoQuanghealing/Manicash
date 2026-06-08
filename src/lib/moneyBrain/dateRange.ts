/* ═══ Money Brain — Date Range Helpers (Phase 0) ═══
 * PURE functions. Timezone-aware. KHÔNG dùng Date.now() / server timezone.
 * Mọi logic period nhận clientNow + timezone từ snapshot.
 */

export type MoneyPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'all';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Lấy {year, month, day} của 1 thời điểm theo timezone chỉ định. */
function partsInTimezone(
  input: string | Date,
  timezone: string,
): { year: number; month: number; day: number } {
  const d = typeof input === 'string' ? new Date(input) : input;
  // en-CA cho format YYYY-MM-DD ổn định.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
  };
}

/** YYYY-MM-DD theo timezone client. */
export function getDateKey(input: string | Date, timezone: string): string {
  const { year, month, day } = partsInTimezone(input, timezone);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** YYYY-MM theo timezone client. */
export function getMonthKey(input: string | Date, timezone: string): string {
  const { year, month } = partsInTimezone(input, timezone);
  return `${year}-${pad2(month)}`;
}

/** ISO-8601 week key (YYYY-Www), tuần bắt đầu thứ 2, năm theo thứ 5 của tuần. */
export function getISOWeekKey(input: string | Date, timezone: string): string {
  const { year, month, day } = partsInTimezone(input, timezone);
  // Làm việc trên UTC date-only để tính tuần ISO ổn định (không lệch tz).
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  // Dời tới thứ 5 cùng tuần.
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${pad2(week)}`;
}

/** Hôm nay (dateKey) theo clientNow + timezone. */
export function getTodayKey(clientNow: string, timezone: string): string {
  return getDateKey(clientNow, timezone);
}

/** Tháng hiện tại (monthKey) theo clientNow + timezone. */
export function getCurrentMonthKey(clientNow: string, timezone: string): string {
  return getMonthKey(clientNow, timezone);
}

/** Dịch 1 dateKey (YYYY-MM-DD) đi deltaDays ngày — số học lịch thuần. */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Dịch 1 monthKey (YYYY-MM) đi deltaMonths tháng. */
function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

interface PeriodTxn {
  dateKey?: string;
  monthKey?: string;
  weekKey?: string;
  date?: string;
}

/** Có thuộc period không — luôn dùng clientNow + timezone, không dùng giờ server. */
export function isTransactionInPeriod(
  tx: PeriodTxn,
  period: MoneyPeriod,
  context: { clientNow: string; timezone: string },
): boolean {
  if (period === 'all') return true;

  const { clientNow, timezone } = context;
  const txDateKey = tx.dateKey ?? (tx.date ? getDateKey(tx.date, timezone) : undefined);
  const txMonthKey =
    tx.monthKey ?? (txDateKey ? txDateKey.slice(0, 7) : tx.date ? getMonthKey(tx.date, timezone) : undefined);
  const txWeekKey = tx.weekKey ?? (tx.date ? getISOWeekKey(tx.date, timezone) : undefined);

  switch (period) {
    case 'today':
      return txDateKey === getTodayKey(clientNow, timezone);
    case 'yesterday':
      return txDateKey === shiftDateKey(getTodayKey(clientNow, timezone), -1);
    case 'this_week':
      return txWeekKey === getISOWeekKey(clientNow, timezone);
    case 'this_month':
      return txMonthKey === getCurrentMonthKey(clientNow, timezone);
    case 'last_month':
      return txMonthKey === shiftMonthKey(getCurrentMonthKey(clientNow, timezone), -1);
    default:
      return false;
  }
}

/** Fold dấu tiếng Việt để match keyword. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Phát hiện period từ câu tiếng Việt; mặc định this_month. */
export function detectPeriod(text: string): MoneyPeriod {
  const t = fold(text);
  if (/\bhom qua\b|\byesterday\b/.test(t)) return 'yesterday';
  if (/\bhom nay\b|\btoday\b/.test(t)) return 'today';
  if (/\btuan nay\b|\bthis week\b/.test(t)) return 'this_week';
  if (/\bthang truoc\b|\blast month\b/.test(t)) return 'last_month';
  if (/\bthang nay\b|\bthis month\b/.test(t)) return 'this_month';
  return 'this_month';
}
