import { useDashboardStore, type DashboardAccounts } from '@/stores/useDashboardStore';
import {
  useFinanceStore,
  type Transaction,
} from '@/stores/useFinanceStore';
import { getMonthKeyFromDate, parseMonthKey } from '@/lib/dateHelpers';

type TestFn = () => void;

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
    process.exitCode = 1;
  }
}

function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectMatch(actual: string, pattern: RegExp): void {
  if (!pattern.test(actual)) {
    throw new Error(`Expected ${actual} to match ${pattern}`);
  }
}

function makeAccounts(): DashboardAccounts {
  return {
    income: { balance: 0, icon: 'Wallet' },
    spending: { balance: 0, limit: 0, icon: 'ShoppingBag' },
    fixed_bills: { balance: 0, pending_count: 0, icon: 'CreditCard' },
    reserve: { balance: 0, is_locked: true, icon: 'Lock' },
    goals: { balance: 0, target: 0, icon: 'Target' },
    investment: { balance: 0, growth: '0%', icon: 'TrendingUp' },
  };
}

function resetStores(): void {
  useFinanceStore.setState({
    transactions: [],
    mainBalance: 10_000_000,
    emergencyBalance: 0,
    billFundBalance: 0,
    fixedBills: [],
    billSnapshots: [],
  });

  useDashboardStore.setState({
    accounts: makeAccounts(),
    monthlyContributions: {
      reserve: [],
      goals: [],
      investment: [],
    },
  });
}

function makeTransaction(id: string, type: 'income' | 'expense', amount: number, date: string): Transaction {
  return {
    id,
    type,
    kind: type,
    amount,
    categoryId: type,
    note: id,
    wallet: 'main',
    date: `${date}T10:00:00.000Z`,
    time: '10:00',
    dateLabel: date,
    dateKey: date,
  };
}

describe('FINDING #3 - split audit', () => {
  it('splitFunds tao split transaction trong ledger', () => {
    resetStores();

    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 10_000_000,
      billPercent: 50,
      savingsPercent: 50,
      savingsBreakdown: { reserve: 40, goals: 40, investment: 20 },
    });

    const finance = useFinanceStore.getState();
    const splitTxn = finance.transactions.find((txn) => txn.id === result.splitTransactionId);

    expectEqual(finance.mainBalance, 0);
    expectEqual(finance.billFundBalance, 5_000_000);
    expectEqual(splitTxn?.kind, 'split');
    expectEqual(splitTxn?.amount, 10_000_000);
    expectEqual(splitTxn?.splitBreakdown?.billFund, 5_000_000);
    expectEqual(splitTxn?.splitBreakdown?.reserve, 2_000_000);
    expectEqual(splitTxn?.splitBreakdown?.goals, 2_000_000);
    expectEqual(splitTxn?.splitBreakdown?.investment, 1_000_000);
  });

  it('rollback khi addSplitTransaction fail', () => {
    resetStores();
    const originalAddSplitTransaction = useFinanceStore.getState().addSplitTransaction;

    useFinanceStore.setState({
      addSplitTransaction: () => {
        throw new Error('forced addSplitTransaction failure');
      },
    });

    try {
      try {
        useDashboardStore.getState().splitFunds({
          sourceAmount: 10_000_000,
          billPercent: 50,
          savingsPercent: 50,
          savingsBreakdown: { reserve: 40, goals: 40, investment: 20 },
        });
      } catch {
        // Expected.
      }

      const finance = useFinanceStore.getState();
      const dashboard = useDashboardStore.getState();

      expectEqual(finance.mainBalance, 10_000_000);
      expectEqual(finance.billFundBalance, 0);
      expectEqual(finance.transactions.length, 0);
      expectEqual(dashboard.accounts.reserve.balance, 0);
      expectEqual(dashboard.accounts.goals.balance, 0);
      expectEqual(dashboard.accounts.investment.balance, 0);
    } finally {
      useFinanceStore.setState({ addSplitTransaction: originalAddSplitTransaction });
    }
  });
});

describe('FINDING #6 - monthly getters', () => {
  it('getIncomeForMonth tra dung so theo monthKey', () => {
    resetStores();
    useFinanceStore.setState({
      transactions: [
        makeTransaction('jul-income', 'income', 1_000_000, '2025-07-10'),
        makeTransaction('aug-income', 'income', 2_000_000, '2025-08-10'),
        makeTransaction('aug-expense', 'expense', 300_000, '2025-08-11'),
      ],
    });

    const finance = useFinanceStore.getState();
    expectEqual(finance.getIncomeForMonth('2025-07'), 1_000_000);
    expectEqual(finance.getIncomeForMonth('2025-08'), 2_000_000);
    expectEqual(finance.getExpenseForMonth('2025-08'), 300_000);
  });

  it('getCurrentMonthKey format YYYY-MM', () => {
    expectMatch(useFinanceStore.getState().getCurrentMonthKey(), /^\d{4}-\d{2}$/);
    expectEqual(getMonthKeyFromDate('2025-08-10T00:00:00.000Z'), '2025-08');
    expectEqual(parseMonthKey('2025-08').month, 8);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
