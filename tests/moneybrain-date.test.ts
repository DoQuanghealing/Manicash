/* TDD — moneyBrain/dateRange.ts (timezone-aware date helpers) */
import {
  getDateKey,
  getMonthKey,
  getISOWeekKey,
  getTodayKey,
  getCurrentMonthKey,
  isTransactionInPeriod,
  detectPeriod,
} from '@/lib/moneyBrain/dateRange';

type TestFn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (error) { console.error(`  FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
function eq<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}
function ok(v: boolean, label: string): void { if (!v) throw new Error(`Expected ${label} true`); }

const VN = 'Asia/Ho_Chi_Minh';

describe('getDateKey — timezone Asia/Ho_Chi_Minh (UTC+7)');
it('22:00 UTC ngày 7 -> 05:00 VN ngày 8 -> dateKey 2026-06-08', () => {
  eq(getDateKey('2026-06-07T22:00:00Z', VN), '2026-06-08');
});
it('02:00 UTC ngày 8 -> 09:00 VN ngày 8 -> dateKey 2026-06-08', () => {
  eq(getDateKey('2026-06-08T02:00:00Z', VN), '2026-06-08');
});

describe('getMonthKey');
it('format YYYY-MM', () => { eq(getMonthKey('2026-06-08T02:00:00Z', VN), '2026-06'); });
it('cuối tháng UTC nhưng sang tháng mới ở VN', () => {
  // 31/05 20:00 UTC = 01/06 03:00 VN -> tháng 06
  eq(getMonthKey('2026-05-31T20:00:00Z', VN), '2026-06');
});

describe('getISOWeekKey — ISO-8601, tuần bắt đầu thứ 2');
it('01/01/2026 (thứ 5) -> 2026-W01', () => { eq(getISOWeekKey('2026-01-01T06:00:00Z', VN), '2026-W01'); });
it('05/01/2026 (thứ 2) -> 2026-W02', () => { eq(getISOWeekKey('2026-01-05T06:00:00Z', VN), '2026-W02'); });
it('29/12/2025 (thứ 2) thuộc tuần chứa thứ 5 01/01/2026 -> 2026-W01', () => {
  eq(getISOWeekKey('2025-12-29T06:00:00Z', VN), '2026-W01');
});

describe('getTodayKey / getCurrentMonthKey — dùng clientNow, KHÔNG dùng giờ server');
it('clientNow 22:00 UTC ngày 7 -> hôm nay VN = 2026-06-08', () => {
  eq(getTodayKey('2026-06-07T22:00:00Z', VN), '2026-06-08');
});
it('currentMonthKey theo clientNow', () => {
  eq(getCurrentMonthKey('2026-05-31T20:00:00Z', VN), '2026-06');
});

describe('isTransactionInPeriod');
const ctx = { clientNow: '2026-06-08T03:00:00Z', timezone: VN }; // 10:00 VN 08/06
it('today: dateKey hôm nay -> true', () => {
  ok(isTransactionInPeriod({ dateKey: '2026-06-08' }, 'today', ctx), 'today');
});
it('today: dateKey hôm qua -> false', () => {
  ok(!isTransactionInPeriod({ dateKey: '2026-06-07' }, 'today', ctx), 'not today');
});
it('yesterday: dateKey hôm qua -> true', () => {
  ok(isTransactionInPeriod({ dateKey: '2026-06-07' }, 'yesterday', ctx), 'yesterday');
});
it('this_month: trong tháng -> true, ngoài tháng -> false', () => {
  ok(isTransactionInPeriod({ monthKey: '2026-06' }, 'this_month', ctx), 'in month');
  ok(!isTransactionInPeriod({ monthKey: '2026-05' }, 'this_month', ctx), 'out month');
});
it('last_month: tháng trước -> true', () => {
  ok(isTransactionInPeriod({ monthKey: '2026-05' }, 'last_month', ctx), 'last month');
});
it('all: luôn true', () => {
  ok(isTransactionInPeriod({ dateKey: '2020-01-01' }, 'all', ctx), 'all');
});
it('suy ra key từ date nếu thiếu dateKey/monthKey', () => {
  ok(isTransactionInPeriod({ date: '2026-06-08T01:00:00Z' }, 'today', ctx), 'derived today');
});

describe('detectPeriod (VN text)');
it('"hôm nay tôi chi bao nhiêu" -> today', () => { eq(detectPeriod('hôm nay tôi chi bao nhiêu'), 'today'); });
it('"hôm qua chi gì" -> yesterday', () => { eq(detectPeriod('hôm qua chi gì'), 'yesterday'); });
it('"tuần này thu bao nhiêu" -> this_week', () => { eq(detectPeriod('tuần này thu bao nhiêu'), 'this_week'); });
it('"tháng này chi bao nhiêu" -> this_month', () => { eq(detectPeriod('tháng này chi bao nhiêu'), 'this_month'); });
it('"tháng trước chi bao nhiêu" -> last_month', () => { eq(detectPeriod('tháng trước chi bao nhiêu'), 'last_month'); });
it('không nêu period -> default this_month', () => { eq(detectPeriod('tôi chi bao nhiêu'), 'this_month'); });

console.log('\nmoneyBrain dateRange test complete.');
