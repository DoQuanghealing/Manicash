import { getCurrentAiMoneyDayKey, readDailyUsage } from '@/lib/aiMoneyChat/quotaCore';

type TestFn = () => void;
function describe(name: string, fn: TestFn): void { console.log(`\n${name}`); fn(); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function expectEqual<T>(a: T, b: T): void { if (a !== b) throw new Error(`Expected ${String(b)}, got ${String(a)}`); }

describe('getCurrentAiMoneyDayKey — theo giờ VN (UTC+7)', () => {
  it('18:00Z → đã sang ngày VN (01:00 hôm sau)', () => {
    expectEqual(getCurrentAiMoneyDayKey(new Date('2026-06-14T18:00:00Z')), '2026-06-15');
  });
  it('10:00Z → cùng ngày VN (17:00)', () => {
    expectEqual(getCurrentAiMoneyDayKey(new Date('2026-06-14T10:00:00Z')), '2026-06-14');
  });
  it('16:59Z = 23:59 VN → vẫn ngày 14', () => {
    expectEqual(getCurrentAiMoneyDayKey(new Date('2026-06-14T16:59:00Z')), '2026-06-14');
  });
});

describe('readDailyUsage — tự reset khi sang ngày', () => {
  const TODAY = '2026-06-14';
  it('cùng dayKey → trả counts', () => {
    const u = readDailyUsage({ dayKey: TODAY, daily_report: 1, daily_chat: 5 }, TODAY);
    expectEqual(u.report, 1);
    expectEqual(u.chat, 5);
  });
  it('dayKey cũ → reset 0 (chống lách qua đêm)', () => {
    const u = readDailyUsage({ dayKey: '2026-06-13', daily_report: 3, daily_chat: 9 }, TODAY);
    expectEqual(u.report, 0);
    expectEqual(u.chat, 0);
  });
  it('undefined / thiếu field → 0', () => {
    expectEqual(readDailyUsage(undefined, TODAY).report, 0);
    expectEqual(readDailyUsage({ dayKey: TODAY }, TODAY).chat, 0);
  });
});

if (process.exitCode) process.exit(process.exitCode);
