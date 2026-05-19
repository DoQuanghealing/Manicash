/**
 * Safe-to-Spend tests — LA4 acceptance criterion.
 *
 * Required cases:
 *   1. positive (safe)
 *   2. low (0–1M)
 *   3. negative
 *   4. income-but-spending-short — Income has money but Spending balance
 *      is below what bills need. Tests that Safe-to-Spend stays at the
 *      planning level (positive) even when Spending balance is short.
 *   5. no-saving-target (target = 0)
 *   6. no-bills (fixedBillsTotal = 0)
 */

import {
  INCOME_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import {
  getSafeToSpend,
  getSafeToSpendStatusV2,
} from '@/core/finance/threeAccountSelectors';
import { buildThreeAccountSnapshot } from '@/core/finance/threeAccountSnapshot';
import {
  buildLedger,
  expenseEvent,
  incomeEvent,
  resetFixtureState,
  transferEvent,
} from './fixtures';
import { describe, expectEqual, expectTrue, it } from './harness';

describe('Safe-to-Spend — Case 1: positive (safe)', () => {
  it('ADR sample: 19.1M income + 800k carry - 9.8M daily - 5.15M bills - 1.7M saving = 3.261.550', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 19_111_550,
      carryOver: 800_000,
      dailySpendingLimit: 9_800_000,
      fixedBillsTotal: 5_150_000,
      monthlySavingsTarget: 1_700_000,
    });
    expectEqual(amount, 3_261_550);
    expectEqual(getSafeToSpendStatusV2(amount), 'safe');
  });

  it('clean round numbers: 20M - 15M = 5M positive safe', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 20_000_000,
      carryOver: 0,
      dailySpendingLimit: 10_000_000,
      fixedBillsTotal: 5_000_000,
      monthlySavingsTarget: 0,
    });
    expectEqual(amount, 5_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'safe');
  });
});

describe('Safe-to-Spend — Case 2: low (0–1M)', () => {
  it('500k remaining → low status', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 10_000_000,
      carryOver: 0,
      dailySpendingLimit: 6_000_000,
      fixedBillsTotal: 3_000_000,
      monthlySavingsTarget: 500_000,
    });
    expectEqual(amount, 500_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'low');
  });

  it('exactly 1M → low (inclusive boundary)', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 11_000_000,
      carryOver: 0,
      dailySpendingLimit: 6_000_000,
      fixedBillsTotal: 3_000_000,
      monthlySavingsTarget: 1_000_000,
    });
    expectEqual(amount, 1_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'low');
  });
});

describe('Safe-to-Spend — Case 3: negative', () => {
  it('budget exceeds income → negative, status negative', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 10_000_000,
      carryOver: 0,
      dailySpendingLimit: 8_000_000,
      fixedBillsTotal: 4_000_000,
      monthlySavingsTarget: 0,
    });
    expectEqual(amount, -2_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'negative');
  });

  it('over-saving causes negative', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 10_000_000,
      carryOver: 0,
      dailySpendingLimit: 5_000_000,
      fixedBillsTotal: 2_000_000,
      monthlySavingsTarget: 5_000_000, // saving > what's left
    });
    expectEqual(amount, -2_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'negative');
  });
});

