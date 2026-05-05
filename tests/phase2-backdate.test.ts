import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import type { MonthlySnapshot } from '@/types/budget';

type TestFn = () => void | Promise<void>;

function describe(name: string, fn: TestFn): void {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
  }
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toThrow: (expectedMsg?: string) => {
      let threw = false;
      try {
        actual();
      } catch (e: any) {
        threw = true;
        if (expectedMsg && !e.message.includes(expectedMsg)) {
          throw new Error(`Expected error containing "${expectedMsg}" but got "${e.message}"`);
        }
      }
      if (!threw) {
        throw new Error('Expected function to throw but it did not');
      }
    }
  };
}

function makeSnapshot(month: string, overrides?: Partial<MonthlySnapshot>): MonthlySnapshot {
  return {
    month,
    incomeTotal: 0,
    expenseTotal: 0,
    savingTotal: 0,
    carryOver: 0,
    budgetLimits: [],
    ...overrides,
  };
}

function setup() {
  useFinanceStore.setState({
    transactions: [],
    mainBalance: 1000,
    emergencyBalance: 0,
    billFundBalance: 0,
  });
}

describe('Phase 2 - Fix A: Backdate Transaction', () => {
  it('addTransaction throws if backdated more than 30 days', () => {
    setup();
    expect(() => {
      useFinanceStore.getState().addTransaction({
        type: 'expense',
        amount: 100,
        categoryId: 'food',
        note: '',
        wallet: 'main',
        transactionDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      });
    }).toThrow('Không thể backdate quá 30 ngày');
  });

  it('addTransaction throws if future date', () => {
    setup();
    expect(() => {
      useFinanceStore.getState().addTransaction({
        type: 'income',
        amount: 100,
        categoryId: 'salary',
        note: '',
        wallet: 'main',
        transactionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
    }).toThrow('Không thể nhập transaction ngày trong tương lai');
  });

  it('addTransaction with valid backdate updates previous month snapshot', () => {
    setup();
    
    const now = new Date();
    const txnDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    const prevMonthKey = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Set up a real MonthlySnapshot with the correct 'month' field (NOT monthKey)
    useBudgetStore.setState({
      monthlySnapshots: [makeSnapshot(prevMonthKey, { incomeTotal: 500, expenseTotal: 200 })],
    });

    useFinanceStore.getState().addTransaction({
      type: 'income',
      amount: 1500,
      categoryId: 'salary',
      note: 'Late salary',
      wallet: 'main',
      transactionDate: txnDate,
    });

    // Check transaction was added with correct dateKey
    const txns = useFinanceStore.getState().transactions;
    expect(txns.length).toBe(1);

    // Check snapshot update — updateSnapshotTotals should find snapshot by s.month
    const snapshots = useBudgetStore.getState().monthlySnapshots;
    const prevSnap = snapshots.find(s => s.month === prevMonthKey);
    expect(prevSnap?.incomeTotal).toBe(1500);
  });

  it('addTransaction skipping update if no snapshot exists (no fake snapshot)', () => {
    setup();
    const now = new Date();
    const txnDate = new Date(now.getFullYear(), now.getMonth(), 0);
    
    useBudgetStore.setState({ monthlySnapshots: [] });

    useFinanceStore.getState().addTransaction({
      type: 'expense',
      amount: 100,
      categoryId: 'food',
      note: '',
      wallet: 'main',
      transactionDate: txnDate,
    });

    const snapshots = useBudgetStore.getState().monthlySnapshots;
    expect(snapshots.length).toBe(0);
  });
});
