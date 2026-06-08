/* Phase 3 — behaviorMetrics: largest/unusual/leaks/weekend */
import {
  getLargestExpenses,
  getUnusualExpenses,
  getRepeatedSmallLeaks,
  getWeekendSpending,
} from '@/lib/moneyBrain/behaviorMetrics';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, msg: string): void { if (!v) throw new Error(msg); }

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const MK = '2026-06';

function tx(id: string, amount: number, categoryId: string, dateKey: string, categoryName?: string) {
  return { id, type: 'expense' as const, amount, categoryId, categoryName, date: `${dateKey}T03:00:00Z`, dateKey, weekKey: '2026-W23', monthKey: MK };
}
function makeSnap(transactions: MoneySnapshotV1['transactions']): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 10_000_000, emergency: 0, billFund: 0 },
    transactions, budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
  };
}

function main() {
  console.log('\nbehaviorMetrics');

  it('largest expenses sorted desc', () => {
    const snap = makeSnap([
      tx('a', 500_000, 'food', '2026-06-02'),
      tx('b', 3_000_000, 'shopping', '2026-06-03'),
      tx('c', 1_000_000, 'coffee', '2026-06-04'),
    ]);
    const largest = getLargestExpenses(snap, 2);
    eq(largest.length, 2);
    eq(largest[0].id, 'b');
    eq(largest[1].id, 'c');
  });

  it('unusual: txn >= 2.5x category avg (>=3 txns)', () => {
    const snap = makeSnap([
      tx('f1', 50_000, 'food', '2026-06-01'),
      tx('f2', 60_000, 'food', '2026-06-02'),
      tx('f3', 70_000, 'food', '2026-06-03'),
      tx('big', 500_000, 'food', '2026-06-04'), // avg ~ (50+60+70+500)/4=170k; 500k >= 170k*2.5=425k
    ]);
    const unusual = getUnusualExpenses(snap);
    ok(unusual.some((t) => t.id === 'big'), 'big flagged');
    ok(typeof unusual[0].reason === 'string', 'has reason');
  });

  it('unusual: category < minCount không flag', () => {
    const snap = makeSnap([
      tx('s1', 100_000, 'shopping', '2026-06-01'),
      tx('s2', 900_000, 'shopping', '2026-06-02'),
    ]);
    eq(getUnusualExpenses(snap).length, 0);
  });

  it('repeated small leaks: coffee 3 lần', () => {
    const snap = makeSnap([
      tx('c1', 40_000, 'coffee', '2026-06-01', 'Cà phê'),
      tx('c2', 45_000, 'coffee', '2026-06-02', 'Cà phê'),
      tx('c3', 50_000, 'coffee', '2026-06-03', 'Cà phê'),
      tx('big', 500_000, 'shopping', '2026-06-04'),
    ]);
    const leaks = getRepeatedSmallLeaks(snap);
    eq(leaks.length, 1);
    eq(leaks[0].categoryId, 'coffee');
    eq(leaks[0].count, 3);
    eq(leaks[0].totalAmount, 135_000);
    eq(leaks[0].avgAmount, 45_000);
  });

  it('weekend spending percentage', () => {
    // 2026-06-06 = Thứ 7, 2026-06-07 = CN; 2026-06-08 = Thứ 2
    const snap = makeSnap([
      tx('wkd1', 200_000, 'food', '2026-06-06'),
      tx('wkd2', 100_000, 'food', '2026-06-07'),
      tx('wd', 700_000, 'food', '2026-06-08'),
    ]);
    const w = getWeekendSpending(snap);
    eq(w.count, 2);
    eq(w.totalAmount, 300_000);
    eq(Math.round(w.percentageOfExpense), 30); // 300k / 1.0M
  });

  console.log('\nbehaviorMetrics test complete.');
}

main();
