/* Phase 5 — action audit store: status transitions + events + history limit */
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const DUMMY: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-13T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 0, emergency: 0, billFund: 0 }, transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};
function req(): MoneyActionRequest {
  return createActionRequest(DUMMY, { action: 'FLAG_TRANSACTION', payload: { transactionId: 'tx1' }, preview: 'flag tx1' });
}

function main() {
  console.log('\naction audit store');
  const store = useActionAuditStore.getState();
  store.clearHistoryForDev();

  it('addRequested -> status requested + event', () => {
    const r = req();
    const rec = useActionAuditStore.getState().addRequested(r);
    eq(rec.status, 'requested');
    eq(rec.events.length, 1);
    eq(rec.events[0].type, 'requested');
    ok(!!useActionAuditStore.getState().getByRequestId(r.requestId), 'findable');
  });

  it('requested -> confirmed -> executed (giữ events cũ)', () => {
    const r = req();
    useActionAuditStore.getState().addRequested(r);
    useActionAuditStore.getState().markConfirmed(r.requestId);
    useActionAuditStore.getState().markExecuted(r.requestId, { message: 'done', undoable: true, undoSnapshot: { action: 'FLAG_TRANSACTION', before: { transactionId: 'tx1', flagged: false } } });
    const rec = useActionAuditStore.getState().getByRequestId(r.requestId)!;
    eq(rec.status, 'executed');
    eq(rec.undoable, true);
    ok(!!rec.executedAt, 'executedAt set');
    eq(rec.events.map((e) => e.type).join(','), 'requested,confirmed,executed');
  });

  it('requested -> cancelled', () => {
    const r = req();
    useActionAuditStore.getState().addRequested(r);
    useActionAuditStore.getState().markCancelled(r.requestId, 'User cancelled');
    eq(useActionAuditStore.getState().getByRequestId(r.requestId)!.status, 'cancelled');
  });

  it('requested -> failed', () => {
    const r = req();
    useActionAuditStore.getState().addRequested(r);
    useActionAuditStore.getState().markFailed(r.requestId, 'boom');
    const rec = useActionAuditStore.getState().getByRequestId(r.requestId)!;
    eq(rec.status, 'failed');
    eq(rec.errorMessage, 'boom');
  });

  it('executed -> undo_requested -> undone', () => {
    const r = req();
    useActionAuditStore.getState().addRequested(r);
    useActionAuditStore.getState().markExecuted(r.requestId, { message: 'done', undoable: true });
    useActionAuditStore.getState().markUndoRequested(r.requestId);
    useActionAuditStore.getState().markUndone(r.requestId, 'undone ok');
    const rec = useActionAuditStore.getState().getByRequestId(r.requestId)!;
    eq(rec.status, 'undone');
    eq(rec.undoable, false);
    ok(rec.events.some((e) => e.type === 'undo_requested'), 'has undo_requested event');
  });

  it('executed -> undo_failed', () => {
    const r = req();
    useActionAuditStore.getState().addRequested(r);
    useActionAuditStore.getState().markExecuted(r.requestId, { message: 'done', undoable: true });
    useActionAuditStore.getState().markUndoFailed(r.requestId, 'stale');
    eq(useActionAuditStore.getState().getByRequestId(r.requestId)!.status, 'undo_failed');
  });

  it('history limit <= 200', () => {
    useActionAuditStore.getState().clearHistoryForDev();
    for (let i = 0; i < 205; i++) useActionAuditStore.getState().addRequested(req());
    ok(useActionAuditStore.getState().records.length <= 200, 'capped at 200');
  });

  it('getRecent newest-first', () => {
    useActionAuditStore.getState().clearHistoryForDev();
    const a = req(); useActionAuditStore.getState().addRequested(a);
    const b = req(); useActionAuditStore.getState().addRequested(b);
    eq(useActionAuditStore.getState().getRecent(1)[0].requestId, b.requestId);
  });

  console.log('\naction audit store test complete.');
}

main();
