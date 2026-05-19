/**
 * Account role mapping for the 3-account model (Phase 1).
 *
 * Maps semantic UI accounts (income / spending / saving) to physical
 * ledger account IDs. Used by selectors to aggregate balances and by
 * domain adapter to route events.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §2.3
 *   - docs/plans/phase-1-read-model.md §4
 *
 * Phase 1 NOTE: BILL_FUND remains in spending role because legacy
 * payBill() still deducts from it. Phase 4 will remove BILL_FUND from
 * this role mapping once payBill() is migrated to SPENDING.
 */

import {
  BILL_FUND_ACCOUNT_ID,
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from './accounts';
import type { AccountId } from './types';

export type AccountRole = 'income' | 'spending' | 'saving';
export type SavingBucket = 'reserve' | 'goals' | 'investment';

export const ROLE_TO_ACCOUNT_IDS: Record<AccountRole, readonly AccountId[]> = {
  income: [INCOME_ACCOUNT_ID],
  // Phase 1: BILL_FUND included for backward compat with payBill().
  // Phase 4 will reduce this to [SPENDING_ACCOUNT_ID] only.
  spending: [SPENDING_ACCOUNT_ID, BILL_FUND_ACCOUNT_ID],
  saving: [
    RESERVE_FUND_ACCOUNT_ID,
    GOAL_FUND_ACCOUNT_ID,
    INVESTMENT_FUND_ACCOUNT_ID,
  ],
} as const;

export const SAVING_BUCKET_TO_ACCOUNT_ID: Record<SavingBucket, AccountId> = {
  reserve: RESERVE_FUND_ACCOUNT_ID,
  goals: GOAL_FUND_ACCOUNT_ID,
  investment: INVESTMENT_FUND_ACCOUNT_ID,
} as const;

export function getAccountIdsForRole(role: AccountRole): readonly AccountId[] {
  return ROLE_TO_ACCOUNT_IDS[role];
}

export function getAccountIdForSavingBucket(bucket: SavingBucket): AccountId {
  return SAVING_BUCKET_TO_ACCOUNT_ID[bucket];
}

export function getRoleForAccountId(accountId: AccountId): AccountRole | null {
  for (const role of ['income', 'spending', 'saving'] as const) {
    if (ROLE_TO_ACCOUNT_IDS[role].includes(accountId)) return role;
  }
  return null;
}

export const ALL_ROLES: readonly AccountRole[] = ['income', 'spending', 'saving'] as const;
export const ALL_SAVING_BUCKETS: readonly SavingBucket[] = [
  'reserve',
  'goals',
  'investment',
] as const;
