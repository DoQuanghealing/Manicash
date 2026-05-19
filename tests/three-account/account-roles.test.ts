/**
 * Tests cho src/core/finance/accountRoles.ts
 *
 * Verifies role mapping coverage + helper functions.
 */

import {
  ALL_ROLES,
  ALL_SAVING_BUCKETS,
  ROLE_TO_ACCOUNT_IDS,
  SAVING_BUCKET_TO_ACCOUNT_ID,
  getAccountIdForSavingBucket,
  getAccountIdsForRole,
  getRoleForAccountId,
} from '@/core/finance/accountRoles';
import {
  BILL_FUND_ACCOUNT_ID,
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  MAIN_BANK_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  EMERGENCY_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import { describe, it, expectDeepEqual, expectEqual, expectTrue } from './harness';

describe('accountRoles — ROLE_TO_ACCOUNT_IDS', () => {
  it('income role maps to INCOME_ACCOUNT_ID only', () => {
    expectDeepEqual([...ROLE_TO_ACCOUNT_IDS.income], [INCOME_ACCOUNT_ID]);
  });

  it('spending role contains SPENDING + BILL_FUND in Phase 1', () => {
    expectDeepEqual(
      [...ROLE_TO_ACCOUNT_IDS.spending],
      [SPENDING_ACCOUNT_ID, BILL_FUND_ACCOUNT_ID],
    );
  });

  it('saving role contains 3 sub-buckets in canonical order', () => {
    expectDeepEqual(
      [...ROLE_TO_ACCOUNT_IDS.saving],
      [RESERVE_FUND_ACCOUNT_ID, GOAL_FUND_ACCOUNT_ID, INVESTMENT_FUND_ACCOUNT_ID],
    );
  });

  it('ALL_ROLES has exactly 3 entries', () => {
    expectEqual(ALL_ROLES.length, 3);
  });
});

describe('accountRoles — SAVING_BUCKET_TO_ACCOUNT_ID', () => {
  it('reserve maps to RESERVE_FUND_ACCOUNT_ID', () => {
    expectEqual(SAVING_BUCKET_TO_ACCOUNT_ID.reserve, RESERVE_FUND_ACCOUNT_ID);
  });

  it('goals maps to GOAL_FUND_ACCOUNT_ID', () => {
    expectEqual(SAVING_BUCKET_TO_ACCOUNT_ID.goals, GOAL_FUND_ACCOUNT_ID);
  });

  it('investment maps to INVESTMENT_FUND_ACCOUNT_ID', () => {
    expectEqual(SAVING_BUCKET_TO_ACCOUNT_ID.investment, INVESTMENT_FUND_ACCOUNT_ID);
  });

  it('ALL_SAVING_BUCKETS has exactly 3 entries', () => {
    expectEqual(ALL_SAVING_BUCKETS.length, 3);
  });
});

describe('accountRoles — helpers', () => {
  it('getAccountIdsForRole returns same array as map lookup', () => {
    expectDeepEqual([...getAccountIdsForRole('saving')], [...ROLE_TO_ACCOUNT_IDS.saving]);
  });

  it('getAccountIdForSavingBucket returns canonical id', () => {
    expectEqual(getAccountIdForSavingBucket('reserve'), RESERVE_FUND_ACCOUNT_ID);
    expectEqual(getAccountIdForSavingBucket('goals'), GOAL_FUND_ACCOUNT_ID);
    expectEqual(getAccountIdForSavingBucket('investment'), INVESTMENT_FUND_ACCOUNT_ID);
  });

  it('getRoleForAccountId returns income for INCOME_ACCOUNT_ID', () => {
    expectEqual(getRoleForAccountId(INCOME_ACCOUNT_ID), 'income');
  });

  it('getRoleForAccountId returns spending for SPENDING + BILL_FUND', () => {
    expectEqual(getRoleForAccountId(SPENDING_ACCOUNT_ID), 'spending');
    expectEqual(getRoleForAccountId(BILL_FUND_ACCOUNT_ID), 'spending');
  });

  it('getRoleForAccountId returns saving for 3 sub-buckets', () => {
    expectEqual(getRoleForAccountId(RESERVE_FUND_ACCOUNT_ID), 'saving');
    expectEqual(getRoleForAccountId(GOAL_FUND_ACCOUNT_ID), 'saving');
    expectEqual(getRoleForAccountId(INVESTMENT_FUND_ACCOUNT_ID), 'saving');
  });

  it('getRoleForAccountId returns null for unknown account id', () => {
    expectEqual(getRoleForAccountId('unknown_account'), null);
    expectEqual(getRoleForAccountId(''), null);
  });
});

describe('accountRoles — legacy alias consistency', () => {
  it('INCOME_ACCOUNT_ID === MAIN_BANK_ACCOUNT_ID (alias chain)', () => {
    expectEqual(INCOME_ACCOUNT_ID, MAIN_BANK_ACCOUNT_ID);
    expectEqual(INCOME_ACCOUNT_ID, 'main_bank');
  });

  it('RESERVE_FUND_ACCOUNT_ID === EMERGENCY_FUND_ACCOUNT_ID (alias chain)', () => {
    expectEqual(RESERVE_FUND_ACCOUNT_ID, EMERGENCY_FUND_ACCOUNT_ID);
    expectEqual(RESERVE_FUND_ACCOUNT_ID, 'emergency_fund');
  });

  it('Legacy string values preserved (Phase 1 invariant LA7)', () => {
    // This test will FAIL if anyone accidentally changes the string values.
    // That's intentional — string values are part of the migration contract.
    expectTrue(INCOME_ACCOUNT_ID === 'main_bank');
    expectTrue(RESERVE_FUND_ACCOUNT_ID === 'emergency_fund');
  });
});
