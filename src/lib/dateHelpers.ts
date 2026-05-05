// Canonical Date Helpers for ManiCash
// Uses UTC parsing consistently to avoid timezone drift and race conditions.

export function getMonthKeyFromDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthKey(): string {
  return getMonthKeyFromDate(new Date());
}

export function getDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getDateLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const txnDayUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  
  const diff = (todayUTC - txnDayUTC) / (1000 * 60 * 60 * 24);

  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-');
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
}

export function isSameMonth(a: Date | string, b: Date | string): boolean {
  return getMonthKeyFromDate(a) === getMonthKeyFromDate(b);
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  const utc1 = Date.UTC(da.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate());
  const utc2 = Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), db.getUTCDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

export function isInCurrentWeek(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  
  // getUTCDay() returns 0 (Sunday) to 6 (Saturday). We want Monday to be 0
  const dayOfWeek = now.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStartUTC = todayUTC - (mondayOffset * 24 * 60 * 60 * 1000);
  const weekEndUTC = weekStartUTC + (7 * 24 * 60 * 60 * 1000);
  
  const txnUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  
  return txnUTC >= weekStartUTC && txnUTC < weekEndUTC;
}
