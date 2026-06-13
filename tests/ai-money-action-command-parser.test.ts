/* Phase 4A — action command parser */
import { parseActionCommand } from '@/lib/aiMoneyChat/actions/actionCommandParser';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown): void {
  if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const SNAP: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
  transactions: [], budgets: [],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: false },
    { id: 'b2', name: 'Tiền nhà', amount: 2_500_000, dueDay: 1, isPaid: false },
    { id: 'b3', name: 'Internet', amount: 250_000, dueDay: 12, isPaid: true },
  ],
  goals: [], tasks: [], carryOver: 0,
};

// Ambiguous: 2 bill cùng chứa 'dien'.
const AMBIG: MoneySnapshotV1 = {
  ...SNAP,
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: false },
    { id: 'b4', name: 'Tiền điện thoại', amount: 200_000, dueDay: 5, isPaid: false },
  ],
};

function main() {
  console.log('\naction command parser');

  it('"đánh dấu tiền điện đã đóng" -> MARK_BILL_PAID', () => {
    const r = parseActionCommand('đánh dấu tiền điện đã đóng', SNAP);
    eq(r?.action, 'MARK_BILL_PAID');
    eq(r?.payload && 'billId' in r.payload ? r.payload.billId : null, 'b1');
  });

  it('"tôi đã trả tiền nhà" -> MARK_BILL_PAID (b2)', () => {
    const r = parseActionCommand('tôi đã trả tiền nhà', SNAP);
    eq(r?.action, 'MARK_BILL_PAID');
    eq(r && r.action === 'MARK_BILL_PAID' ? r.payload.billId : null, 'b2');
  });

  it('"ghi chi 50k cà phê" -> CREATE_EXPENSE coffee 50k', () => {
    const r = parseActionCommand('ghi chi 50k cà phê', SNAP);
    eq(r?.action, 'CREATE_EXPENSE');
    if (r && r.action === 'CREATE_EXPENSE') {
      eq(r.payload.amount, 50_000);
      eq(r.payload.categoryId, 'coffee');
      eq(r.riskLevel, 'low');
    }
  });

  it('"tôi vừa tiêu 120k ăn uống" -> CREATE_EXPENSE food', () => {
    const r = parseActionCommand('tôi vừa tiêu 120k ăn uống', SNAP);
    eq(r?.action, 'CREATE_EXPENSE');
    if (r && r.action === 'CREATE_EXPENSE') eq(r.payload.categoryId, 'food');
  });

  it('expense >= 3M -> riskLevel high', () => {
    const r = parseActionCommand('mua laptop 5 triệu', SNAP);
    eq(r?.action, 'CREATE_EXPENSE');
    eq(r?.riskLevel, 'high');
  });

  it('"ghi thu nhập 3 triệu freelance" -> CREATE_INCOME', () => {
    const r = parseActionCommand('ghi thu nhập 3 triệu freelance', SNAP);
    eq(r?.action, 'CREATE_INCOME');
    if (r && r.action === 'CREATE_INCOME') eq(r.payload.amount, 3_000_000);
  });

  it('"tôi vừa nhận lương 15tr" -> CREATE_INCOME 15M', () => {
    const r = parseActionCommand('tôi vừa nhận lương 15tr', SNAP);
    eq(r?.action, 'CREATE_INCOME');
    if (r && r.action === 'CREATE_INCOME') eq(r.payload.amount, 15_000_000);
  });

  it('"bill nào chưa đóng" -> null (query thuần)', () => {
    eq(parseActionCommand('bill nào chưa đóng', SNAP), null);
  });

  it('"hôm nay tôi chi bao nhiêu" -> null (không amount)', () => {
    eq(parseActionCommand('hôm nay tôi chi bao nhiêu', SNAP), null);
  });

  it('ambiguous bill -> null', () => {
    eq(parseActionCommand('đánh dấu tiền điện đã đóng', AMBIG), null);
  });

  it('mọi request đều pending_confirmation + requiresConfirmation', () => {
    const r = parseActionCommand('ghi chi 50k cà phê', SNAP);
    ok(r !== null, 'has request');
    eq(r!.status, 'pending_confirmation');
    eq(r!.requiresConfirmation, true);
    eq(r!.type, 'action_request');
  });

  console.log('\naction command parser test complete.');
}

main();
