import type { FinanceAccount } from './types';

export const MAIN_BANK_ACCOUNT_ID = 'main_bank';
export const SPENDING_ACCOUNT_ID = 'spending';
export const BILL_FUND_ACCOUNT_ID = 'bill_fund';
export const EMERGENCY_FUND_ACCOUNT_ID = 'emergency_fund';
export const GOAL_FUND_ACCOUNT_ID = 'goal_fund';
export const INVESTMENT_FUND_ACCOUNT_ID = 'investment_fund';
export const INCOME_CLEARING_ACCOUNT_ID = 'income_clearing';
export const EXPENSE_CLEARING_ACCOUNT_ID = 'expense_clearing';

export const DEFAULT_ACCOUNT_IDS = {
  MAIN_BANK: MAIN_BANK_ACCOUNT_ID,
  SPENDING: SPENDING_ACCOUNT_ID,
  BILL_FUND: BILL_FUND_ACCOUNT_ID,
  EMERGENCY_FUND: EMERGENCY_FUND_ACCOUNT_ID,
  GOAL_FUND: GOAL_FUND_ACCOUNT_ID,
  INVESTMENT_FUND: INVESTMENT_FUND_ACCOUNT_ID,
  INCOME_CLEARING: INCOME_CLEARING_ACCOUNT_ID,
  EXPENSE_CLEARING: EXPENSE_CLEARING_ACCOUNT_ID,
} as const;

export const DEFAULT_FINANCE_ACCOUNTS: FinanceAccount[] = [
  { id: MAIN_BANK_ACCOUNT_ID, name: 'Main Bank', kind: 'asset' },
  { id: SPENDING_ACCOUNT_ID, name: 'Spending', kind: 'asset' },
  { id: BILL_FUND_ACCOUNT_ID, name: 'Bill Fund', kind: 'asset' },
  { id: EMERGENCY_FUND_ACCOUNT_ID, name: 'Emergency Fund', kind: 'asset' },
  { id: GOAL_FUND_ACCOUNT_ID, name: 'Goal Fund', kind: 'asset' },
  { id: INVESTMENT_FUND_ACCOUNT_ID, name: 'Investment Fund', kind: 'asset' },
  { id: INCOME_CLEARING_ACCOUNT_ID, name: 'Income Clearing', kind: 'clearing' },
  { id: EXPENSE_CLEARING_ACCOUNT_ID, name: 'Expense Clearing', kind: 'clearing' },
];

export function getDefaultFinanceAccountIds(): string[] {
  return DEFAULT_FINANCE_ACCOUNTS.map((account) => account.id);
}
