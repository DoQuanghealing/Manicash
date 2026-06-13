/* Phase 5 — end-to-end flow: audit store + executor + undo (mô phỏng UI) */
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { executeMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { undoMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionUndoExecutor';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
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

/** Mô phỏng handleConfirmAction của UI. */
async function confirmFlow(request: MoneyActionRequest) {
  const audit = useActionAuditStore.getState();
  audit.addRequested(request);
  audit.markConfirmed(request.requestId);
  const res = await executeMoneyActionOnClient(request);
  if (res.ok) audit.markExecuted(request.requestId, { message: res.message, undoable: res.undoable, undoReason: res.undoReason, undoSnapshot: res.undoSnapshot });
  else audit.markFailed(request.requestId, res.message);
  return res;
}

async function main() {
  console.log('\naction history flow');
  useActionAuditStore.getState().clearHistoryForDev();

  await it('confirm flow: requested -> executed + audit ghi lại', async () => {
    useFinanceStore.setState({ transactions: [{ id: 'tx1', type: 'expense', amount: 600_000, categoryId: 'clothing', note: '', wallet: 'main', date: '2026-06-13T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' }] });
    useBudgetStore.setState({ flaggedTransactionIds: [] });
    const r = createActionRequest(DUMMY, { action: 'FLAG_TRANSACTION', payload: { transactionId: 'tx1' }, preview: 'flag tx1' });
    const res = await confirmFlow(r);
    ok(res.ok, 'executed');
    const rec = useActionAuditStore.getState().getByRequestId(r.requestId)!;
    eq(rec.status, 'executed');
    eq(rec.undoable, true);
  });

  await it('cancel flow: requested -> cancelled (không execute)', async () => {
    const r = createActionRequest(DUMMY, { action: 'FLAG_TRANSACTION', payload: { transactionId: 'tx1' }, preview: 'flag tx1' });
    const audit = useActionAuditStore.getState();
    audit.addRequested(r);
    audit.markCancelled(r.requestId, 'User cancelled');
    eq(audit.getByRequestId(r.requestId)!.status, 'cancelled');
  });

  await it('undo flow: executed -> undone qua undo executor', async () => {
    useFinanceStore.setState({ transactions: [{ id: 'tx2', type: 'expense', amount: 100_000, categoryId: 'food', note: '', wallet: 'main', date: '2026-06-13T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' }] });
    useBudgetStore.setState({ flaggedTransactionIds: [] });
    const r = createActionRequest(DUMMY, { action: 'FLAG_TRANSACTION', payload: { transactionId: 'tx2' }, preview: 'flag tx2' });
    await confirmFlow(r);
    const audit = useActionAuditStore.getState();
    audit.markUndoRequested(r.requestId);
    const rec = audit.getByRequestId(r.requestId)!;
    const undo = await undoMoneyActionOnClient(rec);
    if (undo.ok) audit.markUndone(r.requestId, undo.message);
    else audit.markUndoFailed(r.requestId, undo.message);
    ok(undo.ok, 'undo ok');
    eq(useActionAuditStore.getState().getByRequestId(r.requestId)!.status, 'undone');
    ok(!useBudgetStore.getState().flaggedTransactionIds.includes('tx2'), 'flag reverted');
  });

  console.log('\naction history flow test complete.');
}

main();
