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

  console.log('\naction validators test complete.');
}

main();
