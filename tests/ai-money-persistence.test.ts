/* Phase 6B-1 — local-first persistence: partialize/migrate/version, hydration, round-trip, undo-after-reload */

// PHẢI import đầu tiên: cài localStorage mock TRƯỚC khi store (persist) được import.
import { persistMem as _mem } from './_setupLocalStorage';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { useHydrationStore, areCoreStoresHydrated } from '@/stores/useHydrationStore';
import { onRehydrateMark } from '@/stores/persistConfig';
import { executeMoneyActionOnClient, type ExecuteActionResult } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { undoMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionUndoExecutor';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }
function has(o: object, k: string): boolean { return Object.prototype.hasOwnProperty.call(o, k); }

const DUMMY: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-13T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 0, emergency: 0, billFund: 0 }, transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};

async function main() {
  console.log('\nlocal-first persistence');

  // ── partialize: chỉ data, không function ──
  await it('finance partialize: có data, KHÔNG có function', () => {
    const part = useFinanceStore.persist.getOptions().partialize!(useFinanceStore.getState()) as Record<string, unknown>;
    ok(has(part, 'transactions') && has(part, 'mainBalance') && has(part, 'fixedBills'), 'data present');
    ok(!has(part, 'addTransaction') && !has(part, 'payBill'), 'no functions');
  });

  await it('auth partialize: chỉ user, KHÔNG firebaseUser/isLoading', () => {
    const part = useAuthStore.persist.getOptions().partialize!(useAuthStore.getState()) as Record<string, unknown>;
    ok(has(part, 'user'), 'user present');
    ok(!has(part, 'firebaseUser') && !has(part, 'isLoading') && !has(part, 'isAuthenticated'), 'no transient/secret');
  });

  await it('budget/goals/tasks partialize đúng field nghiệp vụ', () => {
    const b = useBudgetStore.persist.getOptions().partialize!(useBudgetStore.getState()) as Record<string, unknown>;
    ok(has(b, 'categoryBudgets') && has(b, 'flaggedTransactionIds') && has(b, 'carryOver'), 'budget fields');
    const g = useGoalsStore.persist.getOptions().partialize!(useGoalsStore.getState()) as Record<string, unknown>;
    ok(has(g, 'goals'), 'goals field');
    const t = useTaskStore.persist.getOptions().partialize!(useTaskStore.getState()) as Record<string, unknown>;
    ok(has(t, 'tasks') && has(t, 'xpPenalties'), 'tasks fields');
  });

  // ── version ──
  await it('version = 1 cho mọi store', () => {
    eq(useFinanceStore.persist.getOptions().version, 1);
    eq(useBudgetStore.persist.getOptions().version, 1);
    eq(useGoalsStore.persist.getOptions().version, 1);
    eq(useTaskStore.persist.getOptions().version, 1);
    eq(useAuthStore.persist.getOptions().version, 1);
  });

  // ── migrate: fill default an toàn ──
  await it('finance migrate({},0) fill mảng + số mặc định', () => {
    const migrated = useFinanceStore.persist.getOptions().migrate!({}, 0) as Record<string, unknown>;
    ok(Array.isArray(migrated.transactions) && Array.isArray(migrated.fixedBills), 'arrays default');
    eq(migrated.mainBalance, 0);
  });

  await it('goals migrate giữ data cũ thiếu monthlyContributionTarget (không crash)', () => {
    const migrated = useGoalsStore.persist.getOptions().migrate!({ goals: [{ id: 'g', name: 'X', targetAmount: 1, currentAmount: 0, milestones: [] }] }, 0) as { goals: unknown[] };
    eq(migrated.goals.length, 1);
  });

  // ── hydration ──
  await it('useHydrationStore: false ban đầu -> true sau markHydrated tất cả', () => {
    useHydrationStore.setState({ finance: false, budget: false, goals: false, tasks: false, auth: false });
    eq(areCoreStoresHydrated(), false);
    (['finance', 'budget', 'goals', 'tasks', 'auth'] as const).forEach((k) => useHydrationStore.getState().markHydrated(k));
    eq(areCoreStoresHydrated(), true);
  });

  await it('onRehydrateMark đánh dấu đúng key', () => {
    const inner = onRehydrateMark('finance')(); // outer() -> inner callback
    useHydrationStore.setState({ finance: false });
    inner(); // chạy markHydrated('finance')
    eq(useHydrationStore.getState().finance, true);
  });

  // ── round-trip qua mock localStorage ──
  await it('finance rehydrate từ localStorage (không duplicate seed)', async () => {
    _mem.set('manicash.finance.v1', JSON.stringify({
      state: { transactions: [{ id: 'custom1', type: 'expense', amount: 99_000, categoryId: 'food', note: '', wallet: 'main', date: '2026-06-13T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' }], mainBalance: 1_234_000, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] },
      version: 1,
    }));
    await useFinanceStore.persist.rehydrate();
    const txns = useFinanceStore.getState().transactions;
    eq(txns.length, 1, 'chỉ data persisted, không cộng dồn seed');
    eq(txns[0].id, 'custom1');
    eq(useFinanceStore.getState().mainBalance, 1_234_000);
  });

  // ── audit persist + undo sau reload (MARK_BILL_PAID exact) ──
  await it('audit entry sống qua reload + undo MARK_BILL_PAID exact billFund', async () => {
    useFinanceStore.setState({ fixedBills: [{ id: 'b1', name: 'Điện', icon: '⚡', amount: 500_000, dueDay: 10, isPaid: false }], billFundBalance: 200_000 });
    useActionAuditStore.getState().clearHistoryForDev();

    // execute + ghi audit (mô phỏng confirm flow)
    const r: MoneyActionRequest = createActionRequest(DUMMY, { action: 'MARK_BILL_PAID', payload: { billId: 'b1', billName: 'Điện', amount: 500_000 }, preview: 'pay' });
    useActionAuditStore.getState().addRequested(r);
    const res: ExecuteActionResult = await executeMoneyActionOnClient(r);
    useActionAuditStore.getState().markExecuted(r.requestId, { message: 'done', undoable: res.ok ? res.undoable : false, undoSnapshot: res.ok ? res.undoSnapshot : undefined });
    eq(useFinanceStore.getState().billFundBalance, 0, 'clamp sau pay');

    // simulate reload: rehydrate audit từ localStorage (persist đã ghi tự động)
    await useActionAuditStore.persist.rehydrate();
    const rec = useActionAuditStore.getState().getByRequestId(r.requestId) as MoneyActionAuditRecord;
    ok(!!rec, 'audit entry survives reload');
    eq(rec.status, 'executed');

    // undo sau reload -> restore exact 200k
    const undo = await undoMoneyActionOnClient(rec);
    ok(undo.ok, 'undo ok after reload');
    eq(useFinanceStore.getState().billFundBalance, 200_000, 'billFund restore EXACT sau reload');
    eq(useFinanceStore.getState().fixedBills[0].isPaid, false);
  });

  await it('corrupt storage không crash (migrate nhận data lạ)', () => {
    const migrated = useFinanceStore.persist.getOptions().migrate!({ transactions: 'not-array', mainBalance: 'x' }, 0) as Record<string, unknown>;
    ok(Array.isArray(migrated.transactions), 'transactions fallback []');
    eq(migrated.mainBalance, 0, 'mainBalance fallback 0');
  });

  console.log('\nlocal-first persistence test complete.');
}

main();
