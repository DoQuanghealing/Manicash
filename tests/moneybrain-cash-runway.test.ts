/* Phase 6C — cashRunway: dual runway (survival/lifestyle) deterministic */
import {
  getCashRunway,
  getLiquidBalance,
  getMonthlySurvivalBurn,
  getEssentialCategoryAvgLast3Months,
  getMonthlyAvgExpense,
  getSurvivalRunwayDays,
  getLifestyleRunwayDays,
  isEssentialCategory,
  RUNWAY_INFINITE_DAYS,
} from '@/lib/moneyBrain/cashRunway';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function near(a: number, b: number, msg?: string): void {
  if (Math.abs(a - b) > 0.001) throw new Error(`${msg ?? ''} expected ≈${b}, got ${a}`);
}

const VN = 'Asia/Ho_Chi_Minh';
const CLIENT_NOW = '2026-06-08T03:00:00Z';

function tx(amount: number, categoryId: string, monthKey: string, type: 'income' | 'expense' = 'expense') {
  return {
    id: `${type}-${categoryId}-${monthKey}-${amount}`,
    type, amount, categoryId,
    date: `${monthKey}-02T03:00:00Z`, dateKey: `${monthKey}-02`,
    weekKey: '2026-W23', monthKey,
  };
}
function makeSnap(o: Partial<MoneySnapshotV1> = {}): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1', clientNow: CLIENT_NOW, timezone: VN,
    wallets: { main: 6_000_000, emergency: 6_000_000, billFund: 5_000_000 },
    transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0, ...o,
  };
}

function main() {
  console.log('\ncashRunway');

  it('isEssentialCategory: essential vs discretionary', () => {
    eq(isEssentialCategory('food'), true, 'food');
    eq(isEssentialCategory('groceries'), true, 'groceries');
    eq(isEssentialCategory('transport'), true, 'transport');
    eq(isEssentialCategory('bills'), true, 'bills');
    eq(isEssentialCategory('rent'), true, 'rent');
    eq(isEssentialCategory('health'), true, 'health');
    eq(isEssentialCategory('coffee'), false, 'coffee not essential');
    eq(isEssentialCategory('shopping'), false, 'shopping not essential');
    eq(isEssentialCategory('entertain'), false, 'entertain (alias entertainment) not essential');
    eq(isEssentialCategory(undefined), false, 'undefined not essential');
  });

  it('liquidBalance = main + emergency (excludes billFund)', () => {
    eq(getLiquidBalance(makeSnap()), 12_000_000);
  });

  // 3 tháng dữ liệu: 06 {food 3M, coffee 3M}, 05 {food 3M}, 04 {transport 3M}
  const threeMonths = makeSnap({
    bills: [{ id: 'b1', name: 'Nhà', amount: 3_000_000, dueDay: 10, isPaid: false }],
    transactions: [
      tx(3_000_000, 'food', '2026-06'),
      tx(3_000_000, 'coffee', '2026-06'),
      tx(3_000_000, 'food', '2026-05'),
      tx(3_000_000, 'transport', '2026-04'),
    ],
  });

  it('essentialAvgLast3Months = (3+3+3)/3 = 3M', () => {
    eq(getEssentialCategoryAvgLast3Months(threeMonths), 3_000_000);
  });

  it('monthlyAvgExpense = (3+3+3+3)/3 = 4M (includes coffee)', () => {
    eq(getMonthlyAvgExpense(threeMonths), 4_000_000);
  });

  it('monthlySurvivalBurn = fixedBills 3M + essential 3M = 6M', () => {
    eq(getMonthlySurvivalBurn(threeMonths), 6_000_000);
  });

  it('survivalRunwayDays = 12M / 6M * 30 = 60', () => {
    eq(getSurvivalRunwayDays(threeMonths), 60);
  });

  it('lifestyleRunwayDays = 12M / 4M * 30 = 90', () => {
    eq(getLifestyleRunwayDays(threeMonths), 90);
  });

  it('getCashRunway aggregates all fields', () => {
    const r = getCashRunway(threeMonths);
    eq(r.liquidBalance, 12_000_000, 'liquid');
    eq(r.totalFixedBills, 3_000_000, 'bills');
    eq(r.essentialAvgLast3Months, 3_000_000, 'essential');
    eq(r.monthlyAvgExpense, 4_000_000, 'avg expense');
    eq(r.monthlySurvivalBurn, 6_000_000, 'burn');
    eq(r.survivalRunwayDays, 60, 'survival days');
    eq(r.lifestyleRunwayDays, 90, 'lifestyle days');
    eq(r.monthsOfDataUsed, 3, 'months used');
  });

  it('limits to last 3 months of data (older month excluded)', () => {
    const fourMonths = makeSnap({
      transactions: [
        tx(99_000_000, 'food', '2026-03'), // tháng cũ nhất — phải bị loại
        tx(3_000_000, 'transport', '2026-04'),
        tx(3_000_000, 'food', '2026-05'),
        tx(3_000_000, 'food', '2026-06'),
      ],
    });
    // last 3 = 04,05,06 → essential (3+3+3)/3 = 3M, không dính 99M tháng 03
    eq(getEssentialCategoryAvgLast3Months(fourMonths), 3_000_000);
  });

  it('liquid <= 0 → 0 days', () => {
    const snap = makeSnap({
      wallets: { main: 0, emergency: 0, billFund: 5_000_000 },
      bills: [{ id: 'b1', name: 'Nhà', amount: 3_000_000, dueDay: 10, isPaid: false }],
      transactions: [tx(3_000_000, 'food', '2026-06')],
    });
    eq(getSurvivalRunwayDays(snap), 0);
    eq(getLifestyleRunwayDays(snap), 0);
  });

  it('burn = 0 but liquid > 0 → RUNWAY_INFINITE_DAYS', () => {
    const snap = makeSnap({ bills: [], transactions: [] });
    eq(getMonthlySurvivalBurn(snap), 0, 'burn 0');
    eq(getSurvivalRunwayDays(snap), RUNWAY_INFINITE_DAYS, 'survival infinite');
    eq(getLifestyleRunwayDays(snap), RUNWAY_INFINITE_DAYS, 'lifestyle infinite');
  });

  it('no history → essential/avg = 0; survival uses only fixed bills', () => {
    const snap = makeSnap({
      bills: [{ id: 'b1', name: 'Nhà', amount: 4_000_000, dueDay: 10, isPaid: false }],
      transactions: [],
    });
    eq(getEssentialCategoryAvgLast3Months(snap), 0, 'essential 0');
    eq(getMonthlyAvgExpense(snap), 0, 'avg 0');
    eq(getMonthlySurvivalBurn(snap), 4_000_000, 'burn = bills only');
    // survival = 12M / 4M * 30 = 90; lifestyle: avg 0 → infinite
    eq(getSurvivalRunwayDays(snap), 90, 'survival 90');
    eq(getLifestyleRunwayDays(snap), RUNWAY_INFINITE_DAYS, 'lifestyle infinite (no spend)');
  });

  it('fractional runway computes precisely', () => {
    const snap = makeSnap({
      wallets: { main: 5_000_000, emergency: 0, billFund: 0 },
      bills: [{ id: 'b1', name: 'X', amount: 3_500_000, dueDay: 5, isPaid: false }],
      transactions: [],
    });
    // liquid 5M, burn 3.5M → 5/3.5*30 = 42.857...
    near(getSurvivalRunwayDays(snap), (5_000_000 / 3_500_000) * 30, 'fractional');
  });

  console.log('\ncashRunway test complete.');
}

main();
