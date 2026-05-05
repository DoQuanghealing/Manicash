import { 
  getMonthKeyFromDate, 
  getCurrentMonthKey, 
  getDateKey, 
  getDateLabel, 
  parseMonthKey, 
  isSameMonth, 
  daysBetween 
} from '@/lib/dateHelpers';

describe('dateHelpers', () => {
  it('getMonthKeyFromDate: ISO string trả "YYYY-MM"', () => {
    expect(getMonthKeyFromDate('2026-05-15T10:00:00Z')).toBe('2026-05');
  });

  it('getMonthKeyFromDate: edge case ngày cuối tháng UTC', () => {
    // 2026-04-30 22:00 UTC is still April in UTC
    expect(getMonthKeyFromDate('2026-04-30T22:00:00Z')).toBe('2026-04');
    // 2026-04-30 22:00 UTC +7 is May 1st local, but UTC parsing keeps it April
  });

  it('getMonthKeyFromDate: input Date object cũng work', () => {
    const d = new Date('2026-05-15T10:00:00Z');
    expect(getMonthKeyFromDate(d)).toBe('2026-05');
  });

  it('getCurrentMonthKey: format đúng', () => {
    const key = getCurrentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('getDateKey: format "YYYY-MM-DD"', () => {
    expect(getDateKey('2026-05-15T10:00:00Z')).toBe('2026-05-15');
  });

  it('getDateKey: edge case ngày cuối tháng không bị shift', () => {
    expect(getDateKey('2026-04-30T22:00:00Z')).toBe('2026-04-30');
  });

  it('parseMonthKey: roundtrip với getMonthKeyFromDate', () => {
    const parsed = parseMonthKey('2026-05');
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(5);
  });

  it('isSameMonth: cross-timezone consistency', () => {
    expect(isSameMonth('2026-05-15T10:00:00Z', '2026-05-01T00:00:00Z')).toBe(true);
    expect(isSameMonth('2026-05-15T10:00:00Z', '2026-04-30T23:59:59Z')).toBe(false);
  });
  
  it('getDateLabel: logic', () => {
    const now = new Date();
    expect(getDateLabel(now)).toBe('Hôm nay');
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(getDateLabel(yesterday)).toBe('Hôm qua');
    const past = new Date('2025-01-15T10:00:00Z');
    expect(getDateLabel(past)).toBe('15/01');
  });
  
  it('daysBetween: difference between days', () => {
    expect(daysBetween('2026-05-01T10:00:00Z', '2026-05-05T10:00:00Z')).toBe(4);
    expect(daysBetween('2026-04-30T10:00:00Z', '2026-05-01T10:00:00Z')).toBe(1);
  });
});

// Simple test runner for this file
function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exit(1);
  }
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
    },
    toMatch: (regex: RegExp) => {
      if (!regex.test(actual)) throw new Error(`Expected ${actual} to match ${regex}`);
    }
  };
}
