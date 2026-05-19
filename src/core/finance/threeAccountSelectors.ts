/**
 * Pure selectors for the 3-account model.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §2-§4
 *   - docs/plans/phase-1-read-model.md §5
 *
 * ──────────────────────────────────────────────────────────────────
 * INVARIANTS (LA3):
 *   1. Every export is a PURE function — no side effects, no I/O.
 *   2. NO imports from `@/stores/*` — selectors must not read Zustand.
 *   3. All inputs are explicit. Callers pass data; selectors compute.
 *   4. Math is integer-VND-safe. Caller is responsible for rounding.
 * ──────────────────────────────────────────────────────────────────
 *
 * 11 selectors:
 *   1. getIncomeBalance
 *   2. getSpendingBalance
 *   3. getSavingBalance
 *   4. getSavingBreakdown
 *   5. getMonthlyBudget
 *   6. getDailyBudgetUsed
 *   7. getBillBudgetUsed
 *   8. getUnpaidBills
 *   9. getOverdueBills
 *  10. getSafeToSpend
 *  11. getSafeToSpendStatusV2
 */

import {
  BILL_FUND_ACCOUNT_ID,
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from './accounts';
import { getAccountBalance } from './selectors';
import type { FinanceMetadataValue, LedgerEntry } from './types';

// ════════════════════════════════════════════════════════════════════
//  Shared types (kept in this file to avoid cross-domain leaks)
// ════════════════════════════════════════════════════════════════════

/** Minimal view of a fixed bill, decoupled from useFinanceStore.FixedBill. */
export interface FixedBillView {
  id: string;
  amount: number;
  dueDay: number;
  isPaid: boolean;
  /** Optional display fields — selectors don't use them but tests may. */
  name?: string;
  icon?: string;
}

export interface SavingBreakdown {
  reserve: number;
  goals: number;
  investment: number;
  total: number;
}

export type SafeToSpendStatusV2 = 'safe' | 'low' | 'negative';

// ════════════════════════════════════════════════════════════════════
//  1. Income / Spending / Saving balances
// ════════════════════════════════════════════════════════════════════

/**
 * SELECTOR 1 — Số dư Tài khoản thu nhập.
 * Tiền user đã nhận nhưng chưa allocate sang Spending/Saving.
 */
export function getIncomeBalance(ledger: LedgerEntry[]): number {
  return getAccountBalance(ledger, INCOME_ACCOUNT_ID);
}

/**
 * SELECTOR 2 — Số dư Tài khoản chi tiêu.
 *
 * Phase 1: gộp SPENDING + BILL_FUND vì legacy `payBill()` vẫn trừ
 * `billFundBalance`. Phase 4 sẽ remove BILL_FUND khỏi tổng này khi
 * payBill chuyển sang trừ Spending account.
 */
export function getSpendingBalance(ledger: LedgerEntry[]): number {
  return (
    getAccountBalance(ledger, SPENDING_ACCOUNT_ID) +
    getAccountBalance(ledger, BILL_FUND_ACCOUNT_ID)
  );
}

/**
 * SELECTOR 3 — Tổng Tài khoản tiết kiệm (3 sub-buckets cộng lại).
 */
export function getSavingBalance(ledger: LedgerEntry[]): number {
  const { total } = getSavingBreakdown(ledger);
  return total;
}

/**
 * SELECTOR 4 — Breakdown tiết kiệm theo 3 sub-buckets.
 * Overview UI hiển thị 1 số tổng (= `total`), drill-down hiện 3 sub-buckets.
 */
export function getSavingBreakdown(ledger: LedgerEntry[]): SavingBreakdown {
  const reserve = getAccountBalance(ledger, RESERVE_FUND_ACCOUNT_ID);
  const goals = getAccountBalance(ledger, GOAL_FUND_ACCOUNT_ID);
  const investment = getAccountBalance(ledger, INVESTMENT_FUND_ACCOUNT_ID);
  return { reserve, goals, investment, total: reserve + goals + investment };
}

// ════════════════════════════════════════════════════════════════════
//  5-7. Monthly budget + usage
// ════════════════════════════════════════════════════════════════════

export interface MonthlyBudgetInputs {
  /** Tổng ngân sách chi tiêu hằng ngày (sum of category limits). */
  dailySpendingLimit: number;
  /** Tổng bill cố định trong tháng. */
  fixedBillsTotal: number;
}

/**
 * SELECTOR 5 — Ngân sách tháng = daily + bills.
 * Theo ADR §4.1: `monthlyBudget = dailySpendingLimit + fixedBillsTotal`.
 */
export function getMonthlyBudget(inputs: MonthlyBudgetInputs): number {
  return inputs.dailySpendingLimit + inputs.fixedBillsTotal;
}

export interface BudgetUsedInputs {
  ledger: LedgerEntry[];
  /** Month in YYYY-MM format. */
  monthKey: string;
}

/**
 * SELECTOR 6 — Đã chi hằng ngày trong tháng (KHÔNG tính bill).
 *
 * Filter rule (ledger semantics from src/core/finance/ledger.ts):
 *   - eventType === 'CREATE_EXPENSE'
 *   - direction === 'credit' — money LEAVES the spending account
 *     (asset decreases ⇒ credit; the offsetting debit is on
 *     EXPENSE_CLEARING, which we skip to avoid double counting)
 *   - accountId === SPENDING_ACCOUNT_ID
 *   - month matches
 *   - metadata.isBill !== true
 */
export function getDailyBudgetUsed(inputs: BudgetUsedInputs): number {
  return inputs.ledger
    .filter((entry) => entryIsExpenseInMonth(entry, inputs.monthKey))
    .filter((entry) => readMetadataBoolean(entry.metadata, 'isBill') !== true)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * SELECTOR 7 — Đã trả bill trong tháng (chỉ entries có isBill=true).
 */
export function getBillBudgetUsed(inputs: BudgetUsedInputs): number {
  return inputs.ledger
    .filter((entry) => entryIsExpenseInMonth(entry, inputs.monthKey))
    .filter((entry) => readMetadataBoolean(entry.metadata, 'isBill') === true)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

// ════════════════════════════════════════════════════════════════════
//  8-9. Bill state (unpaid / overdue)
// ════════════════════════════════════════════════════════════════════

/**
 * SELECTOR 8 — Bills chưa trả trong tháng hiện tại.
 * ADR §14: `bill còn nợ = !isPaid` trong tháng.
 */
export function getUnpaidBills(fixedBills: readonly FixedBillView[]): FixedBillView[] {
  return fixedBills.filter((bill) => !bill.isPaid);
}

export interface OverdueBillsInputs {
  fixedBills: readonly FixedBillView[];
  /** Day of month (1-31). Used to detect "dueDay đã trôi qua". */
  today: number;
}

/**
 * SELECTOR 9 — Bills quá hạn (chưa trả + dueDay < today).
 * ADR §14: `bill quá hạn = !isPaid && dueDay < today` (strictly less than).
 */
export function getOverdueBills(inputs: OverdueBillsInputs): FixedBillView[] {
  return inputs.fixedBills.filter((bill) => !bill.isPaid && bill.dueDay < inputs.today);
}

// ════════════════════════════════════════════════════════════════════
//  10-11. Safe-to-Spend (planning metric, NOT a balance)
// ════════════════════════════════════════════════════════════════════

export interface SafeToSpendInputs {
  /** Tổng thu nhập đã nhận trong tháng. */
  monthlyIncome: number;
  /** Dư từ tháng trước (Income carryOver per ADR §6). */
  carryOver: number;
  /** Tổng ngân sách chi tiêu hằng ngày (= sum category limits). */
  dailySpendingLimit: number;
  /** Tổng bills cố định trong tháng. */
  fixedBillsTotal: number;
  /** Mục tiêu tiết kiệm tháng (kế hoạch — KHÔNG phải balance). */
  monthlySavingsTarget: number;
}

/**
 * SELECTOR 10 — Safe-to-Spend (planning metric).
 *
 * ADR §4.1:
 *   SafeToSpend = monthlyIncome + carryOver
 *               − dailySpendingLimit − fixedBillsTotal − monthlySavingsTarget
 *
 * QUAN TRỌNG: đây KHÔNG phải số dư account nào. Tiền đại diện cho
 * Safe-to-Spend có thể vẫn nằm ở `INCOME_ACCOUNT` — user vẫn dùng được,
 * chỉ là app cho biết "đây là phần còn lại an toàn sau khi đã lo
 * chi tiêu + tiết kiệm tháng này".
 */
export function getSafeToSpend(inputs: SafeToSpendInputs): number {
  return (
    inputs.monthlyIncome +
    inputs.carryOver -
    inputs.dailySpendingLimit -
    inputs.fixedBillsTotal -
    inputs.monthlySavingsTarget
  );
}

/**
 * SELECTOR 11 — Safe-to-Spend status (3 mức).
 *
 * ADR §4.3 (leadership-locked):
 *   - safe:     > 1.000.000đ
 *   - low:      0đ ≤ x ≤ 1.000.000đ
 *   - negative: < 0đ
 *
 * UI tone: status `negative` dùng cam/vàng (không đỏ rực), copy coaching
 * theo §4.4. Cấm dùng từ "vỡ kế hoạch", "âm tiền", "nguy hiểm".
 */
export function getSafeToSpendStatusV2(amount: number): SafeToSpendStatusV2 {
  if (amount < 0) return 'negative';
  if (amount <= 1_000_000) return 'low';
  return 'safe';
}

// ════════════════════════════════════════════════════════════════════
//  Internal helpers (not exported)
// ════════════════════════════════════════════════════════════════════

function entryIsExpenseInMonth(entry: LedgerEntry, monthKey: string): boolean {
  return (
    entry.eventType === 'CREATE_EXPENSE' &&
    entry.direction === 'credit' &&
    entry.accountId === SPENDING_ACCOUNT_ID &&
    monthKeyFromIso(entry.occurredAt) === monthKey
  );
}

function monthKeyFromIso(isoDate: string): string {
  // 'YYYY-MM-DDTHH:mm:ss...' → 'YYYY-MM'
  return isoDate.slice(0, 7);
}

function readMetadataBoolean(
  metadata: Record<string, FinanceMetadataValue> | undefined,
  key: string,
): boolean | null {
  if (!metadata) return null;
  const value = metadata[key];
  if (typeof value === 'boolean') return value;
  return null;
}
