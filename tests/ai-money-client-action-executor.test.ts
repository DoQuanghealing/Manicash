/* Phase 4B — client action executor (mutates Zustand after confirm) */
import { executeMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useWishlistStore } from '@/stores/useWishlistStore';

type AsyncFn = () => Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }

const DUMMY: MoneySnapshotV1 = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 0, emergency: 0, billFund: 0 }, transactions: [], budgets: [], bills: [], goals: [], tasks: [], carryOver: 0,
};
const req = (action: MoneyActionRequest['action'], payload: MoneyActionRequest['payload']): MoneyActionRequest =>
  createActionRequest(DUMMY, { action, payload, preview: '' });

async function main() {
  console.log('\nclient action executor');

  await it('expired request -> not ok', async () => {
    const r = req('FLAG_TRANSACTION', { transactionId: 'x' });
    (r as { expiresAt: string }).expiresAt = '2000-01-01T00:00:00Z';
    const res = await executeMoneyActionOnClient(r);
    eq(res.ok, false);
  });

  await it('CREATE_EXPENSE >= 3M -> BreathGate block (không execute)', async () => {
    const res = await executeMoneyActionOnClient(req('CREATE_EXPENSE', { amount: 5_000_000, categoryId: 'shopping' }));
    eq(res.ok, false);
    ok(res.message.includes('BreathGate'), 'breath gate message');
  });

  await it('CREATE_FIXED_BILL -> addBill', async () => {
    const before = useFinanceStore.getState().fixedBills.length;
    const res = await executeMoneyActionOnClient(req('CREATE_FIXED_BILL', { name: 'Internet TEST', amount: 250_000, dueDay: 12 }));
    eq(res.ok, true);
    const after = useFinanceStore.getState().fixedBills;
    eq(after.length, before + 1, 'bill added');
    ok(after.some((b) => b.name === 'Internet TEST'), 'new bill present');
  });

  await it('SET_CATEGORY_BUDGET -> setCategoryBudget', async () => {
    const res = await executeMoneyActionOnClient(req('SET_CATEGORY_BUDGET', { categoryId: 'food', monthlyLimit: 4_321_000 }));
    eq(res.ok, true);
    const month = useBudgetStore.getState().currentMonth;
    const b = useBudgetStore.getState().categoryBudgets.find((x) => x.categoryId === 'food' && x.month === month);
    eq(b?.monthlyLimit, 4_321_000);
  });

  await it('ADD_GOAL_DEPOSIT -> addFundsToGoal (XP do store lo)', async () => {
    useGoalsStore.setState({
      goals: [{ id: 'g1', name: 'Quỹ khẩn cấp', icon: '🛡️', targetAmount: 50_000_000, currentAmount: 10_000_000, deadline: '2026-12-31', color: '#22C55E', milestones: [], deposits: [], createdAt: '2025-01-01' }],
    });
    const res = await executeMoneyActionOnClient(req('ADD_GOAL_DEPOSIT', { goalId: 'g1', goalName: 'Quỹ khẩn cấp', amount: 2_000_000 }));
    eq(res.ok, true);
    eq(useGoalsStore.getState().goals.find((g) => g.id === 'g1')?.currentAmount, 12_000_000);
  });

  await it('ADD_GOAL_DEPOSIT goal không tồn tại -> not ok', async () => {
    const res = await executeMoneyActionOnClient(req('ADD_GOAL_DEPOSIT', { goalId: 'zzz', goalName: 'X', amount: 1_000_000 }));
    eq(res.ok, false);
  });

  await it('CREATE_EARNING_TASK -> addTask', async () => {
    const before = useTaskStore.getState().tasks.length;
    const res = await executeMoneyActionOnClient(req('CREATE_EARNING_TASK', { name: 'Freelance TEST', expectedAmount: 3_000_000, endDate: '2026-06-30', startDate: '2026-06-08' }));
    eq(res.ok, true);
    eq(useTaskStore.getState().tasks.length, before + 1, 'task added');
  });

  await it('COMPLETE_EARNING_TASK -> completeTask', async () => {
    useTaskStore.setState({
      tasks: [{ id: 't1', name: 'Dạy kèm', expectedAmount: 2_000_000, startDate: '2026-06-01', endDate: '2026-06-20', subTasks: [], createdAt: '2026-06-01' }],
      xpPenalties: [],
    });
    const res = await executeMoneyActionOnClient(req('COMPLETE_EARNING_TASK', { taskId: 't1', taskName: 'Dạy kèm', expectedAmount: 2_000_000, actualAmount: 2_000_000 }));
    eq(res.ok, true);
    ok(!!useTaskStore.getState().tasks.find((t) => t.id === 't1')?.completedAt, 'completedAt set');
  });

  await it('COMPLETE_EARNING_TASK đã xong -> not ok', async () => {
    const res = await executeMoneyActionOnClient(req('COMPLETE_EARNING_TASK', { taskId: 't1', taskName: 'Dạy kèm', expectedAmount: 2_000_000 }));
    eq(res.ok, false);
  });

  await it('ADD_WISHLIST_ITEM -> addItem', async () => {
    const before = useWishlistStore.getState().items.length;
    const res = await executeMoneyActionOnClient(req('ADD_WISHLIST_ITEM', { name: 'iPhone TEST', expectedPrice: 20_000_000, cooldownHours: 48 }));
    eq(res.ok, true);
    eq(useWishlistStore.getState().items.length, before + 1, 'wishlist item added');
  });

  await it('FLAG_TRANSACTION -> toggleTransactionFlag', async () => {
    useFinanceStore.setState({
      transactions: [{ id: 'tx1', type: 'expense', amount: 600_000, categoryId: 'clothing', note: '', wallet: 'main', date: '2026-06-08T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-08' }],
    });
    useBudgetStore.setState({ flaggedTransactionIds: [] });
    const res = await executeMoneyActionOnClient(req('FLAG_TRANSACTION', { transactionId: 'tx1' }));
    eq(res.ok, true);
    ok(useBudgetStore.getState().flaggedTransactionIds.includes('tx1'), 'flagged');
  });

  await it('FLAG_TRANSACTION txn không tồn tại -> not ok', async () => {
    useFinanceStore.setState({ transactions: [] });
    const res = await executeMoneyActionOnClient(req('FLAG_TRANSACTION', { transactionId: 'nope' }));
    eq(res.ok, false);
  });

  // ─── Phase 5: undo metadata ───────────────────────────────────────────────
  await it('CREATE_FIXED_BILL trả undo metadata (undoable + billId)', async () => {
    const res = await executeMoneyActionOnClient(req('CREATE_FIXED_BILL', { name: 'X', amount: 100_000, dueDay: 5 }));
    ok(res.ok, 'ok');
    if (res.ok) {
      eq(res.undoable, true);
      eq(res.undoSnapshot?.action, 'CREATE_FIXED_BILL');
      ok(!!(res.undoSnapshot?.after as { billId?: string })?.billId, 'has billId');
    }
  });

  await it('CREATE_EXPENSE undoable + undo snapshot (txn id + userProgress)', async () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 1_000_000 });
    const res = await executeMoneyActionOnClient(req('CREATE_EXPENSE', { amount: 50_000, categoryId: 'food', wallet: 'main' }));
    ok(res.ok, 'ok');
    if (res.ok) {
      eq(res.undoable, true);
      ok(!!(res.undoSnapshot?.after as { transactionId?: string })?.transactionId, 'has txn id');
      ok('userProgress' in ((res.undoSnapshot?.before ?? {}) as object), 'has userProgress snapshot');
    }
  });

  await it('CREATE_EXPENSE >= 3M -> không undoable (block)', async () => {
    const res = await executeMoneyActionOnClient(req('CREATE_EXPENSE', { amount: 5_000_000, categoryId: 'food' }));
    eq(res.ok, false);
  });

  console.log('\nclient action executor test complete.');
}

main();
