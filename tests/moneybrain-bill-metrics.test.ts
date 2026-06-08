/* TDD — billMetrics.ts: paid/unpaid, coverage, upcoming */
import {
  getUnpaidBills, getPaidBills, getTotalFixedBills, getTotalUnpaidBills,
  getBillFundCoverageRate, getBillFundGap, getRemainingMainBalanceAfterUnpaidBills,
  getUpcomingBills,
} from '@/lib/moneyBrain/billMetrics';
import type { MoneySnapshotV1, MoneyBillSnapshot } from '@/lib/moneyBrain/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void { console.log(`\n${name}`); }
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// CLIENT_NOW = 2026-06-08 10:00 VN = dueDay 8 in June
const CLIENT_NOW = '2026-06-08T03:00:00Z';
const VN = 'Asia/Ho_Chi_Minh';

const BILLS: MoneyBillSnapshot[] = [
  { id: 'rent', name: 'Tiền nhà', amount: 2_500_000, dueDay: 1, isPaid: false },
  { id: 'tuition', name: 'Học phí', amount: 1_200_000, dueDay: 3, isPaid: false },
  { id: 'electric', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: true },
  { id: 'water', name: 'Tiền nước', amount: 100_000, dueDay: 15, isPaid: false },
  { id: 'internet', name: 'Internet', amount: 200_000, dueDay: 20, isPaid: false },
];

function makeSnap(bills: MoneyBillSnapshot[], billFund = 3_000_000): MoneySnapshotV1 {
  return {
    version: 'money_snapshot_v1',
    clientNow: CLIENT_NOW,
    timezone: VN,
    wallets: { main: 10_000_000, emergency: 5_000_000, billFund },
    transactions: [],
    budgets: [],
    bills,
    goals: [],
    tasks: [],
  };
}

