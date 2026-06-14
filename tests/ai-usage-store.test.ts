/* AI Usage Store — per-uid per-feature daily/monthly counters with rollover */
import './_setupLocalStorage';
import { getAiUsage, recordAiUse, clearAiUsage } from '@/lib/aiMoneyChat/aiUsageStore';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const D1 = new Date(2026, 5, 14, 10, 0, 0); // 2026-06-14
const D1b = new Date(2026, 5, 14, 23, 0, 0); // same day later
const D2 = new Date(2026, 5, 15, 9, 0, 0); // next day, same month
const D3 = new Date(2026, 6, 1, 9, 0, 0); // next month

function main() {
  console.log('\naiUsageStore');

  it('starts at zero', () => {
    clearAiUsage('u1');
    eq(getAiUsage('u1', 'report', D1).usedToday, 0);
    eq(getAiUsage('u1', 'report', D1).usedThisMonth, 0);
  });

  it('record increments today + month', () => {
    clearAiUsage('u1');
    recordAiUse('u1', 'report', D1);
    const u = getAiUsage('u1', 'report', D1b);
    eq(u.usedToday, 1, 'today');
    eq(u.usedThisMonth, 1, 'month');
  });

  it('daily resets next day, monthly keeps counting', () => {
    clearAiUsage('u1');
    recordAiUse('u1', 'report', D1);
    recordAiUse('u1', 'report', D2);
    const u = getAiUsage('u1', 'report', D2);
    eq(u.usedToday, 1, 'today reset to 1 on D2');
    eq(u.usedThisMonth, 2, 'month accumulates');
  });

  it('monthly resets next month', () => {
    clearAiUsage('u1');
    recordAiUse('u1', 'report', D1);
    recordAiUse('u1', 'report', D1);
    const next = getAiUsage('u1', 'report', D3);
    eq(next.usedToday, 0, 'new day');
    eq(next.usedThisMonth, 0, 'new month resets');
  });

  it('features are separate pools', () => {
    clearAiUsage('u1');
    recordAiUse('u1', 'report', D1);
    eq(getAiUsage('u1', 'chat', D1).usedToday, 0, 'chat untouched');
    recordAiUse('u1', 'chat', D1);
    eq(getAiUsage('u1', 'report', D1).usedToday, 1, 'report still 1');
    eq(getAiUsage('u1', 'chat', D1).usedToday, 1, 'chat 1');
  });

  it('uids are isolated', () => {
    clearAiUsage('uA'); clearAiUsage('uB');
    recordAiUse('uA', 'report', D1);
    eq(getAiUsage('uB', 'report', D1).usedToday, 0, 'uB unaffected');
  });

  console.log('\naiUsageStore test complete.');
}

main();
