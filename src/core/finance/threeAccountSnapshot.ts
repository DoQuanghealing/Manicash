/**
 * Three-account snapshot builder — single computation layer reused by
 * UI, tests, Firestore persistence, and synthetic user simulations.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §2-§4
 *   - docs/plans/phase-1-read-model.md §5.2
 *
 * ──────────────────────────────────────────────────────────────────
 * Design contract:
 *   - PURE function. Input ⇒ output. No I/O, no store access.
 *   - All data comes through ThreeAccountSnapshotInput. Caller is
 *     responsible for assembling it from whichever sources (Zustand,
 *     Firestore, fixture, etc.).
 *   - Output is plain JSON-serializable shape — safe to persist or
 *     transport over the wire.
 * ──────────────────────────────────────────────────────────────────
 */

import {
  getBillBudgetUsed,
  getDailyBudgetUsed,
  getIncomeBalance,
  getMonthlyBudget,
  getOverdueBills,
  getSafeToSpend,
  getSafeToSpendStatusV2,
  getSavingBalance,
  getSavingBreakdown,
  getSpendingBalance,
  getUnpaidBills,
  type FixedBillView,
  type SafeToSpendInputs,
  type SafeToSpendStatusV2,
  type SavingBreakdown,
} from './threeAccountSelectors';
import type { LedgerEntry } from './types';

// ════════════════════════════════════════════════════════════════════
//  Input / Output shapes
// ════════════════════════════════════════════════════════════════════

export interface ThreeAccountSnapshotInput {
  /** Engine ledger entries — single source of truth for balances. */
  ledger: readonly LedgerEntry[];
  /** Current month in 'YYYY-MM' format. */
  monthKey: string;
  /** Day of month (1-31) used for overdue bill detection. */
  today: number;
  /** Bills configured for this month. */
  fixedBills: readonly FixedBillView[];
  /** Sum of daily category limits (e.g. food, transport, ...). */
  dailySpendingLimit: number;
  /** Carry-over from previous month (ADR §6 = INCOME end-of-month balance). */
  carryOver: number;
  /** Planning target for monthly savings (NOT a balance). */
  monthlySavingsTarget: number;
  /** Total income received this month (event sum, not balance). */
  monthlyIncome: number;
}

export interface ThreeAccountSnapshot {
  income: {
    balance: number;
  };
  spending: {
    balance: number;
    monthlyBudget: number;
    dailyBudgetUsed: number;
    dailyBudgetRemaining: number;
    billBudgetUsed: number;
    billBudgetTotal: number;
    billBudgetRemaining: number;
    unpaidBills: FixedBillView[];
    overdueBills: FixedBillView[];
  };
  saving: {
    balance: number;
    breakdown: SavingBreakdown;
  };
  safeToSpend: {
    amount: number;
    status: SafeToSpendStatusV2;
    /** Inputs exposed for UI/debug — no recomputation needed. */
    inputs: SafeToSpendInputs;
  };
}

// ════════════════════════════════════════════════════════════════════
//  Main builder
// ════════════════════════════════════════════════════════════════════

export function buildThreeAccountSnapshot(
  input: ThreeAccountSnapshotInput,
): ThreeAccountSnapshot {
  const ledger = input.ledger as LedgerEntry[];

  // ── Balances ──
  const incomeBalance = getIncomeBalance(ledger);
  const spendingBalance = getSpendingBalance(ledger);
  const savingBalance = getSavingBalance(ledger);
  const savingBreakdownResult = getSavingBreakdown(ledger);

  // ── Budget ──
  const fixedBillsTotal = sumBillAmounts(input.fixedBills);
  const monthlyBudget = getMonthlyBudget({
    dailySpendingLimit: input.dailySpendingLimit,
    fixedBillsTotal,
  });
  const dailyBudgetUsed = getDailyBudgetUsed({
    ledger,
    monthKey: input.monthKey,
  });
  const billBudgetUsed = getBillBudgetUsed({
    ledger,
    monthKey: input.monthKey,
  });
  const dailyBudgetRemaining = Math.max(0, input.dailySpendingLimit - dailyBudgetUsed);
  const billBudgetRemaining = Math.max(0, fixedBillsTotal - billBudgetUsed);

  // ── Bills ──
  const unpaidBills = getUnpaidBills(input.fixedBills);
  const overdueBills = getOverdueBills({
    fixedBills: input.fixedBills,
    today: input.today,
  });

  // ── Safe-to-Spend ──
  const safeInputs: SafeToSpendInputs = {
    monthlyIncome: input.monthlyIncome,
    carryOver: input.carryOver,
    dailySpendingLimit: input.dailySpendingLimit,
    fixedBillsTotal,
    monthlySavingsTarget: input.monthlySavingsTarget,
  };
  const safeAmount = getSafeToSpend(safeInputs);
  const safeStatus = getSafeToSpendStatusV2(safeAmount);

  return {
    income: { balance: incomeBalance },
    spending: {
      balance: spendingBalance,
      monthlyBudget,
      dailyBudgetUsed,
      dailyBudgetRemaining,
      billBudgetUsed,
      billBudgetTotal: fixedBillsTotal,
      billBudgetRemaining,
      unpaidBills,
      overdueBills,
    },
    saving: {
      balance: savingBalance,
      breakdown: savingBreakdownResult,
    },
    safeToSpend: {
      amount: safeAmount,
      status: safeStatus,
      inputs: safeInputs,
    },
  };
}

// ════════════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════════════

function sumBillAmounts(bills: readonly FixedBillView[]): number {
  return bills.reduce((sum, bill) => sum + bill.amount, 0);
}
