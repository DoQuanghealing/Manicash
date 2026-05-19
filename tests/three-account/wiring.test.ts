/**
 * Day 4 — Wiring integration tests.
 *
 * Verifies the dual-read API in `useAccountOverviewStore`:
 *   1. `getThreeAccountSnapshot()` returns null when flag OFF
 *   2. Returns a valid ThreeAccountSnapshot when flag ON
 *   3. Legacy `getAccountOverviewSnapshot()` is UNTOUCHED regardless of flag
 *   4. `assembleThreeAccountSnapshotInput` is a pure helper (no store reads)
 *
 * NOTE on flag flipping: FLAGS object is frozen at module load. To exercise
 * both flag states in one test run, this suite uses `FLAGS` direct mutation
 * via `Object.assign` — supported because the FLAGS const is a plain object
 * (TypeScript `as const` is compile-time only, not runtime frozen).
 */

import { executeFinanceEvent } from '@/core/finance/engine';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import {
  assembleThreeAccountSnapshotInput,
  getAccountOverviewSnapshot,
  getThreeAccountSnapshot,
} from '@/stores/useAccountOverviewStore';
import { FLAGS } from '@/lib/featureFlags';
import {
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import {
  buildLedger,
  expenseEvent,
  incomeEvent,
  resetFixtureState,
  SAMPLE_BILLS,
  transferEvent,
} from './fixtures';
import {
  describe,
  expectEqual,
  expectTrue,
  it,
} from './harness';

// ════════════════════════════════════════════════════════════════════
//  Flag manipulation helpers
// ════════════════════════════════════════════════════════════════════

function setFlag(value: boolean): void {
  // Direct mutation — see header note.
  (FLAGS as { NEW_THREE_ACCOUNT_MODEL: boolean }).NEW_THREE_ACCOUNT_MODEL = value;
}

function withFlag<T>(value: boolean, fn: () => T): T {
  const previous = FLAGS.NEW_THREE_ACCOUNT_MODEL;
  setFlag(value);
  try {
    return fn();
  } finally {
    setFlag(previous);
  }
}

// ════════════════════════════════════════════════════════════════════
//  Seed: reset stores + seed ledger via engine
// ════════════════════════════════════════════════════════════════════

function seedStoresForTest(): void {
  resetFixtureState();
  const ledger = buildLedger([
    incomeEvent(19_111_550, { occurredAt: '2026-05-01T09:00:00.000Z' }),
    transferEvent(14_950_000, INCOME_ACCOUNT_ID, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:05:00.000Z',
    }),
    transferEvent(800_000, INCOME_ACCOUNT_ID, RESERVE_FUND_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:06:00.000Z',
    }),
    transferEvent(500_000, INCOME_ACCOUNT_ID, GOAL_FUND_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:07:00.000Z',
    }),
    transferEvent(400_000, INCOME_ACCOUNT_ID, INVESTMENT_FUND_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:08:00.000Z',
    }),
    expenseEvent(120_000, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-03T12:00:00.000Z',
      metadata: { categoryId: 'food', isBill: false },
    }),
  ]);

  // Push ledger into FinanceCore via the engine (replay events).
  // Easier: directly hydrate the store.
  useFinanceCoreStore.setState({ ledgerEntries: ledger, events: [], lastError: undefined });

  useFinanceStore.setState({
    transactions: [
      // Income txn so getIncomeForMonth returns the expected number.
      {
        id: 'seed-inc',
        type: 'income',
        kind: 'income',
        amount: 19_111_550,
        categoryId: 'salary',
        note: 'Seed income',
        wallet: 'main',
        date: '2026-05-01T09:00:00.000Z',
        time: '09:00',
        dateLabel: '01/05',
        dateKey: '2026-05-01',
      },
    ],
    mainBalance: 2_461_550,
    emergencyBalance: 800_000,
    billFundBalance: 0,
    fixedBills: SAMPLE_BILLS.map((b) => ({
      id: b.id,
      name: b.name ?? b.id,
      icon: b.icon ?? '💰',
      amount: b.amount,
      dueDay: b.dueDay,
      isPaid: b.isPaid,
    })),
    billSnapshots: [],
  });

  useBudgetStore.setState({
    carryOver: 800_000,
    currentMonth: '2026-05',
    categoryBudgets: [
      { categoryId: 'food', monthlyLimit: 4_000_000, spent: 120_000, month: '2026-05' },
      { categoryId: 'transport', monthlyLimit: 5_800_000, spent: 0, month: '2026-05' },
    ],
    rolloverNotified: true,
    monthlySnapshots: [],
    unviewedReportMonth: null,
    xpAtMonthStart: 0,
  });

  useDashboardStore.setState({
    monthlyContributions: {
      reserve: [{ month: '2026-05', amount: 800_000, createdAt: '2026-05-01T09:06:00.000Z' }],
      goals: [{ month: '2026-05', amount: 500_000, createdAt: '2026-05-01T09:07:00.000Z' }],
      investment: [{ month: '2026-05', amount: 400_000, createdAt: '2026-05-01T09:08:00.000Z' }],
    },
  });
}

