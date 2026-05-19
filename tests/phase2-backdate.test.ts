import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { getDateKey } from '@/lib/dateHelpers';
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

describe('Phase 2 - Fix B: Fund Contribution Date Propagation', () => {
  it('addFundContribution với occurredAt → contribution vào đúng month', () => {
    useDashboardStore.setState({ monthlyContributions: {} });
    const pastDate = new Date('2026-04-15T10:00:00Z');
    useDashboardStore.getState().addFundContribution('reserve', 1000000, pastDate);
    
    const contribs = useDashboardStore.getState().monthlyContributions;
    const monthKey = '2026-04';
    expect(contribs.reserve?.length).toBe(1);
    expect(contribs.reserve![0].month).toBe(monthKey);
    expect(contribs.reserve![0].amount).toBe(1000000);
  });
  
  it('addFundContribution không pass occurredAt → fallback current month', () => {
    useDashboardStore.setState({ monthlyContributions: {} });
    useDashboardStore.getState().addFundContribution('goals', 500000);
    
    const contribs = useDashboardStore.getState().monthlyContributions;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(contribs.goals?.length).toBe(1);
    expect(contribs.goals![0].month).toBe(monthKey);
  });
  
  it('splitFunds với occurredAt → split transaction date = occurredAt', () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 1000000, billFundBalance: 0 });
    const prevAccs = useDashboardStore.getState().accounts;
    useDashboardStore.setState({ 
      monthlyContributions: {}, 
      accounts: { 
        ...prevAccs, 
        reserve: { ...prevAccs.reserve, balance: 0 }, 
        goals: { ...prevAccs.goals, balance: 0 }, 
        investment: { ...prevAccs.investment, balance: 0 } 
      } 
    });
    
    const pastDate = new Date('2026-04-10T10:00:00Z');
    useDashboardStore.getState().splitFunds({
      sourceAmount: 1000000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 50, goals: 30, investment: 20 },
      occurredAt: pastDate,
    });
    
    const txns = useFinanceStore.getState().transactions;
    const splitTxn = txns.find(t => t.kind === 'split');
    if (!splitTxn) throw new Error("Expected splitTxn to exist");
    
    expect(splitTxn.dateKey).toBe('2026-04-10');
    
    const contribs = useDashboardStore.getState().monthlyContributions;
    expect(contribs.reserve![0].month).toBe('2026-04');
  });
  
  it('splitFunds với sourceTransactionId fallback → dùng date của source txn', () => {
    const pastDate = new Date('2026-04-20T10:00:00Z');
    useFinanceStore.setState({ 
      transactions: [{
        id: 'txn-source',
        type: 'income',
        amount: 1000000,
        categoryId: 'salary',
        note: '',
        wallet: 'main',
        date: pastDate.toISOString(),
        time: '10:00',
        dateLabel: '20/04',
        dateKey: '2026-04-20',
      }], 
      mainBalance: 1000000, 
      billFundBalance: 0 
    });
    useDashboardStore.setState({ monthlyContributions: {} });
    
    useDashboardStore.getState().splitFunds({
      sourceAmount: 1000000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 50, goals: 30, investment: 20 },
      sourceTransactionId: 'txn-source'
    });
    
    const txns = useFinanceStore.getState().transactions;
    const splitTxn = txns.find(t => t.kind === 'split');
    if (!splitTxn) throw new Error("Expected splitTxn to exist");
    
    expect(splitTxn.dateKey).toBe('2026-04-20');
  });
  
  it('splitFunds không có occurredAt và sourceTransactionId → new Date()', () => {
    useFinanceStore.setState({ transactions: [], mainBalance: 1000000, billFundBalance: 0 });
    useDashboardStore.setState({ monthlyContributions: {} });
    
    useDashboardStore.getState().splitFunds({
      sourceAmount: 1000000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 50, goals: 30, investment: 20 }
    });
    
    const txns = useFinanceStore.getState().transactions;
    const splitTxn = txns.find(t => t.kind === 'split');
    if (!splitTxn) throw new Error("Expected splitTxn to exist");
    
    const now = new Date();
    const todayKey = getDateKey(new Date());
    expect(splitTxn.dateKey).toBe(todayKey);
  });
  
  it('addFundContribution timezone consistency với ledger dateKey', () => {
    // setup: backdate vào edge case ngày cuối tháng
    const edgeDate = new Date('2026-04-30T22:00:00.000Z');
    // (tương đương 5h sáng 1/5 ở VN UTC+7)
    
    useFinanceStore.setState({ transactions: [], mainBalance: 1000000, emergencyBalance: 0, billFundBalance: 0 });
    useDashboardStore.setState({ monthlyContributions: {} });

    // action: 
    // 1. addTransaction({ ..., transactionDate: edgeDate })
    useFinanceStore.getState().addTransaction({
      type: 'income',
      amount: 1000000,
      categoryId: 'salary',
      note: 'Late salary',
      wallet: 'main',
      transactionDate: edgeDate,
    });
    // 2. addFundContribution('reserve', 1tr, edgeDate)
    useDashboardStore.getState().addFundContribution('reserve', 1000000, edgeDate);
    
    // expect: 
    // - Transaction dateKey và contribution month đều consistent
    const txn = useFinanceStore.getState().transactions[0];
    const contrib = useDashboardStore.getState().monthlyContributions.reserve![0];

    // Transaction dateKey và contribution month đều consistent
    expect(contrib.month).toBe(txn.dateKey.substring(0, 7));
  });
});

