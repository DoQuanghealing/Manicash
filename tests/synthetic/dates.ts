export const TEST_START_DATE_KEY = '2025-08-01';
export const TEST_END_DATE_KEY = '2025-10-29';
export const TOTAL_TEST_DAYS = 90;

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function testDateForDay(day: number): string {
  if (day < 1 || day > TOTAL_TEST_DAYS) {
    throw new Error(`Synthetic test day must be 1-${TOTAL_TEST_DAYS}, got ${day}`);
  }
  return addDays(TEST_START_DATE_KEY, day - 1);
}

export function dayOfMonth(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export function testDayFromDateKey(dateKey: string): number {
  const start = new Date(`${TEST_START_DATE_KEY}T00:00:00.000Z`).getTime();
  const current = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  return Math.round((current - start) / 86_400_000) + 1;
}