// ════════════════════════════════════════════════════════════════════
//  Tests
// ════════════════════════════════════════════════════════════════════

describe('getThreeAccountSnapshot — flag gate', () => {
  it('returns null when NEW_THREE_ACCOUNT_MODEL is OFF', () => {
    seedStoresForTest();
    withFlag(false, () => {
      const result = getThreeAccountSnapshot();
      expectEqual(result, null);
    });
  });

  it('returns a snapshot when NEW_THREE_ACCOUNT_MODEL is ON', () => {
    seedStoresForTest();
    withFlag(true, () => {
      const result = getThreeAccountSnapshot();
      expectTrue(result !== null, 'snapshot should be non-null');
      if (result) {
        // Income should reflect unallocated remainder from ledger
        expectEqual(result.income.balance, 2_461_550);
        // Spending balance after one 120k expense
        expectEqual(result.spending.balance, 14_950_000 - 120_000);
        // Saving total 800k + 500k + 400k
        expectEqual(result.saving.balance, 1_700_000);
        expectEqual(result.saving.breakdown.reserve, 800_000);
        expectEqual(result.saving.breakdown.goals, 500_000);
        expectEqual(result.saving.breakdown.investment, 400_000);
      }
    });
  });
});

describe('Legacy getAccountOverviewSnapshot — unaffected by flag (LA1)', () => {
  it('shape unchanged when flag OFF', () => {
    seedStoresForTest();
    let off: ReturnType<typeof getAccountOverviewSnapshot> | null = null;
    withFlag(false, () => {
      off = getAccountOverviewSnapshot();
    });
    expectTrue(off !== null);
    if (off) {
      expectTrue('accounts' in off);
      expectTrue('safeToSpend' in off);
      expectTrue('coreBalances' in off);
      expectTrue(off.accounts.income !== undefined);
      expectTrue(off.accounts.expense !== undefined);
      expectTrue(off.accounts.saving !== undefined);
    }
  });

  it('produces equal output regardless of flag state (LA1)', () => {
    seedStoresForTest();
    const off = withFlag(false, () => getAccountOverviewSnapshot());
    const on = withFlag(true, () => getAccountOverviewSnapshot());
    // Snapshot may have non-deterministic month/date helpers; compare
    // the deterministic numeric core to validate equivalence.
    expectEqual(off.accounts.income.amount, on.accounts.income.amount);
    expectEqual(off.accounts.expense.amount, on.accounts.expense.amount);
    expectEqual(off.accounts.saving.amount, on.accounts.saving.amount);
    expectEqual(off.safeToSpend.amount, on.safeToSpend.amount);
    expectEqual(off.safeToSpend.status, on.safeToSpend.status);
    expectEqual(off.coreBalances.totalSavingsBalance, on.coreBalances.totalSavingsBalance);
  });
});

