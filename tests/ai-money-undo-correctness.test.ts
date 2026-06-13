/* Phase 6A — undo correctness hardening: exact billFund, XP reversal, penalty restore */
import { executeMoneyActionOnClient, type ExecuteActionResult } from '@/lib/aiMoneyChat/actions/clientActionExecutor';
import { undoMoneyActionOnClient } from '@/lib/aiMoneyChat/actions/clientActionUndoExecutor';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';
import type { MoneyActionRequest } from '@/lib/aiMoneyChat/actions/actionTypes';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { UserProfile } from '@/types/user';

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
function recordFrom(request: MoneyActionRequest, res: ExecuteActionResult): MoneyActionAuditRecord {
  return { id: 'r', requestId: request.requestId, action: request.action, request, status: 'executed', createdAt: '', updatedAt: '', undoable: res.ok ? res.undoable : false, undoSnapshot: res.ok ? res.undoSnapshot : undefined, preview: '', events: [] };
}
function seedUser(xp: number): void {
  useAuthStore.setState({ user: { uid: 'u', displayName: 'T', email: '', photoURL: null, rank: 'gold', xp, streak: 5, lastActiveDate: '2026-06-01', streakShields: 1, resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, accountStatus: 'active', createdAt: '', updatedAt: '' } as UserProfile });
}