async function main() {
  describe('getUnpaidBills / getPaidBills');

  await it('phân biệt đúng paid / unpaid', async () => {
    const snap = makeSnap(BILLS);
    const unpaid = getUnpaidBills(snap);
    const paid = getPaidBills(snap);
    eq(unpaid.length, 4, '4 unpaid');
    eq(paid.length, 1, '1 paid');
    eq(paid[0].id, 'electric', 'only electric is paid');
  });

  await it('no bills → empty arrays', async () => {
    const snap = makeSnap([]);
    eq(getUnpaidBills(snap).length, 0);
    eq(getPaidBills(snap).length, 0);
  });

  describe('getTotalFixedBills / getTotalUnpaidBills');

  await it('total fixed = sum all bills', async () => {
    const snap = makeSnap(BILLS);
    eq(getTotalFixedBills(snap), 2_500_000 + 1_200_000 + 350_000 + 100_000 + 200_000, 'sum all');
  });

  await it('total unpaid = sum unpaid bills only', async () => {
    const snap = makeSnap(BILLS);
    eq(getTotalUnpaidBills(snap), 2_500_000 + 1_200_000 + 100_000 + 200_000, 'sum unpaid');
  });

  describe('getBillFundCoverageRate / getBillFundGap');

  await it('no unpaid bills → coverage = 1', async () => {
    const snap = makeSnap([{ id: 'e', name: 'Electric', amount: 200_000, dueDay: 10, isPaid: true }], 0);
    eq(getBillFundCoverageRate(snap), 1, 'full coverage when no unpaid');
    eq(getBillFundGap(snap), 0, 'no gap');
  });

  await it('billFund > unpaid → coverage > 1, gap = 0', async () => {
    const unpaidBills: MoneyBillSnapshot[] = [
      { id: 'b1', name: 'B1', amount: 1_000_000, dueDay: 5, isPaid: false },
    ];
    const snap = makeSnap(unpaidBills, 2_000_000); // fund > unpaid
    const rate = getBillFundCoverageRate(snap);
    if (rate !== 2) throw new Error(`expected coverage 2, got ${rate}`);
    eq(getBillFundGap(snap), 0, 'no gap when overfunded');
  });

  await it('billFund < unpaid → gap > 0', async () => {
    const unpaidBills: MoneyBillSnapshot[] = [
      { id: 'b1', name: 'B1', amount: 2_000_000, dueDay: 5, isPaid: false },
      { id: 'b2', name: 'B2', amount: 1_000_000, dueDay: 10, isPaid: false },
    ];
    const snap = makeSnap(unpaidBills, 1_500_000); // fund < total unpaid 3M
    const rate = getBillFundCoverageRate(snap);
    if (Math.abs(rate - 0.5) > 0.001) throw new Error(`expected coverage 0.5, got ${rate}`);
    eq(getBillFundGap(snap), 1_500_000, 'gap = 3M - 1.5M');
  });

  describe('getRemainingMainBalanceAfterUnpaidBills');

  await it('remaining = main - unpaid', async () => {
    const snap = makeSnap(BILLS); // main = 10M, unpaid = 4M
    const unpaidTotal = 2_500_000 + 1_200_000 + 100_000 + 200_000;
    eq(getRemainingMainBalanceAfterUnpaidBills(snap), 10_000_000 - unpaidTotal);
  });

  describe('getUpcomingBills — 7 ngày tới');

  await it('bills trong 7 ngày tới (từ 08/06 đến 14/06)', async () => {
    // dueDay 8 = hôm nay, dueDay 10 = 2 ngày nữa, dueDay 15 = 7 ngày nữa, dueDay 20 = ngoài range
    const snap = makeSnap([
      { id: 'b8', name: 'Bill ngày 8', amount: 100_000, dueDay: 8, isPaid: false },
      { id: 'b10', name: 'Bill ngày 10', amount: 200_000, dueDay: 10, isPaid: false },
      { id: 'b14', name: 'Bill ngày 14', amount: 300_000, dueDay: 14, isPaid: false },
      { id: 'b15', name: 'Bill ngày 15', amount: 400_000, dueDay: 15, isPaid: false }, // ngày 15 = 7 ngày từ 8/6
      { id: 'b20', name: 'Bill ngày 20', amount: 500_000, dueDay: 20, isPaid: false }, // ngoài range
      { id: 'bPaid', name: 'Bill đã đóng', amount: 1_000_000, dueDay: 10, isPaid: true }, // đã đóng
    ]);
    const upcoming = getUpcomingBills(snap, 7);
    const ids = upcoming.map((b) => b.id);
    if (!ids.includes('b8')) throw new Error('b8 (today) should be upcoming');
    if (!ids.includes('b10')) throw new Error('b10 should be upcoming');
    if (!ids.includes('b14')) throw new Error('b14 should be upcoming');
    if (!ids.includes('b15')) throw new Error('b15 (day 15, 7 days from 8/6) should be upcoming');
    if (ids.includes('b20')) throw new Error('b20 (day 20) should NOT be upcoming in 7 days');
    if (ids.includes('bPaid')) throw new Error('paid bill should NOT be in upcoming');
  });

  await it('dueDay đã qua trong tháng (ngày 1, 3) → KHÔNG nằm trong upcoming từ ngày 8', async () => {
    const snap = makeSnap([
      { id: 'b1', name: 'Bill ngày 1', amount: 200_000, dueDay: 1, isPaid: false },
      { id: 'b3', name: 'Bill ngày 3', amount: 300_000, dueDay: 3, isPaid: false },
    ]);
    const upcoming = getUpcomingBills(snap, 7);
    const ids = upcoming.map((b) => b.id);
    if (ids.includes('b1')) throw new Error('b1 (day 1 already passed) should NOT be upcoming');
    if (ids.includes('b3')) throw new Error('b3 (day 3 already passed) should NOT be upcoming');
  });

  await it('no unpaid bills → empty upcoming', async () => {
    const snap = makeSnap([{ id: 'b1', name: 'Paid', amount: 1_000_000, dueDay: 10, isPaid: true }]);
    eq(getUpcomingBills(snap, 7).length, 0, 'no upcoming when all paid');
  });

  console.log('\nbillMetrics test complete.');
}

main();
