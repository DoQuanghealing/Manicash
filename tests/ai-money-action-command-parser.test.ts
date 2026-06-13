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

  // ─── Phase 4B ─────────────────────────────────────────────────────────────
  const SNAP4B: MoneySnapshotV1 = {
    ...SNAP,
    transactions: [
      { id: 'tx1', type: 'expense', amount: 600_000, categoryId: 'clothing', categoryName: 'Quần áo', date: '2026-06-08T03:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W23', monthKey: '2026-06' },
    ],
    goals: [
      { id: 'g1', name: 'Quỹ khẩn cấp', targetAmount: 50_000_000, currentAmount: 10_000_000, monthlyContributionTarget: 2_000_000 },
      { id: 'g2', name: 'Mua nhà', targetAmount: 6_000_000_000, currentAmount: 100_000_000, monthlyContributionTarget: 5_000_000 },
    ],
    tasks: [
      { id: 'tk1', name: 'Dạy kèm', expectedAmount: 2_000_000, startDate: '2026-06-01', endDate: '2026-06-20' },
    ],
  };

  it('CREATE_FIXED_BILL "thêm bill internet 250k hạn ngày 12"', () => {
    const r = parseActionCommand('thêm bill internet 250k hạn ngày 12', SNAP4B);
    eq(r?.action, 'CREATE_FIXED_BILL');
    if (r && r.action === 'CREATE_FIXED_BILL') {
      eq(r.payload.amount, 250_000);
      eq(r.payload.dueDay, 12);
      eq(r.payload.name, 'Internet');
    }
  });

  it('SET_CATEGORY_BUDGET "đặt ngân sách ăn uống 3 triệu"', () => {
    const r = parseActionCommand('đặt ngân sách ăn uống 3 triệu', SNAP4B);
    eq(r?.action, 'SET_CATEGORY_BUDGET');
    if (r && r.action === 'SET_CATEGORY_BUDGET') {
      eq(r.payload.categoryId, 'food');
      eq(r.payload.monthlyLimit, 3_000_000);
    }
  });

  it('ADD_GOAL_DEPOSIT "nạp 2 triệu vào quỹ khẩn cấp"', () => {
    const r = parseActionCommand('nạp 2 triệu vào quỹ khẩn cấp', SNAP4B);
    eq(r?.action, 'ADD_GOAL_DEPOSIT');
    if (r && r.action === 'ADD_GOAL_DEPOSIT') {
      eq(r.payload.goalId, 'g1');
      eq(r.payload.amount, 2_000_000);
    }
  });

  it('ADD_GOAL_DEPOSIT "thêm 5 triệu vào mục tiêu mua nhà" (không nhầm CREATE_EXPENSE vì "mua")', () => {
    const r = parseActionCommand('thêm 5 triệu vào mục tiêu mua nhà', SNAP4B);
    eq(r?.action, 'ADD_GOAL_DEPOSIT');
    if (r && r.action === 'ADD_GOAL_DEPOSIT') eq(r.payload.goalId, 'g2');
  });

  it('CREATE_EARNING_TASK "tạo task freelance logo 3 triệu hạn 20/6"', () => {
    const r = parseActionCommand('tạo task freelance logo 3 triệu hạn 20/6', SNAP4B);
    eq(r?.action, 'CREATE_EARNING_TASK');
    if (r && r.action === 'CREATE_EARNING_TASK') {
      eq(r.payload.expectedAmount, 3_000_000);
      eq(r.payload.endDate, '2026-06-20');
      ok(r.payload.name.length > 0, 'name non-empty');
    }
  });

  it('CREATE_EARNING_TASK thiếu endDate -> null', () => {
    eq(parseActionCommand('tạo task freelance logo 3 triệu', SNAP4B), null);
  });

  it('COMPLETE_EARNING_TASK "hoàn thành task dạy kèm"', () => {
    const r = parseActionCommand('hoàn thành task dạy kèm', SNAP4B);
    eq(r?.action, 'COMPLETE_EARNING_TASK');
    if (r && r.action === 'COMPLETE_EARNING_TASK') eq(r.payload.taskId, 'tk1');
  });

  it('COMPLETE_EARNING_TASK với thực nhận "task dạy kèm xong rồi, thực nhận 2 triệu"', () => {
    const r = parseActionCommand('task dạy kèm xong rồi, thực nhận 2 triệu', SNAP4B);
    eq(r?.action, 'COMPLETE_EARNING_TASK');
    if (r && r.action === 'COMPLETE_EARNING_TASK') eq(r.payload.actualAmount, 2_000_000);
  });

  it('ADD_WISHLIST_ITEM "thêm iphone vào wishlist 20 triệu"', () => {
    const r = parseActionCommand('thêm iphone vào wishlist 20 triệu', SNAP4B);
    eq(r?.action, 'ADD_WISHLIST_ITEM');
    if (r && r.action === 'ADD_WISHLIST_ITEM') {
      eq(r.payload.expectedPrice, 20_000_000);
      ok(r.payload.name.toLowerCase().includes('iphone'), 'name has iphone');
    }
  });

  it('FLAG_TRANSACTION unique "gắn cờ giao dịch quần áo hôm nay"', () => {
    const r = parseActionCommand('gắn cờ giao dịch quần áo hôm nay', SNAP4B);
    eq(r?.action, 'FLAG_TRANSACTION');
    if (r && r.action === 'FLAG_TRANSACTION') eq(r.payload.transactionId, 'tx1');
  });

  it('FLAG_TRANSACTION "flag khoản chi 600k" (match theo amount)', () => {
    const r = parseActionCommand('flag khoản chi 600k', SNAP4B);
    eq(r?.action, 'FLAG_TRANSACTION');
    if (r && r.action === 'FLAG_TRANSACTION') eq(r.payload.transactionId, 'tx1');
  });

  it('pure query 4B không tạo action: "mục tiêu mua nhà tới đâu" -> null', () => {
    eq(parseActionCommand('mục tiêu mua nhà tới đâu', SNAP4B), null);
  });
  it('pure query 4B: "danh mục nào vượt ngân sách" -> null', () => {
    eq(parseActionCommand('danh mục nào vượt ngân sách', SNAP4B), null);
  });

  console.log('\naction command parser test complete.');
}

main();
