/**
 * Unit tests for the 11 pure selectors in threeAccountSelectors.ts.
 */

import {
  BILL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import {
  getBillBudgetUsed,
  getDailyBudgetUsed,
  getIncomeBalance,
  getMonthlyBudget,
  getOverdueBills,
  getSafeToSpendStatusV2,
  getSavingBalance,
  getSavingBreakdown,
  getSpendingBalance,
  getUnpaidBills,
} from '@/core/finance/threeAccountSelectors';
import {
  buildLedger,
  emptyLedger,
  fullySeededFixture,
  incomeEvent,
  multiMonthFixture,
  resetFixtureState,
  SAMPLE_BILLS,
  SAMPLE_BILLS_ALL_PAID,
  SAMPLE_BILLS_NONE_PAID,
  transferEvent,
  unallocatedIncomeFixture,
} from './fixtures';
import { describe, expectEqual, it } from './harness';

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 1 — getIncomeBalance
// ════════════════════════════════════════════════════════════════════

describe('getIncomeBalance', () => {
  it('empty ledger returns 0', () => {
    expectEqual(getIncomeBalance(emptyLedger()), 0);
  });

  it('after CREATE_INCOME, balance equals income amount', () => {
    expectEqual(getIncomeBalance(unallocatedIncomeFixture()), 19_111_550);
  });

  it('after seed allocation, income balance = income - allocated', () => {
    // 19_111_550 - 14_950_000 - 800_000 - 500_000 - 400_000 = 2_461_550
    expectEqual(getIncomeBalance(fullySeededFixture()), 2_461_550);
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 2 — getSpendingBalance (Phase 1 = SPENDING + BILL_FUND)
// ════════════════════════════════════════════════════════════════════

describe('getSpendingBalance', () => {
  it('empty ledger returns 0', () => {
    expectEqual(getSpendingBalance(emptyLedger()), 0);
  });

  it('after transfer + 2 expenses + 1 bill paid', () => {
    // 14_950_000 - 120_000 - 80_000 - 2_500_000 = 12_250_000
    expectEqual(getSpendingBalance(fullySeededFixture()), 12_250_000);
  });

  it('includes BILL_FUND balance (legacy Phase 1 invariant)', () => {
    resetFixtureState();
    const ledger = buildLedger([
      incomeEvent(10_000_000),
      transferEvent(5_000_000, INCOME_ACCOUNT_ID, SPENDING_ACCOUNT_ID),
      transferEvent(2_000_000, INCOME_ACCOUNT_ID, BILL_FUND_ACCOUNT_ID),
    ]);
    expectEqual(getSpendingBalance(ledger), 7_000_000);
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 3 — getSavingBalance
// ════════════════════════════════════════════════════════════════════

describe('getSavingBalance', () => {
  it('empty ledger returns 0', () => {
    expectEqual(getSavingBalance(emptyLedger()), 0);
  });

  it('sums all 3 sub-buckets', () => {
    // reserve 800k + goals 500k + investment 400k = 1_700_000
    expectEqual(getSavingBalance(fullySeededFixture()), 1_700_000);
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 4 — getSavingBreakdown
// ════════════════════════════════════════════════════════════════════

describe('getSavingBreakdown', () => {
  it('empty ledger returns all zeros', () => {
    const b = getSavingBreakdown(emptyLedger());
    expectEqual(b.reserve, 0);
    expectEqual(b.goals, 0);
    expectEqual(b.investment, 0);
    expectEqual(b.total, 0);
  });

  it('seed fixture: reserve 800k, goals 500k, investment 400k, total 1.7M', () => {
    const b = getSavingBreakdown(fullySeededFixture());
    expectEqual(b.reserve, 800_000);
    expectEqual(b.goals, 500_000);
    expectEqual(b.investment, 400_000);
    expectEqual(b.total, 1_700_000);
  });

  it('total matches getSavingBalance for any ledger', () => {
    const ledger = fullySeededFixture();
    expectEqual(getSavingBreakdown(ledger).total, getSavingBalance(ledger));
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 5 — getMonthlyBudget
// ════════════════════════════════════════════════════════════════════

describe('getMonthlyBudget', () => {
  it('daily 9.8M + bills 5.15M = 14.95M', () => {
    expectEqual(
      getMonthlyBudget({ dailySpendingLimit: 9_800_000, fixedBillsTotal: 5_150_000 }),
      14_950_000,
    );
  });

  it('both zero returns 0', () => {
    expectEqual(
      getMonthlyBudget({ dailySpendingLimit: 0, fixedBillsTotal: 0 }),
      0,
    );
  });

  it('only daily, no bills', () => {
    expectEqual(
      getMonthlyBudget({ dailySpendingLimit: 5_000_000, fixedBillsTotal: 0 }),
      5_000_000,
    );
  });

  it('only bills, no daily', () => {
    expectEqual(
      getMonthlyBudget({ dailySpendingLimit: 0, fixedBillsTotal: 3_000_000 }),
      3_000_000,
    );
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 6 — getDailyBudgetUsed (filters out isBill=true)
// ════════════════════════════════════════════════════════════════════

describe('getDailyBudgetUsed', () => {
  it('empty ledger returns 0', () => {
    expectEqual(getDailyBudgetUsed({ ledger: emptyLedger(), monthKey: '2026-05' }), 0);
  });

  it('seed fixture (May): food 120k + coffee 80k = 200k (excludes bill 2.5M)', () => {
    expectEqual(
      getDailyBudgetUsed({ ledger: fullySeededFixture(), monthKey: '2026-05' }),
      200_000,
    );
  });

  it('filters by monthKey — April-only data with May query returns 0', () => {
    const ledger = multiMonthFixture();
    expectEqual(
      getDailyBudgetUsed({ ledger, monthKey: '2026-03' }),
      0,
    );
  });

  it('returns only May daily for multi-month fixture (excludes April)', () => {
    const ledger = multiMonthFixture();
    expectEqual(
      getDailyBudgetUsed({ ledger, monthKey: '2026-05' }),
      500_000,
    );
  });

  it('returns only April daily (excludes May)', () => {
    const ledger = multiMonthFixture();
    expectEqual(
      getDailyBudgetUsed({ ledger, monthKey: '2026-04' }),
      300_000,
    );
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 7 — getBillBudgetUsed (only isBill=true)
// ════════════════════════════════════════════════════════════════════

describe('getBillBudgetUsed', () => {
  it('empty ledger returns 0', () => {
    expectEqual(getBillBudgetUsed({ ledger: emptyLedger(), monthKey: '2026-05' }), 0);
  });

  it('seed fixture: only bill 2.5M counted (excludes 200k daily)', () => {
    expectEqual(
      getBillBudgetUsed({ ledger: fullySeededFixture(), monthKey: '2026-05' }),
      2_500_000,
    );
  });

  it('daily + bill are mutually exclusive (sums to total expense)', () => {
    const ledger = fullySeededFixture();
    const daily = getDailyBudgetUsed({ ledger, monthKey: '2026-05' });
    const bill = getBillBudgetUsed({ ledger, monthKey: '2026-05' });
    expectEqual(daily + bill, 200_000 + 2_500_000);
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 8 — getUnpaidBills
// ════════════════════════════════════════════════════════════════════

describe('getUnpaidBills', () => {
  it('returns only !isPaid bills', () => {
    const unpaid = getUnpaidBills(SAMPLE_BILLS);
    expectEqual(unpaid.length, 3);
    expectEqual(unpaid[0].id, 'bill-electric');
    expectEqual(unpaid[1].id, 'bill-water');
    expectEqual(unpaid[2].id, 'bill-internet');
  });

  it('returns empty array when all paid', () => {
    expectEqual(getUnpaidBills(SAMPLE_BILLS_ALL_PAID).length, 0);
  });

  it('returns all when none paid', () => {
    expectEqual(getUnpaidBills(SAMPLE_BILLS_NONE_PAID).length, 4);
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 9 — getOverdueBills (strict less-than)
// ════════════════════════════════════════════════════════════════════

describe('getOverdueBills', () => {
  it('returns bills with dueDay < today AND !isPaid', () => {
    // today=12: dueDay 10 unpaid → overdue. dueDay 15, 20 not yet due.
    const overdue = getOverdueBills({ fixedBills: SAMPLE_BILLS, today: 12 });
    expectEqual(overdue.length, 1);
    expectEqual(overdue[0].id, 'bill-electric');
  });

  it('boundary: dueDay === today → NOT overdue (strictly less than)', () => {
    // today=10, dueDay=10 → NOT overdue
    const overdue = getOverdueBills({ fixedBills: SAMPLE_BILLS, today: 10 });
    expectEqual(overdue.length, 0);
  });

  it('today=25 marks 3 unpaid bills overdue (excluding paid rent)', () => {
    const overdue = getOverdueBills({ fixedBills: SAMPLE_BILLS, today: 25 });
    expectEqual(overdue.length, 3);
  });

  it('all paid → no overdue ever', () => {
    expectEqual(
      getOverdueBills({ fixedBills: SAMPLE_BILLS_ALL_PAID, today: 31 }).length,
      0,
    );
  });
});

// ════════════════════════════════════════════════════════════════════
//  SELECTOR 11 — getSafeToSpendStatusV2 (boundary tests)
//  (Selector 10 has its own dedicated test file: safe-to-spend.test.ts)
// ════════════════════════════════════════════════════════════════════

describe('getSafeToSpendStatusV2 — boundaries', () => {
  it('1.500.000 → safe (> 1M)', () => {
    expectEqual(getSafeToSpendStatusV2(1_500_000), 'safe');
  });

  it('1.000.001 → safe (just above boundary)', () => {
    expectEqual(getSafeToSpendStatusV2(1_000_001), 'safe');
  });

  it('1.000.000 → low (exact boundary, inclusive)', () => {
    expectEqual(getSafeToSpendStatusV2(1_000_000), 'low');
  });

  it('500.000 → low', () => {
    expectEqual(getSafeToSpendStatusV2(500_000), 'low');
  });

  it('0 → low (per ADR §4.3)', () => {
    expectEqual(getSafeToSpendStatusV2(0), 'low');
  });

  it('-1 → negative (just below zero)', () => {
    expectEqual(getSafeToSpendStatusV2(-1), 'negative');
  });

  it('-500.000 → negative', () => {
    expectEqual(getSafeToSpendStatusV2(-500_000), 'negative');
  });
});
