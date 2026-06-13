/* Phase 5 — undo executor: rollback per action + stale-safe fail */
import { executeMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { undoMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionUndoExecutor';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';
import type { ExecuteActionResult } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';

type AsyncFn = () => Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const DUMMY: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-13T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 0, emergency: 0, billFund: 0 }, transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};
const req = (action: MoneyActionRequest['action'], payload: MoneyActionRequest['payload']): MoneyActionRequest =>
  createActionRequest(DUMMY, { action, payload, preview: '' });

function recordFrom(request: MoneyActionRequest, result: ExecuteActionResult): MoneyActionAuditRecord {
  return {
    id: 'rec', requestId: request.requestId, action: request.action, request,
    status: 'executed', createdAt: '', updatedAt: '',
    undoable: result.ok ? result.undoable : false,
    undoSnapshot: result.ok ? result.undoSnapshot : undefined,
    preview: '', events: [],
  };
}

async function main() {
  console.log('\nundo executor');

  await it('undo MARK_BILL_PAID -> bill chưa đóng + hoàn billFund', async () => {
    useFinanceStore.setState({
      fixedBills: [{ id: 'b1', name: 'Điện', icon: '⚡', amount: 350_000, dueDay: 10, isPaid: false }],
      billFundBalance: 1_000_000,
    });
    const r = req('MARK_BILL_PAID', { billId: 'b1', billName: 'Điện', amount: 350_000 });
    const res = await executeMoneyActionOnClient(r);
    ok(res.ok, 'executed');
    eq(useFinanceStore.getState().fixedBills[0].isPaid, true);
    eq(useFinanceStore.getState().billFundBalance, 650_000);
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useFinanceStore.getState().fixedBills[0].isPaid, false);
    eq(useFinanceStore.getState().billFundBalance, 1_000_000, 'billFund restored');
  });

  await it('undo CREATE_EXPENSE -> xóa txn + khôi phục balance', async () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 10_000_000 });
    const r = req('CREATE_EXPENSE', { amount: 100_000, categoryId: 'food', wallet: 'main' });
    const res = await executeMoneyActionOnClient(r);
    ok(res.ok, 'executed');
    eq(useFinanceStore.getState().mainBalance, 9_900_000);
    eq(useFinanceStore.getState().transactions.length, 1);
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useFinanceStore.getState().transactions.length, 0, 'txn removed');
    eq(useFinanceStore.getState().mainBalance, 10_000_000, 'balance restored');
  });

  await it('undo SET_CATEGORY_BUDGET -> khôi phục limit cũ', async () => {
    const month = useBudgetStore.getState().currentMonth;
    useBudgetStore.setState({ categoryBudgets: [{ categoryId: 'food', monthlyLimit: 1_000_000, spent: 0, month }] });
    const r = req('SET_CATEGORY_BUDGET', { categoryId: 'food', monthlyLimit: 3_000_000 });
    const res = await executeMoneyActionOnClient(r);
    ok(res.ok, 'executed');
    eq(useBudgetStore.getState().categoryBudgets.find((b) => b.categoryId === 'food' && b.month === month)?.monthlyLimit, 3_000_000);
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useBudgetStore.getState().categoryBudgets.find((b) => b.categoryId === 'food' && b.month === month)?.monthlyLimit, 1_000_000, 'old limit restored');
  });

  await it('undo FLAG_TRANSACTION -> khôi phục trạng thái cờ trước', async () => {
    useFinanceStore.setState({ transactions: [{ id: 'tx1', type: 'expense', amount: 600_000, categoryId: 'clothing', note: '', wallet: 'main', date: '2026-06-13T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' }] });
    useBudgetStore.setState({ flaggedTransactionIds: [] });
    const r = req('FLAG_TRANSACTION', { transactionId: 'tx1' });
    const res = await executeMoneyActionOnClient(r);
    ok(res.ok, 'executed');
    ok(useBudgetStore.getState().flaggedTransactionIds.includes('tx1'), 'flagged');
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    ok(!useBudgetStore.getState().flaggedTransactionIds.includes('tx1'), 'flag restored to off');
  });

  await it('undo stale (txn đã bị xóa) -> fail an toàn', async () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 5_000_000 });
    const r = req('CREATE_EXPENSE', { amount: 100_000, categoryId: 'food', wallet: 'main' });
    const res = await executeMoneyActionOnClient(r);
    const rec = recordFrom(r, res);
    // mô phỏng data đã đổi: xóa txn thủ công trước khi undo
    useFinanceStore.setState({ transactions: [] });
    const undo = await undoMoneyActionOnClient(rec);
    eq(undo.ok, false, 'stale -> fail');
  });

  await it('không undo nếu record chưa executed', async () => {
    const r = req('FLAG_TRANSACTION', { transactionId: 'x' });
    const rec: MoneyActionAuditRecord = { id: 'r', requestId: r.requestId, action: r.action, request: r, status: 'requested', createdAt: '', updatedAt: '', undoable: true, preview: '', events: [] };
    const undo = await undoMoneyActionOnClient(rec);
    eq(undo.ok, false);
  });

  console.log('\nundo executor test complete.');
}

main();
