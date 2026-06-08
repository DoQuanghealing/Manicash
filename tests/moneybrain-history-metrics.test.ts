/* Phase 3 — historyMetrics: available months, monthly history, hasEnoughHistory */
import {
  getAvailableMonthKeys,
  getMonthlyHistory,
  hasEnoughHistory,
} from '@/lib/moneyBrain/historyMetrics';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';

function tx(type: 'income' | 'expense', amount: number, monthKey: string) {
  const dateKey = `${monthKey}-05`;
  return { id: `${type}-${amount}-${monthKey}`, type, amount, date: `${dateKey}T03:00:00Z`, dateKey, weekKey: '2026-W01', monthKey };
}
function makeSnap(transactions: MoneySnapshotV1['transactions']): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 0, emergency: 0, billFund: 0 },
    transactions, budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
  };
}

function main() {
  console.log('\nhistoryMetrics');

  it('availableMonths sorted asc, unique', () => {
    const snap = makeSnap([
      tx('income', 10_000_000, '2026-06'),
      tx('expense', 5_000_000, '2026-04'),
      tx('income', 8_000_000, '2026-05'),
    ]);
    eq(getAvailableMonthKeys(snap).join(','), '2026-04,2026-05,2026-06');
  });

  it('monthly history computes income/expense/net/savingsRate', () => {
    const snap = makeSnap([
      tx('income', 10_000_000, '2026-06'),
      tx('expense', 4_000_000, '2026-06'),
    ]);
    const h = getMonthlyHistory(snap);
    eq(h.length, 1);
    eq(h[0].income, 10_000_000);
    eq(h[0].expense, 4_000_000);
    eq(h[0].netCashflow, 6_000_000);
    eq(h[0].savingsRate, 60);
  });

  it('getMonthlyHistory(3) lấy 3 tháng gần nhất', () => {
    const snap = makeSnap([
      tx('income', 1, '2026-02'), tx('income', 1, '2026-03'),
      tx('income', 1, '2026-04'), tx('income', 1, '2026-05'), tx('income', 1, '2026-06'),
    ]);
    const h = getMonthlyHistory(snap, 3);
    eq(h.map((p) => p.monthKey).join(','), '2026-04,2026-05,2026-06');
  });

  it('hasEnoughHistory: chỉ 1 tháng -> false', () => {
    const snap = makeSnap([tx('income', 10_000_000, '2026-06')]);
    eq(hasEnoughHistory(snap, 3), false);
  });

  it('hasEnoughHistory: 3 tháng -> true; KHÔNG fabricate', () => {
    const snap = makeSnap([
      tx('income', 1, '2026-04'), tx('income', 1, '2026-05'), tx('income', 1, '2026-06'),
    ]);
    eq(hasEnoughHistory(snap, 3), true);
    eq(getMonthlyHistory(snap).length, 3); // đúng 3 tháng có data, không thêm tháng trống
  });

  console.log('\nhistoryMetrics test complete.');
}

main();