describe('Safe-to-Spend — Case 4: income-but-spending-short', () => {
  /**
   * Critical case: Income account has plenty of money (because user hasn't
   * fully allocated yet), but Spending account is LOW because user has
   * been chi tiêu without re-allocating. The PLANNING-level Safe-to-Spend
   * must remain positive — it does NOT reflect real-time spending
   * shortage. UI is responsible for surfacing the spending shortage as a
   * separate hint, not by reducing Safe-to-Spend.
   */
  it('Income full, Spending account short — Safe-to-Spend still positive', () => {
    resetFixtureState();
    const ledger = buildLedger([
      incomeEvent(15_000_000, { occurredAt: '2026-05-01T09:00:00.000Z' }),
      transferEvent(2_000_000, INCOME_ACCOUNT_ID, SPENDING_ACCOUNT_ID, {
        occurredAt: '2026-05-01T09:05:00.000Z',
      }),
      // User chi tiêu 1.5M trong tháng — Spending balance còn 500k
      expenseEvent(1_500_000, SPENDING_ACCOUNT_ID, {
        occurredAt: '2026-05-10T10:00:00.000Z',
        metadata: { categoryId: 'food', isBill: false },
      }),
    ]);

    const snapshot = buildThreeAccountSnapshot({
      ledger,
      monthKey: '2026-05',
      today: 15,
      fixedBills: [
        { id: 'rent', amount: 3_000_000, dueDay: 25, isPaid: false },
      ],
      dailySpendingLimit: 5_000_000,
      carryOver: 0,
      monthlySavingsTarget: 2_000_000,
      monthlyIncome: 15_000_000,
    });

    // Safe-to-Spend = 15M + 0 - 5M - 3M - 2M = 5M (positive, safe)
    expectEqual(snapshot.safeToSpend.amount, 5_000_000);
    expectEqual(snapshot.safeToSpend.status, 'safe');

    // Income balance still has 15M - 2M = 13M (user can still allocate)
    expectEqual(snapshot.income.balance, 13_000_000);

    // Spending balance only 500k — well below the 3M needed for rent
    expectEqual(snapshot.spending.balance, 500_000);

    // Unpaid bills surface separately
    expectEqual(snapshot.spending.unpaidBills.length, 1);
    expectEqual(snapshot.spending.unpaidBills[0].id, 'rent');

    // Critical invariant: Safe-to-Spend > 0 even though Spending < bill total.
    // UI should show "Tài khoản chi tiêu thiếu Xđ cho bill" as a separate hint,
    // NOT collapse it into Safe-to-Spend.
    expectTrue(
      snapshot.safeToSpend.amount > 0 && snapshot.spending.balance < 3_000_000,
      'spending account short but Safe-to-Spend positive',
    );
  });
});

describe('Safe-to-Spend — Case 5: no-saving-target', () => {
  it('saving target = 0 → only daily + bills deducted', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 15_000_000,
      carryOver: 0,
      dailySpendingLimit: 8_000_000,
      fixedBillsTotal: 3_000_000,
      monthlySavingsTarget: 0,
    });
    expectEqual(amount, 4_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'safe');
  });
});

describe('Safe-to-Spend — Case 6: no-bills', () => {
  it('fixed bills = 0 → only daily + saving deducted', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 10_000_000,
      carryOver: 0,
      dailySpendingLimit: 5_000_000,
      fixedBillsTotal: 0,
      monthlySavingsTarget: 2_000_000,
    });
    expectEqual(amount, 3_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'safe');
  });

  it('no income, no bills, only daily limit → negative', () => {
    const amount = getSafeToSpend({
      monthlyIncome: 0,
      carryOver: 0,
      dailySpendingLimit: 5_000_000,
      fixedBillsTotal: 0,
      monthlySavingsTarget: 0,
    });
    expectEqual(amount, -5_000_000);
    expectEqual(getSafeToSpendStatusV2(amount), 'negative');
  });
});

describe('Safe-to-Spend — invariants', () => {
  it('formula is reversible: adding back deductions returns income+carry', () => {
    const inputs = {
      monthlyIncome: 19_111_550,
      carryOver: 800_000,
      dailySpendingLimit: 9_800_000,
      fixedBillsTotal: 5_150_000,
      monthlySavingsTarget: 1_700_000,
    };
    const amount = getSafeToSpend(inputs);
    const reconstructed =
      amount +
      inputs.dailySpendingLimit +
      inputs.fixedBillsTotal +
      inputs.monthlySavingsTarget;
    expectEqual(reconstructed, inputs.monthlyIncome + inputs.carryOver);
  });

  it('snapshot.safeToSpend.inputs round-trips through getSafeToSpend', () => {
    resetFixtureState();
    const snapshot = buildThreeAccountSnapshot({
      ledger: buildLedger([incomeEvent(15_000_000)]),
      monthKey: '2026-05',
      today: 15,
      fixedBills: [],
      dailySpendingLimit: 5_000_000,
      carryOver: 800_000,
      monthlySavingsTarget: 2_000_000,
      monthlyIncome: 15_000_000,
    });
    const recomputed = getSafeToSpend(snapshot.safeToSpend.inputs);
    expectEqual(recomputed, snapshot.safeToSpend.amount);
  });
});
