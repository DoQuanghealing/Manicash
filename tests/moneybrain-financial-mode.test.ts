/* Phase 3 — financialMode: deriveFinancialMode deterministic */
import { deriveFinancialMode, getEmergencyRunwayMonths } from '@/lib/moneyBrain/financialMode';
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
const MK = '2026-06';

function tx(type: 'income' | 'expense', amount: number, categoryId?: string) {
  return { id: `${type}-${amount}-${categoryId ?? ''}`, type, amount, categoryId, date: '2026-06-02T03:00:00Z', dateKey: '2026-06-02', weekKey: '2026-W23', monthKey: MK };
}
function makeSnap(o: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 10_000_000, emergency: 0, billFund: 0 },
    transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0, ...o,
  };
}

function main() {
  console.log('\nfinancialMode');

  it('safeToSpend <= 0 -> stabilize', () => {
    const snap = makeSnap({
      transactions: [tx('income', 3_000_000)],
      budgets: [{ categoryId: 'food', monthlyLimit: 5_000_000, monthKey: MK }],
    });
    eq(deriveFinancialMode(snap), 'stabilize');
  });

  it('billCoverage < 1 -> stabilize (dù safeToSpend > 0)', () => {
    const snap = makeSnap({
      wallets: { main: 10_000_000, emergency: 0, billFund: 1_000_000 },
      transactions: [tx('income', 20_000_000)],
      bills: [{ id: 'b1', name: 'Nhà', amount: 5_000_000, dueDay: 10, isPaid: false }],
    });
    eq(deriveFinancialMode(snap), 'stabilize');
  });

  it('safeToSpend > 0 & savingsRate < 20 -> build_cashflow', () => {
    const snap = makeSnap({
      transactions: [tx('income', 10_000_000), tx('expense', 9_000_000, 'food')],
    });
    eq(deriveFinancialMode(snap), 'build_cashflow');
  });

  it('savingsRate >= 20 & runway >= 3 + overbudget -> accelerate', () => {
    const snap = makeSnap({
      wallets: { main: 5_000_000, emergency: 20_000_000, billFund: 0 },
      transactions: [tx('income', 20_000_000), tx('expense', 2_000_000, 'food')],
      budgets: [{ categoryId: 'food', monthlyLimit: 1_000_000, monthKey: MK }], // spent 2M > 1M
    });
    eq(deriveFinancialMode(snap), 'accelerate');
  });

  it('thanh khoản mạnh + không rủi ro -> protect_capital', () => {
    const snap = makeSnap({
      wallets: { main: 50_000_000, emergency: 20_000_000, billFund: 5_000_000 },
      transactions: [tx('income', 20_000_000), tx('expense', 4_000_000, 'food')],
      budgets: [{ categoryId: 'food', monthlyLimit: 6_000_000, monthKey: MK }], // không vượt
    });
    eq(deriveFinancialMode(snap), 'protect_capital');
  });

  it('getEmergencyRunwayMonths: emergency/expense', () => {
    const snap = makeSnap({
      wallets: { main: 0, emergency: 12_000_000, billFund: 0 },
      transactions: [tx('expense', 4_000_000, 'food')],
    });
    eq(getEmergencyRunwayMonths(snap), 3);
  });

  console.log('\nfinancialMode test complete.');
}

main();
