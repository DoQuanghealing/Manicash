/**
 * Integration tests for buildThreeAccountSnapshot — the single
 * computation layer used by UI, tests, persistence, and synthetics.
 */

import { buildThreeAccountSnapshot } from '@/core/finance/threeAccountSnapshot';
import { fullySeededFixture, SAMPLE_BILLS } from './fixtures';
import { describe, expectEqual, expectTrue, it } from './harness';

describe('buildThreeAccountSnapshot — seed scenario', () => {
  const SNAPSHOT_INPUT = {
    monthKey: '2026-05',
    today: 12,
    fixedBills: SAMPLE_BILLS,
    dailySpendingLimit: 9_800_000,
    carryOver: 800_000,
    monthlySavingsTarget: 1_700_000,
    monthlyIncome: 19_111_550,
  };

  it('income block reflects unallocated remainder', () => {
    const snap = buildThreeAccountSnapshot({
      ...SNAPSHOT_INPUT,
      ledger: fullySeededFixture(),
    });
    expectEqual(snap.income.balance, 2_461_550);
  });

  it('spending block has expected balance, used, remaining', () => {
    const snap = buildThreeAccountSnapshot({
      ...SNAPSHOT_INPUT,
      ledger: fullySeededFixture(),
    });
    // Balance: 14.95M allocated - 200k daily - 2.5M bill = 12.25M
    expectEqual(snap.spending.balance, 12_250_000);
    expectEqual(snap.spending.dailyBudgetUsed, 200_000);
    expectEqual(snap.spending.dailyBudgetRemaining, 9_600_000); // 9.8M - 200k
    expectEqual(snap.spending.billBudgetUsed, 2_500_000);
    // SAMPLE_BILLS total = 2.5M + 350k + 100k + 200k = 3.15M
    expectEqual(snap.spending.billBudgetTotal, 3_150_000);
    expectEqual(snap.spending.billBudgetRemaining, 650_000);
    // monthlyBudget = dailyLimit 9.8M + bills 3.15M = 12.95M
    expectEqual(snap.spending.monthlyBudget, 12_950_000);
  });

  it('bills surface unpaid + overdue separately', () => {
    const snap = buildThreeAccountSnapshot({
      ...SNAPSHOT_INPUT,
      ledger: fullySeededFixture(),
    });
    // SAMPLE_BILLS: rent paid; electric(10), water(15), internet(20) unpaid
    expectEqual(snap.spending.unpaidBills.length, 3);
    // today=12: electric (dueDay 10) is overdue; water/internet not yet
    expectEqual(snap.spending.overdueBills.length, 1);
    expectEqual(snap.spending.overdueBills[0].id, 'bill-electric');
  });

  it('saving block has total and 3-bucket breakdown', () => {
    const snap = buildThreeAccountSnapshot({
      ...SNAPSHOT_INPUT,
      ledger: fullySeededFixture(),
    });
    expectEqual(snap.saving.balance, 1_700_000);
    expectEqual(snap.saving.breakdown.reserve, 800_000);
    expectEqual(snap.saving.breakdown.goals, 500_000);
    expectEqual(snap.saving.breakdown.investment, 400_000);
    expectEqual(snap.saving.breakdown.total, 1_700_000);
  });

  it('safe-to-spend block uses ADR formula with bills total from input', () => {
    const snap = buildThreeAccountSnapshot({
      ...SNAPSHOT_INPUT,
      ledger: fullySeededFixture(),
    });
    // 19_111_550 + 800_000 - 9_800_000 - 3_150_000 - 1_700_000 = 5_261_550
    expectEqual(snap.safeToSpend.amount, 5_261_550);
    expectEqual(snap.safeToSpend.status, 'safe');
    expectEqual(snap.safeToSpend.inputs.fixedBillsTotal, 3_150_000);
  });
});

describe('buildThreeAccountSnapshot — empty input', () => {
  it('zero everything yields zero snapshot', () => {
    const snap = buildThreeAccountSnapshot({
      ledger: [],
      monthKey: '2026-05',
      today: 1,
      fixedBills: [],
      dailySpendingLimit: 0,
      carryOver: 0,
      monthlySavingsTarget: 0,
      monthlyIncome: 0,
    });

    expectEqual(snap.income.balance, 0);
    expectEqual(snap.spending.balance, 0);
    expectEqual(snap.spending.monthlyBudget, 0);
    expectEqual(snap.spending.unpaidBills.length, 0);
    expectEqual(snap.spending.overdueBills.length, 0);
    expectEqual(snap.saving.balance, 0);
    expectEqual(snap.safeToSpend.amount, 0);
    expectEqual(snap.safeToSpend.status, 'low'); // 0 ≤ 1M
  });
});

describe('buildThreeAccountSnapshot — purity invariants (LA3)', () => {
  it('calling builder twice with same input yields equal output', () => {
    const input = {
      ledger: fullySeededFixture(),
      monthKey: '2026-05',
      today: 12,
      fixedBills: SAMPLE_BILLS,
      dailySpendingLimit: 9_800_000,
      carryOver: 800_000,
      monthlySavingsTarget: 1_700_000,
      monthlyIncome: 19_111_550,
    };
    const a = buildThreeAccountSnapshot(input);
    const b = buildThreeAccountSnapshot(input);
    expectEqual(JSON.stringify(a), JSON.stringify(b));
  });

  it('output is JSON-serializable (no functions, no cycles)', () => {
    const snap = buildThreeAccountSnapshot({
      ledger: fullySeededFixture(),
      monthKey: '2026-05',
      today: 12,
      fixedBills: SAMPLE_BILLS,
      dailySpendingLimit: 9_800_000,
      carryOver: 800_000,
      monthlySavingsTarget: 1_700_000,
      monthlyIncome: 19_111_550,
    });
    const json = JSON.stringify(snap);
    const parsed = JSON.parse(json);
    expectTrue(typeof parsed === 'object');
    expectEqual(parsed.income.balance, snap.income.balance);
  });
});