describe('assembleThreeAccountSnapshotInput — purity', () => {
  it('reads only from provided args (deterministic output for fixed input)', () => {
    seedStoresForTest();
    const finance = useFinanceStore.getState();
    const budget = useBudgetStore.getState();
    const dashboard = useDashboardStore.getState();
    const ledgerEntries = useFinanceCoreStore.getState().ledgerEntries;

    const a = assembleThreeAccountSnapshotInput({ finance, budget, dashboard, ledgerEntries });
    const b = assembleThreeAccountSnapshotInput({ finance, budget, dashboard, ledgerEntries });

    // Compare key numeric fields. (today depends on Date.now() so we only
    // assert it stays equal across two adjacent calls in same test tick.)
    expectEqual(a.monthlyIncome, b.monthlyIncome);
    expectEqual(a.dailySpendingLimit, b.dailySpendingLimit);
    expectEqual(a.carryOver, b.carryOver);
    expectEqual(a.monthlySavingsTarget, b.monthlySavingsTarget);
    expectEqual(a.fixedBills.length, b.fixedBills.length);
    expectEqual(a.today, b.today);
  });

  it('monthlyIncome matches getIncomeForMonth from store', () => {
    seedStoresForTest();
    const finance = useFinanceStore.getState();
    const budget = useBudgetStore.getState();
    const dashboard = useDashboardStore.getState();
    const ledgerEntries = useFinanceCoreStore.getState().ledgerEntries;

    const input = assembleThreeAccountSnapshotInput({
      finance,
      budget,
      dashboard,
      ledgerEntries,
    });

    expectEqual(input.monthlyIncome, finance.getIncomeForMonth(finance.getCurrentMonthKey()));
  });

  it('carryOver matches budget.carryOver from store', () => {
    seedStoresForTest();
    const input = assembleThreeAccountSnapshotInput({
      finance: useFinanceStore.getState(),
      budget: useBudgetStore.getState(),
      dashboard: useDashboardStore.getState(),
      ledgerEntries: useFinanceCoreStore.getState().ledgerEntries,
    });
    expectEqual(input.carryOver, 800_000);
  });

  it('fixedBills are projected to FixedBillView shape (id/amount/dueDay/isPaid)', () => {
    seedStoresForTest();
    const input = assembleThreeAccountSnapshotInput({
      finance: useFinanceStore.getState(),
      budget: useBudgetStore.getState(),
      dashboard: useDashboardStore.getState(),
      ledgerEntries: useFinanceCoreStore.getState().ledgerEntries,
    });
    expectTrue(input.fixedBills.length > 0);
    const first = input.fixedBills[0];
    expectTrue(typeof first.id === 'string');
    expectTrue(typeof first.amount === 'number');
    expectTrue(typeof first.dueDay === 'number');
    expectTrue(typeof first.isPaid === 'boolean');
  });
});

describe('end-to-end: assembled input → builder → snapshot', () => {
  it('flag ON produces snapshot whose values match the legacy numeric core', () => {
    seedStoresForTest();
    withFlag(true, () => {
      const newSnap = getThreeAccountSnapshot();
      const legacySnap = getAccountOverviewSnapshot();
      expectTrue(newSnap !== null);
      if (newSnap) {
        // Saving balance from ledger should equal core totalSavingsBalance.
        expectEqual(newSnap.saving.balance, legacySnap.coreBalances.totalSavingsBalance);

        // Monthly income from new = legacy income.amount (both = monthly inflow).
        expectEqual(
          newSnap.safeToSpend.inputs.monthlyIncome,
          legacySnap.accounts.income.amount,
        );
      }
    });
  });
});

// Engine sanity — make sure executeFinanceEvent import is used so lint
// doesn't flag (kept available for future wiring tests that exercise
// store mutations going through engine).
void executeFinanceEvent;
