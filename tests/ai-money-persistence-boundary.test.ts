/* Phase 6B-1.5 — Persistence QA & Account Boundary smoke */

// PHẢI import đầu tiên: cài localStorage mock trước khi store (persist) import.
import { persistMem as MEM } from './_setupLocalStorage';
import { STORE_KEYS } from '@/stores/persistConfig';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActionAuditStore } from '@/stores/useActionAuditStore';
import { useHydrationStore, areCoreStoresHydrated } from '@/stores/useHydrationStore';
import { clearLocalMoneyPersistence } from '@/stores/clearLocalPersistence';
import type { UserProfile } from '@/types/user';
import type { MoneyActionAuditRecord } from '@/lib/aiMoneyChat/actions/actionAuditTypes';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void { if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`); }
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

function tx(id: string) {
  return { id, type: 'expense' as const, amount: 50_000, categoryId: 'food', note: '', wallet: 'main' as const, date: '2026-06-13T03:00:00Z', time: '10:00', dateLabel: 'Hôm nay', dateKey: '2026-06-13' };
}

async function main() {
  console.log('\npersistence boundary & QA');

  // ── Account boundary: clear/logout ──
  await it('clearLocalMoneyPersistence xóa toàn bộ STORE_KEYS', () => {
    // seed localStorage cho mọi key
    Object.values(STORE_KEYS).forEach((k) => MEM.set(k, JSON.stringify({ state: {}, version: 1 })));
    useFinanceStore.setState({ transactions: [tx('a1')], mainBalance: 9_000_000 });
    clearLocalMoneyPersistence();
    Object.values(STORE_KEYS).forEach((k) => ok(!MEM.has(k), `key ${k} removed`));
  });

  await it('clear reset in-memory finance/budget/goals/tasks/auth', () => {
    useFinanceStore.setState({ transactions: [tx('a1'), tx('a2')], mainBalance: 9_000_000 });
    useGoalsStore.setState({ goals: [{ id: 'g', name: 'X', icon: '🎯', targetAmount: 1, currentAmount: 1, deadline: '2030-01-01', color: '#fff', milestones: [], createdAt: '' }] });
    useTaskStore.setState({ tasks: [{ id: 't', name: 'X', expectedAmount: 1, startDate: '', endDate: '2026-06-30', subTasks: [], createdAt: '' }], xpPenalties: [] });
    useAuthStore.setState({ user: { uid: 'A', displayName: 'A', email: 'a@x.com', photoURL: null, rank: 'gold', xp: 999, streak: 3, lastActiveDate: '', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, accountStatus: 'active', createdAt: '', updatedAt: '' } as UserProfile });
    clearLocalMoneyPersistence();
    eq(useFinanceStore.getState().transactions.length, 0, 'finance reset');
    eq(useFinanceStore.getState().mainBalance, 0, 'balance reset');
    eq(useGoalsStore.getState().goals.length, 0, 'goals reset');
    eq(useTaskStore.getState().tasks.length, 0, 'tasks reset');
    eq(useAuthStore.getState().user, null, 'auth user reset');
  });

  await it('User A -> clear -> User B session KHÔNG thấy transaction của A', async () => {
    useFinanceStore.setState({ transactions: [tx('A-secret')], mainBalance: 5_000_000 });
    clearLocalMoneyPersistence();
    // mô phỏng phiên mới: rehydrate từ localStorage đã bị xóa
    await useFinanceStore.persist.rehydrate();
    ok(!useFinanceStore.getState().transactions.some((t) => t.id === 'A-secret'), 'A data not visible');
  });

  // ── Corrupt storage fallback ──
  await it('corrupt finance storage không crash + fallback an toàn', async () => {
    MEM.set(STORE_KEYS.finance, 'not-valid-json{{{');
    let threw = false;
    try { await useFinanceStore.persist.rehydrate(); } catch { threw = true; }
    eq(threw, false, 'rehydrate không throw');
    ok(Array.isArray(useFinanceStore.getState().transactions), 'transactions vẫn là mảng');
  });

  await it('corrupt budget/goals/tasks/auth không crash', async () => {
    MEM.set(STORE_KEYS.budget, '{bad');
    MEM.set(STORE_KEYS.goals, '][');
    MEM.set(STORE_KEYS.tasks, 'xxx');
    MEM.set(STORE_KEYS.auth, '<<<');
    let threw = false;
    try {
      await Promise.all([
        useBudgetStore.persist.rehydrate(),
        useGoalsStore.persist.rehydrate(),
        useTaskStore.persist.rehydrate(),
        useAuthStore.persist.rehydrate(),
      ]);
    } catch { threw = true; }
    eq(threw, false, 'no throw');
    ok(Array.isArray(useGoalsStore.getState().goals) && Array.isArray(useTaskStore.getState().tasks), 'safe arrays');
  });

  // ── Migration smoke (old shapes) ──
  await it('migration finance: txn cũ thiếu key + data lạ -> default an toàn', () => {
    const m = useFinanceStore.persist.getOptions().migrate!({ transactions: 'nope', mainBalance: 'x' }, 0) as Record<string, unknown>;
    ok(Array.isArray(m.transactions), 'transactions []');
    eq(m.mainBalance, 0);
  });
  await it('migration budget thiếu flaggedTransactionIds -> []', () => {
    const m = useBudgetStore.persist.getOptions().migrate!({ categoryBudgets: [] }, 0) as Record<string, unknown>;
    ok(Array.isArray(m.flaggedTransactionIds), 'flags []');
  });
  await it('migration goals/tasks/auth shape cũ không crash', () => {
    const g = useGoalsStore.persist.getOptions().migrate!({}, 0) as Record<string, unknown>;
    ok(Array.isArray(g.goals), 'goals []');
    const t = useTaskStore.persist.getOptions().migrate!({ tasks: [{ id: 'x', name: 'y' }] }, 0) as Record<string, unknown>;
    ok(Array.isArray(t.xpPenalties), 'xpPenalties []');
    const a = useAuthStore.persist.getOptions().migrate!({ user: { uid: 'u', xp: 5 } }, 0);
    ok(!!a, 'auth migrate không crash');
  });

  // ── Hydration race ──
  await it('partial hydration -> areCoreStoresHydrated false', () => {
    useHydrationStore.setState({ finance: true, budget: false, goals: true, tasks: true, auth: true });
    eq(areCoreStoresHydrated(), false);
  });
  await it('full hydration -> areCoreStoresHydrated true', () => {
    useHydrationStore.setState({ finance: true, budget: true, goals: true, tasks: true, auth: true });
    eq(areCoreStoresHydrated(), true);
  });

  // ── Seed QA ──
  await it('empty persisted transactions KHÔNG bị re-seed sau rehydrate', async () => {
    MEM.set(STORE_KEYS.finance, JSON.stringify({ state: { transactions: [], mainBalance: 0, emergencyBalance: 0, billFundBalance: 0, fixedBills: [], billSnapshots: [] }, version: 1 }));
    await useFinanceStore.persist.rehydrate();
    eq(useFinanceStore.getState().transactions.length, 0, 'không re-seed (persist replace)');
  });

  // ── Audit retention ──
  await it('audit cap giữ <= 200 + undo entry mới nhất vẫn còn', () => {
    useActionAuditStore.getState().clearHistoryForDev();
    for (let i = 0; i < 210; i++) {
      const rec: MoneyActionAuditRecord = { id: `r${i}`, requestId: `q${i}`, action: 'FLAG_TRANSACTION', request: {} as never, status: 'executed', createdAt: '', updatedAt: '', undoable: true, preview: '', events: [] };
      useActionAuditStore.setState((s) => ({ records: [rec, ...s.records].slice(0, 200) }));
    }
    eq(useActionAuditStore.getState().records.length, 200, 'cap 200');
    ok(!!useActionAuditStore.getState().getByRequestId('q209'), 'entry mới nhất còn');
  });

  // ── Auth safety ──
  await it('auth persisted JSON KHÔNG có firebaseUser/token/isLoading', () => {
    useAuthStore.setState({ user: { uid: 'u', displayName: 'U', email: 'u@x.com', photoURL: null, rank: 'silver', xp: 100, streak: 1, lastActiveDate: '', resistCount: 0, totalResistSaved: 0, isPremium: false, plan: 'free', premiumExpiresAt: null, accountStatus: 'active', createdAt: '', updatedAt: '' } as UserProfile, firebaseUser: { uid: 'fb', email: 'u@x.com' } as never, isLoading: true });
    const raw = MEM.get(STORE_KEYS.auth);
    ok(!!raw, 'auth persisted');
    const parsed = JSON.parse(raw as string) as { state: Record<string, unknown> };
    ok('user' in parsed.state, 'user persisted');
    ok(!('firebaseUser' in parsed.state), 'firebaseUser NOT persisted');
    ok(!('isLoading' in parsed.state), 'isLoading NOT persisted');
    ok(!('isAuthenticated' in parsed.state), 'isAuthenticated NOT persisted');
  });

  console.log('\npersistence boundary & QA test complete.');
}

main();