async function main() {
  console.log('\nundo correctness (Phase 6A)');

  await it('BUG FIX: MARK_BILL_PAID undo restore billFund CHÍNH XÁC khi clamp (200k/500k)', async () => {
    useFinanceStore.setState({
      fixedBills: [{ id: 'b1', name: 'Điện', icon: '⚡', amount: 500_000, dueDay: 10, isPaid: false }],
      billFundBalance: 200_000,
    });
    const r = req('MARK_BILL_PAID', { billId: 'b1', billName: 'Điện', amount: 500_000 });
    const res = await executeMoneyActionOnClient(r);
    eq(useFinanceStore.getState().billFundBalance, 0, 'clamp về 0 sau pay');
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useFinanceStore.getState().billFundBalance, 200_000, 'restore CHÍNH XÁC 200k (không phải 500k)');
    eq(useFinanceStore.getState().fixedBills[0].isPaid, false, 'isPaid restored');
  });

  await it('CREATE_INCOME undo xóa txn + restore balance', async () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 5_000_000 });
    useAuthStore.setState({ user: null });
    const r = req('CREATE_INCOME', { amount: 2_000_000, wallet: 'main' });
    const res = await executeMoneyActionOnClient(r);
    eq(useFinanceStore.getState().mainBalance, 7_000_000);
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useFinanceStore.getState().mainBalance, 5_000_000, 'balance restored');
    eq(useFinanceStore.getState().transactions.length, 0, 'txn removed');
  });

  await it('SET_CATEGORY_BUDGET undo: chưa có budget -> remove (không để lại limit 0)', async () => {
    const month = useBudgetStore.getState().currentMonth;
    useBudgetStore.setState({ categoryBudgets: [] });
    const r = req('SET_CATEGORY_BUDGET', { categoryId: 'food', monthlyLimit: 3_000_000 });
    const res = await executeMoneyActionOnClient(r);
    ok(useBudgetStore.getState().categoryBudgets.some((b) => b.categoryId === 'food' && b.month === month), 'created');
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    ok(!useBudgetStore.getState().categoryBudgets.some((b) => b.categoryId === 'food' && b.month === month), 'budget removed, not left at 0');
  });

  await it('removeCategoryBudget store method hoạt động đúng', async () => {
    const month = useBudgetStore.getState().currentMonth;
    useBudgetStore.setState({ categoryBudgets: [{ categoryId: 'coffee', monthlyLimit: 500_000, spent: 0, month }] });
    eq(useBudgetStore.getState().removeCategoryBudget('coffee', month), true);
    eq(useBudgetStore.getState().categoryBudgets.length, 0);
    eq(useBudgetStore.getState().removeCategoryBudget('coffee', month), false, 'idempotent: false khi không có');
  });

  await it('ADD_GOAL_DEPOSIT undo: restore currentAmount + đảo XP CHÍNH XÁC', async () => {
    useGoalsStore.setState({ goals: [{ id: 'g1', name: 'Quỹ', icon: '🛡️', targetAmount: 50_000_000, currentAmount: 10_000_000, deadline: '2026-12-31', color: '#22C55E', milestones: [], deposits: [], createdAt: '' }] });
    seedUser(1000);
    const r = req('ADD_GOAL_DEPOSIT', { goalId: 'g1', goalName: 'Quỹ', amount: 2_000_000 });
    const res = await executeMoneyActionOnClient(r);
    eq(useGoalsStore.getState().goals[0].currentAmount, 12_000_000);
    ok(useAuthStore.getState().user!.xp > 1000, 'XP granted on deposit');
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useGoalsStore.getState().goals[0].currentAmount, 10_000_000, 'currentAmount restored');
    eq(useGoalsStore.getState().goals[0].deposits?.length ?? 0, 0, 'deposit removed');
    eq(useAuthStore.getState().user!.xp, 1000, 'XP reversed exact');
  });

  await it('COMPLETE_EARNING_TASK undo: restore completedAt + penalty + XP', async () => {
    useTaskStore.setState({
      tasks: [{ id: 't1', name: 'Dạy kèm', expectedAmount: 2_000_000, startDate: '2026-06-01', endDate: '2026-06-20', subTasks: [{ id: 's1', name: 'a', isCompleted: false }], createdAt: '' }],
      xpPenalties: [{ taskId: 'old-overdue', penaltyMultiplier: 0.7, remainingTasks: 2 }],
    });
    seedUser(2000);
    const r = req('COMPLETE_EARNING_TASK', { taskId: 't1', taskName: 'Dạy kèm', expectedAmount: 2_000_000, actualAmount: 2_000_000 });
    const res = await executeMoneyActionOnClient(r);
    ok(!!useTaskStore.getState().tasks[0].completedAt, 'completed');
    eq(useTaskStore.getState().xpPenalties[0].remainingTasks, 1, 'penalty consumed -1');
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    eq(useTaskStore.getState().tasks[0].completedAt, undefined, 'completedAt cleared');
    eq(useTaskStore.getState().tasks[0].subTasks[0].isCompleted, false, 'sub-task restored to incomplete');
    eq(useTaskStore.getState().xpPenalties[0].remainingTasks, 2, 'penalty restored');
    eq(useAuthStore.getState().user!.xp, 2000, 'XP reversed exact');
  });

  await it('FLAG_TRANSACTION undo restore trạng thái cờ TRƯỚC (không blind toggle)', async () => {
    useFinanceStore.setState({ transactions: [{ id: 'tx1', type: 'expense', amount: 600_000, categoryId: 'clothing', note: '', wallet: 'main', date: '2026-06-13T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' }] });
    useBudgetStore.setState({ flaggedTransactionIds: ['tx1'] }); // ĐÃ flagged từ trước
    const r = req('FLAG_TRANSACTION', { transactionId: 'tx1' });
    const res = await executeMoneyActionOnClient(r); // toggle -> off
    ok(!useBudgetStore.getState().flaggedTransactionIds.includes('tx1'), 'toggled off');
    const undo = await undoMoneyActionOnClient(recordFrom(r, res));
    ok(undo.ok, 'undone');
    ok(useBudgetStore.getState().flaggedTransactionIds.includes('tx1'), 'restored về flagged (trạng thái trước)');
  });

  await it('double undo idempotent (lần 2 fail an toàn, không mutate lại)', async () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 1_000_000 });
    useAuthStore.setState({ user: null });
    const r = req('CREATE_EXPENSE', { amount: 100_000, categoryId: 'food', wallet: 'main' });
    const res = await executeMoneyActionOnClient(r);
    const rec = recordFrom(r, res);
    const u1 = await undoMoneyActionOnClient(rec);
    ok(u1.ok, 'undo 1 ok');
    eq(useFinanceStore.getState().mainBalance, 1_000_000);
    const u2 = await undoMoneyActionOnClient(rec);
    eq(u2.ok, false, 'undo 2 fail (idempotent)');
    eq(useFinanceStore.getState().mainBalance, 1_000_000, 'balance không bị mutate lần 2');
  });

  console.log('\nundo correctness test complete.');
}

main();