describe('Phase 2 - Fix D: Split funds validation', () => {
  function setupForSplit() {
    useFinanceStore.setState({ transactions: [], mainBalance: 10_000_000, billFundBalance: 0 });
    useDashboardStore.setState({ monthlyContributions: {} });
  }

  it('tổng bill+savings > 100 → throw', () => {
    setupForSplit();
    expect(() => {
      useDashboardStore.getState().splitFunds({
        sourceAmount: 1_000_000,
        billPercent: 60,
        savingsPercent: 50,
        savingsBreakdown: { reserve: 40, goals: 40, investment: 20 },
      });
    }).toThrow('Tổng % vượt 100');
  });

  it('% âm cho billPercent → throw', () => {
    setupForSplit();
    expect(() => {
      useDashboardStore.getState().splitFunds({
        sourceAmount: 1_000_000,
        billPercent: -10,
        savingsPercent: 50,
        savingsBreakdown: { reserve: 40, goals: 40, investment: 20 },
      });
    }).toThrow('billPercent không được âm');
  });

  it('% âm cho sub-savings (reserve) → throw', () => {
    setupForSplit();
    expect(() => {
      useDashboardStore.getState().splitFunds({
        sourceAmount: 1_000_000,
        billPercent: 10,
        savingsPercent: 90,
        savingsBreakdown: { reserve: -10, goals: 60, investment: 50 },
      });
    }).toThrow('reserve không được âm');
  });

  it('sub-savings tổng = 0 (0/0/0) khi savings > 0 → default 100% vào Dự phòng', () => {
    // Per user spec: tiết kiệm = dự phòng + mục tiêu + đầu tư. Khi user
    // không phân bổ sub-bucket nào → mặc định dồn hết vào Dự phòng.
    setupForSplit();
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 0, goals: 0, investment: 0 },
    });
    expect(result.billAmount).toBe(100_000);
    expect(result.reserveAmount).toBe(900_000);
    expect(result.goalsAmount).toBe(0);
    expect(result.investmentAmount).toBe(0);
    expect(result.totalDeducted).toBe(1_000_000);
  });

  it('sub-savings = 100 đúng → PASS (happy path)', () => {
    setupForSplit();
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 50, goals: 30, investment: 20 },
    });
    expect(result.billAmount).toBe(100_000);
    expect(result.totalDeducted).toBe(1_000_000);
  });

  it('rounding tolerance: 33.33 + 33.33 + 33.34 = 100.00 → PASS', () => {
    setupForSplit();
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 33.33, goals: 33.33, investment: 33.34 },
    });
    // Should not throw — within tolerance
    expect(result.sourceAmount).toBe(1_000_000);
  });

  it('rounding tolerance: 33.33 + 33.33 + 33.33 = 99.99 → PASS', () => {
    setupForSplit();
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 33.33, goals: 33.33, investment: 33.33 },
    });
    // 99.99 → |99.99 - 100| = 0.01 < 0.1 tolerance → PASS
    expect(result.sourceAmount).toBe(1_000_000);
  });

  it('sub-savings 33.33+33.33+33.32 = 99.98 → within tolerance → PASS', () => {
    setupForSplit();
    // |99.98 - 100| = 0.02 < 0.1 tolerance → should PASS
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 33.33, goals: 33.33, investment: 33.32 },
    });
    expect(result.sourceAmount).toBe(1_000_000);
  });

  it('sub-savings drifts (99.5) → normalize theo tỷ lệ giữ nguyên', () => {
    // Per user spec: drift ngoài tolerance → normalize, không throw.
    // factor = 100/99.5 ≈ 1.00503
    setupForSplit();
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 10,
      savingsPercent: 90,
      savingsBreakdown: { reserve: 33, goals: 33, investment: 33.5 },
    });
    // Sum of sub-amounts == savingsTotal (900_000), no fund lost to drift.
    expect(result.totalDeducted).toBe(1_000_000);
    expect(result.reserveAmount + result.goalsAmount + result.investmentAmount).toBe(900_000);
  });

  it('sourceAmount = 0 → throw early, không tạo split transaction', () => {
    setupForSplit();
    const txnCountBefore = useFinanceStore.getState().transactions.length;
    expect(() => {
      useDashboardStore.getState().splitFunds({
        sourceAmount: 0,
        billPercent: 50,
        savingsPercent: 50,
        savingsBreakdown: { reserve: 40, goals: 40, investment: 20 },
      });
    }).toThrow('Số tiền chia phải > 0');
    // No transaction should have been created
    expect(useFinanceStore.getState().transactions.length).toBe(txnCountBefore);
  });

  it('savingsPercent = 0 → skip sub-savings validation → PASS', () => {
    setupForSplit();
    // When savings is 0, sub-savings breakdown doesn't matter
    const result = useDashboardStore.getState().splitFunds({
      sourceAmount: 1_000_000,
      billPercent: 100,
      savingsPercent: 0,
      savingsBreakdown: { reserve: 0, goals: 0, investment: 0 },
    });
    expect(result.billAmount).toBe(1_000_000);
    expect(result.reserveAmount).toBe(0);
  });
});

