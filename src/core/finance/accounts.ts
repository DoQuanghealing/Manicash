import type { FinanceAccount } from './types';

/**
 * ═══ Ledger Account IDs ═══
 *
 * Phase 1 of 3-account migration introduces semantic names
 * (INCOME_ACCOUNT_ID, RESERVE_FUND_ACCOUNT_ID) but KEEPS the legacy
 * string values ('main_bank', 'emergency_fund') so existing ledger
 * entries do not need to be rewritten.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §2.2, §7
 *   - docs/plans/phase-1-read-model.md §4.1
 *
 * Phase 5+ may migrate string values, but Phase 1-4 must keep them as-is
 * for backward compatibility with existing user data.
 */

/**
 * @deprecated Renamed semantic. Prefer INCOME_ACCOUNT_ID.
 * Kept as alias to avoid breaking existing imports. Removed in Phase 5.
 */
export const MAIN_BANK_ACCOUNT_ID = 'main_bank';

/**
 * Tài khoản thu nhập — nơi tiền vào trước (lương, freelance, thưởng...).
 * NOTE: Technical legacy ID = 'main_bank' (intentional — see file header).
 * User-facing name: "Tài khoản thu nhập".
 */
export const INCOME_ACCOUNT_ID = MAIN_BANK_ACCOUNT_ID;

export const SPENDING_ACCOUNT_ID = 'spending';

/**
 * @deprecated Phase 4 removes BILL_FUND khỏi top-level. Bills merged into Spending.
 * Trong Phase 1-3 vẫn giữ để legacy payBill() chạy.
 */
export const BILL_FUND_ACCOUNT_ID = 'bill_fund';

/**
 * @deprecated Renamed semantic. Prefer RESERVE_FUND_ACCOUNT_ID.
 * Kept as alias. Removed in Phase 5.
 */
export const EMERGENCY_FUND_ACCOUNT_ID = 'emergency_fund';

/**
 * Quỹ dự phòng — sub-bucket của Tài khoản tiết kiệm.
 * NOTE: Technical legacy ID = 'emergency_fund' (intentional).
 * User-facing name: "Dự phòng".
 */
export const RESERVE_FUND_ACCOUNT_ID = EMERGENCY_FUND_ACCOUNT_ID;

export const GOAL_FUND_ACCOUNT_ID = 'goal_fund';
export const INVESTMENT_FUND_ACCOUNT_ID = 'investment_fund';
export const INCOME_CLEARING_ACCOUNT_ID = 'income_clearing';
export const EXPENSE_CLEARING_ACCOUNT_ID = 'expense_clearing';

export const DEFAULT_ACCOUNT_IDS = {
  /** @deprecated Prefer INCOME — same value */
  MAIN_BANK: MAIN_BANK_ACCOUNT_ID,
  INCOME: INCOME_ACCOUNT_ID,
  SPENDING: SPENDING_ACCOUNT_ID,
  BILL_FUND: BILL_FUND_ACCOUNT_ID,
  /** @deprecated Prefer RESERVE — same value */
  EMERGENCY_FUND: EMERGENCY_FUND_ACCOUNT_ID,
  RESERVE: RESERVE_FUND_ACCOUNT_ID,
  GOAL_FUND: GOAL_FUND_ACCOUNT_ID,
  INVESTMENT_FUND: INVESTMENT_FUND_ACCOUNT_ID,
  INCOME_CLEARING: INCOME_CLEARING_ACCOUNT_ID,
  EXPENSE_CLEARING: EXPENSE_CLEARING_ACCOUNT_ID,
} as const;

export const DEFAULT_FINANCE_ACCOUNTS: FinanceAccount[] = [
  { id: INCOME_ACCOUNT_ID, name: 'Tài khoản thu nhập', kind: 'asset' },
  { id: SPENDING_ACCOUNT_ID, name: 'Tài khoản chi tiêu', kind: 'asset' },
  { id: BILL_FUND_ACCOUNT_ID, name: 'Bill Fund (legacy)', kind: 'asset' },
  { id: RESERVE_FUND_ACCOUNT_ID, name: 'Dự phòng', kind: 'asset' },
  { id: GOAL_FUND_ACCOUNT_ID, name: 'Mục tiêu', kind: 'asset' },
  { id: INVESTMENT_FUND_ACCOUNT_ID, name: 'Đầu tư', kind: 'asset' },
  { id: INCOME_CLEARING_ACCOUNT_ID, name: 'Income Clearing', kind: 'clearing' },
  { id: EXPENSE_CLEARING_ACCOUNT_ID, name: 'Expense Clearing', kind: 'clearing' },
];

export function getDefaultFinanceAccountIds(): string[] {
  return DEFAULT_FINANCE_ACCOUNTS.map((account) => account.id);
}
