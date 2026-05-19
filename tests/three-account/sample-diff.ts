/**
 * Day 4 diff sample — prints both legacy AccountOverviewSnapshot and
 * new ThreeAccountSnapshot side-by-side from identical seed state.
 *
 * Purpose: surface to leadership the *semantic* difference between the
 * two shapes so Phase 2 UI work has a clear migration target.
 *
 * Run via:
 *   node -e "process.env.JITI_ALIAS=JSON.stringify({'@':process.cwd()+'/src'});
 *            require('jiti/register');
 *            require('./tests/three-account/sample-diff.ts')"
 */

import {
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import { FLAGS } from '@/lib/featureFlags';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import {
  getAccountOverviewSnapshot,
  getThreeAccountSnapshot,
} from '@/stores/useAccountOverviewStore';
import {
  buildLedger,
  expenseEvent,
  incomeEvent,
  resetFixtureState,
  SAMPLE_BILLS,
  transferEvent,
} from './fixtures';

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

useFinanceCoreStore.setState({ ledgerEntries: ledger, events: [], lastError: undefined });

useFinanceStore.setState({
  transactions: [
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

// Flip flag ON for the new snapshot path.
(FLAGS as { NEW_THREE_ACCOUNT_MODEL: boolean }).NEW_THREE_ACCOUNT_MODEL = true;

const legacy = getAccountOverviewSnapshot();
const next = getThreeAccountSnapshot();

console.log('═══════════════════════════════════════════════════════════');
console.log('  LEGACY  AccountOverviewSnapshot.accounts');
console.log('═══════════════════════════════════════════════════════════');
console.log(JSON.stringify({
  income: {
    amount: legacy.accounts.income.amount,
    meta: legacy.accounts.income.meta,
  },
  expense: {
    amount: legacy.accounts.expense.amount,
    subAccounts: legacy.accounts.expense.subAccounts.map((s) => ({
      id: s.id, label: s.label, amount: s.amount, limit: s.limit,
    })),
    meta: legacy.accounts.expense.meta,
  },
  saving: {
    amount: legacy.accounts.saving.amount,
    subAccounts: legacy.accounts.saving.subAccounts.map((s) => ({
      id: s.id, label: s.label, amount: s.amount,
    })),
    meta: legacy.accounts.saving.meta,
  },
  safeToSpend: {
    amount: legacy.safeToSpend.amount,
    status: legacy.safeToSpend.status,
    monthlyIncome: legacy.safeToSpend.monthlyIncome,
    spendingLimit: legacy.safeToSpend.spendingLimit,
    fixedBills: legacy.safeToSpend.fixedBills,
    monthlySavings: legacy.safeToSpend.monthlySavings,
  },
}, null, 2));

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  NEW  ThreeAccountSnapshot');
console.log('═══════════════════════════════════════════════════════════');
console.log(JSON.stringify(next, null, 2));

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  KEY SEMANTIC DIFFERENCES');
console.log('═══════════════════════════════════════════════════════════');
console.log(`
Legacy "income.amount"        = monthly INFLOW (sum of income txns)        = ${legacy.accounts.income.amount}
New   "income.balance"        = REMAINING in Income account (unallocated)  = ${next?.income.balance ?? 'n/a'}

Legacy "expense.amount"       = monthly OUTFLOW (sum of expense txns)      = ${legacy.accounts.expense.amount}
New   "spending.balance"      = REMAINING in Spending account              = ${next?.spending.balance ?? 'n/a'}
New   "spending.dailyBudgetUsed"  = ${next?.spending.dailyBudgetUsed ?? 'n/a'} (matches legacy expense)

Legacy "saving.amount"        = monthly CONTRIBUTION (new deposits)        = ${legacy.accounts.saving.amount}
New   "saving.balance"        = TOTAL accumulated saving balance           = ${next?.saving.balance ?? 'n/a'}

Safe-to-Spend numbers:
  Legacy = ${legacy.safeToSpend.amount}  (status: ${legacy.safeToSpend.status})
  New    = ${next?.safeToSpend.amount}  (status: ${next?.safeToSpend.status})
  → IDENTICAL when monthlySavingsTarget mirrors monthlyContributions (Phase 1 default)

Phase 2 UI migration:
  - Replace "income.amount" badge with "income.balance" (showing unallocated)
  - Replace "expense.amount" total with breakdown of dailyBudgetUsed + billBudgetUsed
  - Replace "saving.amount" (monthly) with "saving.balance" (total) on Overview;
    drill-down still uses sub-bucket monthly contributions
`);
