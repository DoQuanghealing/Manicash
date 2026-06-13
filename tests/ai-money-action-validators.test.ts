/* Phase 4A — action validators */
import { validateActionRequestAgainstSnapshot } from '@/lib/aiMoneyChat/actions/actionValidators';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const SNAP: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
  transactions: [], budgets: [],
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: false },
    { id: 'b2', name: 'Internet', amount: 250_000, dueDay: 12, isPaid: true },
  ],
  goals: [], tasks: [], carryOver: 0,
};

function main() {
  console.log('\naction validators');

  it('MARK_BILL_PAID bill chưa đóng -> ok', () => {
    const req = createActionRequest(SNAP, { action: 'MARK_BILL_PAID', payload: { billId: 'b1', billName: 'Tiền điện', amount: 350_000 }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should be ok');
  });

  it('MARK_BILL_PAID bill đã đóng -> fail', () => {
    const req = createActionRequest(SNAP, { action: 'MARK_BILL_PAID', payload: { billId: 'b2', billName: 'Internet', amount: 250_000 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should fail (already paid)');
  });

  it('MARK_BILL_PAID bill không tồn tại -> fail', () => {
    const req = createActionRequest(SNAP, { action: 'MARK_BILL_PAID', payload: { billId: 'zzz', billName: 'X', amount: 1 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should fail (missing)');
  });

  it('CREATE_EXPENSE amount <= 0 -> fail', () => {
    const req = createActionRequest(SNAP, { action: 'CREATE_EXPENSE', payload: { amount: 0, categoryId: 'food' }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should fail');
  });

  it('CREATE_EXPENSE thiếu category -> fail', () => {
    const req = createActionRequest(SNAP, { action: 'CREATE_EXPENSE', payload: { amount: 50_000, categoryId: '' }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should fail');
  });

  it('CREATE_EXPENSE >= 3M vẫn cho tạo request (executor mới chặn)', () => {
    const req = createActionRequest(SNAP, { action: 'CREATE_EXPENSE', payload: { amount: 5_000_000, categoryId: 'shopping' }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP, req).ok, 'request allowed at validate stage');
  });

  it('CREATE_INCOME amount <= 0 -> fail', () => {
    const req = createActionRequest(SNAP, { action: 'CREATE_INCOME', payload: { amount: -1 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should fail');
  });

  it('invalid wallet -> fail', () => {
    const req = createActionRequest(SNAP, { action: 'CREATE_INCOME', payload: { amount: 1_000_000, wallet: 'savings' as unknown as 'main' }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP, req).ok, 'should fail');
  });

  // ─── Phase 4B ─────────────────────────────────────────────────────────────
  const SNAP4B: MoneySnapshotV1 = {
    ...SNAP,
    transactions: [
      { id: 'tx1', type: 'expense', amount: 600_000, categoryId: 'clothing', date: '2026-06-08T03:00:00Z', dateKey: '2026-06-08', weekKey: '2026-W23', monthKey: '2026-06' },
    ],
    goals: [{ id: 'g1', name: 'Quỹ khẩn cấp', targetAmount: 50_000_000, currentAmount: 10_000_000, monthlyContributionTarget: 2_000_000 }],
    tasks: [
      { id: 'tk1', name: 'Dạy kèm', expectedAmount: 2_000_000, startDate: '2026-06-01', endDate: '2026-06-20' },
      { id: 'tk2', name: 'Viết blog', expectedAmount: 800_000, startDate: '2026-06-01', endDate: '2026-06-10', completedAt: '2026-06-05T03:00:00Z' },
    ],
  };

  it('CREATE_FIXED_BILL dueDay 0 -> fail', () => {
    const req = createActionRequest(SNAP4B, { action: 'CREATE_FIXED_BILL', payload: { name: 'Internet', amount: 250_000, dueDay: 0 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'dueDay invalid');
  });
  it('CREATE_FIXED_BILL hợp lệ -> ok', () => {
    const req = createActionRequest(SNAP4B, { action: 'CREATE_FIXED_BILL', payload: { name: 'Internet', amount: 250_000, dueDay: 12 }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should ok');
  });

  it('SET_CATEGORY_BUDGET monthlyLimit >= 0 ok', () => {
    const req = createActionRequest(SNAP4B, { action: 'SET_CATEGORY_BUDGET', payload: { categoryId: 'food', monthlyLimit: 3_000_000 }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should ok');
  });
  it('SET_CATEGORY_BUDGET thiếu category -> fail', () => {
    const req = createActionRequest(SNAP4B, { action: 'SET_CATEGORY_BUDGET', payload: { categoryId: '', monthlyLimit: 1 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should fail');
  });

  it('ADD_GOAL_DEPOSIT goal tồn tại -> ok', () => {
    const req = createActionRequest(SNAP4B, { action: 'ADD_GOAL_DEPOSIT', payload: { goalId: 'g1', goalName: 'Quỹ khẩn cấp', amount: 2_000_000 }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should ok');
  });
  it('ADD_GOAL_DEPOSIT goal không tồn tại -> fail', () => {
    const req = createActionRequest(SNAP4B, { action: 'ADD_GOAL_DEPOSIT', payload: { goalId: 'zzz', goalName: 'X', amount: 2_000_000 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should fail');
  });

  it('CREATE_EARNING_TASK endDate invalid -> fail', () => {
    const req = createActionRequest(SNAP4B, { action: 'CREATE_EARNING_TASK', payload: { name: 'X', expectedAmount: 1_000_000, endDate: 'not-a-date' }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should fail');
  });

  it('COMPLETE_EARNING_TASK task chưa xong -> ok', () => {
    const req = createActionRequest(SNAP4B, { action: 'COMPLETE_EARNING_TASK', payload: { taskId: 'tk1', taskName: 'Dạy kèm', expectedAmount: 2_000_000 }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should ok');
  });
  it('COMPLETE_EARNING_TASK task đã xong -> fail', () => {
    const req = createActionRequest(SNAP4B, { action: 'COMPLETE_EARNING_TASK', payload: { taskId: 'tk2', taskName: 'Viết blog', expectedAmount: 800_000 }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should fail (completed)');
  });

  it('ADD_WISHLIST_ITEM name non-empty -> ok', () => {
    const req = createActionRequest(SNAP4B, { action: 'ADD_WISHLIST_ITEM', payload: { name: 'iPhone', expectedPrice: 20_000_000, cooldownHours: 48 }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should ok');
  });

  it('FLAG_TRANSACTION txn tồn tại -> ok', () => {
    const req = createActionRequest(SNAP4B, { action: 'FLAG_TRANSACTION', payload: { transactionId: 'tx1' }, preview: '' });
    ok(validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should ok');
  });
  it('FLAG_TRANSACTION txn không tồn tại -> fail', () => {
    const req = createActionRequest(SNAP4B, { action: 'FLAG_TRANSACTION', payload: { transactionId: 'zzz' }, preview: '' });
    ok(!validateActionRequestAgainstSnapshot(SNAP4B, req).ok, 'should fail');
  });

  console.log('\naction validators test complete.');
}

main();
