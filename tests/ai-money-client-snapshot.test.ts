import { buildClientSnapshot } from '@/lib/aiMoneyChat/clientSnapshot';
import { getCurrentMonthKey } from '@/lib/dateHelpers';
import type { Transaction, FixedBill } from '@/stores/useFinanceStore';
import type { EarningTask } from '@/types/task';
import type { Goal, CategoryBudget } from '@/types/budget';

type TestFn = () => void;
function describe(name: string): void {
  console.log(`\n${name}`);
}
function it(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}
function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`Expected ${label} to be true`);
}

const MK = getCurrentMonthKey();
const [y, m] = MK.split('-').map(Number);
const prevMonthKey = (n: number) => {
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: 'tx', type: 'expense', amount: 0, categoryId: 'food', note: '', wallet: 'main',
    date: `${MK}-05T12:00:00.000Z`, time: '12:00', dateLabel: '', dateKey: '',
    ...over,
  } as Transaction;
}

const bills: FixedBill[] = [{ id: 'b1', name: 'Tiền điện', icon: '', amount: 350_000, dueDay: 10, isPaid: true }];
const tasks: EarningTask[] = [{
  id: 't1', name: 'Viết bài', expectedAmount: 1_000_000, startDate: `${MK}-01`, endDate: `${MK}-28`,
  subTasks: [{ id: 's1', name: 'x', isCompleted: true }, { id: 's2', name: 'y', isCompleted: false }], createdAt: `${MK}-01`,
}];
const goals: Goal[] = [{
  id: 'g1', name: 'Mua xe', icon: '', targetAmount: 50_000_000, currentAmount: 12_000_000,
  deadline: '2026-12-01', color: '', milestones: [], createdAt: `${MK}-01`,
}];
const budgets: CategoryBudget[] = [{ categoryId: 'food', monthlyLimit: 2_000_000, spent: 0, month: MK }];

describe('buildClientSnapshot()');
it('map wallets + bills + tasks + goals + budgets', () => {
  const snap = buildClientSnapshot({
    wallets: { main: 4_500_000, emergency: 6_000_000, billFund: 1_200_000 },
    transactions: [txn({ type: 'income', amount: 20_000_000, categoryId: 'salary' })],
    fixedBills: bills,
    tasks,
    goals,
    categoryBudgets: budgets,
    categoryName: (id) => (id === 'food' ? 'Ăn uống' : id),
  });
  expectEqual(snap.monthKey, MK);
  expectEqual(snap.wallets!.main, 4_500_000);
  expectEqual(snap.bills!.length, 1);
  expectEqual(snap.bills![0].name, 'Tiền điện');
  expectEqual(snap.tasks!.length, 1);
  expectEqual(snap.tasks![0].subTasks!.length, 2);
  expectEqual(snap.goals![0].savedAmount, 12_000_000);
  expectEqual(snap.budgets![0].name, 'Ăn uống');
  expectEqual(snap.transactions!.length, 1);
  expectEqual(snap.transactions![0].type, 'income');
});

it('chỉ lấy giao dịch tháng hiện tại; transfer set toWallet', () => {
  const snap = buildClientSnapshot({
    wallets: { main: 1, emergency: 1, billFund: 1 },
    transactions: [
      txn({ amount: 100_000 }), // tháng này
      txn({ amount: 999_000, date: `${prevMonthKey(1)}-05T12:00:00.000Z` }), // tháng trước -> loại khỏi transactions
      txn({ type: 'transfer', amount: 2_000_000, wallet: 'emergency' }),
    ],
    fixedBills: [],
    tasks: [],
    goals: [],
    categoryBudgets: [],
    categoryName: (id) => id,
  });
  expectEqual(snap.transactions!.length, 2); // chỉ 2 giao dịch tháng này
  const transfer = snap.transactions!.find((t) => t.type === 'transfer')!;
  expectEqual(transfer.toWallet, 'emergency');
});

it('history gom chi theo danh mục 3 tháng trước', () => {
  const snap = buildClientSnapshot({
    wallets: { main: 1, emergency: 1, billFund: 1 },
    transactions: [
      txn({ amount: 100_000, categoryId: 'food' }), // tháng này -> KHÔNG vào history
      txn({ amount: 800_000, categoryId: 'shopping', date: `${prevMonthKey(1)}-05T12:00:00.000Z` }),
      txn({ amount: 850_000, categoryId: 'shopping', date: `${prevMonthKey(2)}-05T12:00:00.000Z` }),
    ],
    fixedBills: [],
    tasks: [],
    goals: [],
    categoryBudgets: [],
    categoryName: (id) => id,
  });
  expectTrue(snap.history!.length === 2, 'history 2 tháng trước');
  const hasShopping = snap.history!.every((h) => typeof h.categorySpend!.shopping === 'number');
  expectTrue(hasShopping, 'history có shopping spend');
  // tháng hiện tại không lọt vào history
  expectTrue(!snap.history!.some((h) => h.monthKey === MK), 'không có tháng hiện tại');
});

console.log('\nClient snapshot builder test complete.');
