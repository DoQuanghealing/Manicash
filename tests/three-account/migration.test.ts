/**
 * Tests for src/core/finance/migrations/legacyToThreeAccount.ts
 *
 * Coverage:
 *   - 10 fixtures from Phase 1 plan §7.4
 *   - LA5 idempotent (same input → same plan; existingBatchId → no-op)
 *   - LA6 backup snapshot present even on no-op
 *   - Production guard: split-70-30 falls back when isDemoUser !== true
 *   - Balance invariant: sum(new events) === sum(legacy fields)
 *   - suggestMainBalanceRoute heuristic coverage
 */

import {
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import {
  computeBatchId,
  MigrationValidationError,
  planMigration,
  suggestMainBalanceRoute,
  type LegacyBalanceSnapshot,
  type MigrationContext,
} from '@/core/finance/migrations/legacyToThreeAccount';
import {
  describe,
  expectDeepEqual,
  expectEqual,
  expectThrows,
  expectTrue,
  it,
} from './harness';

// ════════════════════════════════════════════════════════════════════
//  Builders
// ════════════════════════════════════════════════════════════════════

function snap(overrides: Partial<LegacyBalanceSnapshot> = {}): LegacyBalanceSnapshot {
  return {
    mainBalance: 0,
    billFundBalance: 0,
    emergencyBalance: 0,
    reserveBalance: 0,
    goalsBalance: 0,
    investmentBalance: 0,
    ...overrides,
  };
}

function ctx(overrides: Partial<MigrationContext> = {}): MigrationContext {
  return {
    userId: 'user-abc',
    occurredAt: '2026-05-19T10:00:00.000Z',
    mainBalanceRoute: 'income',
    ...overrides,
  };
}

function sumDomainEvents(events: { amount: number }[]): number {
  return events.reduce((s, e) => s + e.amount, 0);
}

// ════════════════════════════════════════════════════════════════════
//  10 fixtures from Phase 1 plan §7.4
// ════════════════════════════════════════════════════════════════════

describe('Fixture 1 — Empty snapshot', () => {
  it('emits 0 events', () => {
    const plan = planMigration(snap(), ctx());
    expectEqual(plan.domainEvents.length, 0);
    expectEqual(plan.engineEvents.length, 0);
    expectEqual(plan.totalLegacy, 0);
    expectEqual(plan.totalNew, 0);
  });

  it('still returns backup snapshot (LA6)', () => {
    const plan = planMigration(snap(), ctx());
    expectDeepEqual(plan.backupSnapshot, snap());
  });

  it('isNoOp = false on empty (no migration applied yet)', () => {
    const plan = planMigration(snap(), ctx());
    expectEqual(plan.isNoOp, false);
  });
});

describe('Fixture 2 — Only emergency 5M', () => {
  it('produces 1 event → RESERVE_FUND', () => {
    const plan = planMigration(snap({ emergencyBalance: 5_000_000 }), ctx());
    expectEqual(plan.domainEvents.length, 1);
    expectEqual(plan.domainEvents[0].targetAccountId, RESERVE_FUND_ACCOUNT_ID);
    expectEqual(plan.domainEvents[0].amount, 5_000_000);
  });

  it('engine event is single CREATE_INCOME (ADJUSTMENT with target-only)', () => {
    const plan = planMigration(snap({ emergencyBalance: 5_000_000 }), ctx());
    expectEqual(plan.engineEvents.length, 1);
    expectEqual(plan.engineEvents[0].type, 'CREATE_INCOME');
  });
});

describe('Fixture 3 — Only main 15M, route=income', () => {
  it('routes all to INCOME', () => {
    const plan = planMigration(
      snap({ mainBalance: 15_000_000 }),
      ctx({ mainBalanceRoute: 'income' }),
    );
    expectEqual(plan.domainEvents.length, 1);
    expectEqual(plan.domainEvents[0].targetAccountId, INCOME_ACCOUNT_ID);
    expectEqual(plan.domainEvents[0].amount, 15_000_000);
  });
});

describe('Fixture 4 — Only main 15M, route=spending', () => {
  it('routes all to SPENDING', () => {
    const plan = planMigration(
      snap({ mainBalance: 15_000_000 }),
      ctx({ mainBalanceRoute: 'spending' }),
    );
    expectEqual(plan.domainEvents.length, 1);
    expectEqual(plan.domainEvents[0].targetAccountId, SPENDING_ACCOUNT_ID);
    expectEqual(plan.domainEvents[0].amount, 15_000_000);
  });
});

describe('Fixture 5 — Split route (demo only)', () => {
  it('demo: 15M → 10.5M SPENDING + 4.5M INCOME, sum exact', () => {
    const plan = planMigration(
      snap({ mainBalance: 15_000_000 }),
      ctx({ mainBalanceRoute: 'split-70-30', isDemoUser: true }),
    );
    expectEqual(plan.domainEvents.length, 2);
    const spending = plan.domainEvents.find((e) => e.targetAccountId === SPENDING_ACCOUNT_ID);
    const income = plan.domainEvents.find((e) => e.targetAccountId === INCOME_ACCOUNT_ID);
    expectEqual(spending?.amount, 10_500_000);
    expectEqual(income?.amount, 4_500_000);
    expectEqual((spending?.amount ?? 0) + (income?.amount ?? 0), 15_000_000);
  });

  it('production: split-70-30 falls back to income with warning', () => {
    const plan = planMigration(
      snap({ mainBalance: 15_000_000 }),
      ctx({ mainBalanceRoute: 'split-70-30' /* isDemoUser omitted */ }),
    );
    expectEqual(plan.domainEvents.length, 1);
    expectEqual(plan.domainEvents[0].targetAccountId, INCOME_ACCOUNT_ID);
    expectTrue(plan.warnings.length > 0, 'production fallback must emit warning');
    expectTrue(/split-70-30.*production/i.test(plan.warnings[0]));
  });
});

describe('Fixture 6 — Full demo seed (all 6 fields populated)', () => {
  const fullSnap = snap({
    mainBalance: 15_000_000,
    billFundBalance: 8_500_000,
    emergencyBalance: 5_000_000,
    reserveBalance: 3_000_000,
    goalsBalance: 2_500_000,
    investmentBalance: 1_200_000,
  });

  it('emits one event per non-zero target (5 events: reserve+bill+goal+inv+main)', () => {
    const plan = planMigration(fullSnap, ctx({ mainBalanceRoute: 'income' }));
    expectEqual(plan.domainEvents.length, 5);
  });

  it('balance invariant: sum new === sum legacy', () => {
    const plan = planMigration(fullSnap, ctx({ mainBalanceRoute: 'income' }));
    expectEqual(plan.totalNew, plan.totalLegacy);
    expectEqual(plan.totalLegacy, 35_200_000);
  });

  it('reserve sums emergency + reserve (5M + 3M = 8M)', () => {
    const plan = planMigration(fullSnap, ctx());
    const reserveEvent = plan.domainEvents.find(
      (e) => e.targetAccountId === RESERVE_FUND_ACCOUNT_ID,
    );
    expectEqual(reserveEvent?.amount, 8_000_000);
  });

  it('goals routes 2.5M to GOAL_FUND', () => {
    const plan = planMigration(fullSnap, ctx());
    const goalEvent = plan.domainEvents.find(
      (e) => e.targetAccountId === GOAL_FUND_ACCOUNT_ID,
    );
    expectEqual(goalEvent?.amount, 2_500_000);
  });

  it('investment routes 1.2M to INVESTMENT_FUND', () => {
    const plan = planMigration(fullSnap, ctx());
    const invEvent = plan.domainEvents.find(
      (e) => e.targetAccountId === INVESTMENT_FUND_ACCOUNT_ID,
    );
    expectEqual(invEvent?.amount, 1_200_000);
  });

  it('billFund 8.5M routes to SPENDING', () => {
    const plan = planMigration(fullSnap, ctx());
    const spendingEvents = plan.domainEvents.filter(
      (e) => e.targetAccountId === SPENDING_ACCOUNT_ID,
    );
    // With route='income', only billFund goes to spending
    expectEqual(spendingEvents.length, 1);
    expectEqual(spendingEvents[0].amount, 8_500_000);
  });
});

describe('Fixture 7 — Heavy saver (large numbers)', () => {
  it('handles 200M total without precision loss', () => {
    const plan = planMigration(
      snap({
        mainBalance: 5_000_000,
        billFundBalance: 2_000_000,
        emergencyBalance: 20_000_000,
        reserveBalance: 30_000_000,
        goalsBalance: 50_000_000,
        investmentBalance: 100_000_000,
      }),
      ctx(),
    );
    expectEqual(plan.totalLegacy, 207_000_000);
    expectEqual(plan.totalNew, 207_000_000);
  });
});

describe('Fixture 8 — Bill-heavy split (demo)', () => {
  it('demo: mainBalance 2M split 70/30 = 1.4M SPENDING + 0.6M INCOME', () => {
    const plan = planMigration(
      snap({ mainBalance: 2_000_000, billFundBalance: 10_000_000 }),
      ctx({ mainBalanceRoute: 'split-70-30', isDemoUser: true }),
    );
    // 3 events: bill→spending, main-spending-70, main-income-30
    expectEqual(plan.domainEvents.length, 3);
    expectEqual(plan.totalNew, plan.totalLegacy);
  });
});

describe('Fixture 9 — Idempotent rerun (LA5)', () => {
  const baseSnap = snap({
    mainBalance: 15_000_000,
    billFundBalance: 8_500_000,
    emergencyBalance: 5_000_000,
  });

  it('same context → identical plan (deterministic)', () => {
    const a = planMigration(baseSnap, ctx());
    const b = planMigration(baseSnap, ctx());
    expectEqual(JSON.stringify(a), JSON.stringify(b));
  });

  it('existingBatchId matches computed → isNoOp with empty events', () => {
    const batchId = computeBatchId('user-abc', '2026-05-19T10:00:00.000Z');
    const plan = planMigration(baseSnap, ctx({ existingBatchId: batchId }));
    expectEqual(plan.isNoOp, true);
    expectEqual(plan.domainEvents.length, 0);
    expectEqual(plan.engineEvents.length, 0);
  });

  it('isNoOp still includes backupSnapshot (LA6)', () => {
    const batchId = computeBatchId('user-abc', '2026-05-19T10:00:00.000Z');
    const plan = planMigration(baseSnap, ctx({ existingBatchId: batchId }));
    expectDeepEqual(plan.backupSnapshot, baseSnap);
  });

  it('different existingBatchId → produces full plan (not no-op)', () => {
    const plan = planMigration(baseSnap, ctx({ existingBatchId: 'some-other-id' }));
    expectEqual(plan.isNoOp, false);
    expectTrue(plan.domainEvents.length > 0);
  });
});

describe('Fixture 10 — Rounding edge case', () => {
  it('demo split: mainBalance=1.000.001đ → 700.001 SPENDING + 300.000 INCOME (sum exact)', () => {
    const plan = planMigration(
      snap({ mainBalance: 1_000_001 }),
      ctx({ mainBalanceRoute: 'split-70-30', isDemoUser: true }),
    );
    expectEqual(plan.domainEvents.length, 2);
    expectEqual(plan.totalNew, 1_000_001);
    const spending = plan.domainEvents.find((e) => e.targetAccountId === SPENDING_ACCOUNT_ID);
    const income = plan.domainEvents.find((e) => e.targetAccountId === INCOME_ACCOUNT_ID);
    expectEqual(spending?.amount, 700_001);
    expectEqual(income?.amount, 300_000);
  });

  it('demo split: mainBalance=1đ → 1 SPENDING + 0 INCOME (no zero-amount event emitted)', () => {
    const plan = planMigration(
      snap({ mainBalance: 1 }),
      ctx({ mainBalanceRoute: 'split-70-30', isDemoUser: true }),
    );
    // Math.round(0.7) = 1, remainder 0 → only SPENDING event
    expectEqual(plan.domainEvents.length, 1);
    expectEqual(plan.domainEvents[0].targetAccountId, SPENDING_ACCOUNT_ID);
    expectEqual(plan.domainEvents[0].amount, 1);
  });
});

// ════════════════════════════════════════════════════════════════════
//  Backup snapshot invariant (LA6)
// ════════════════════════════════════════════════════════════════════

describe('LA6 — backupSnapshot payload always present', () => {
  it('on empty snapshot', () => {
    const plan = planMigration(snap(), ctx());
    expectTrue(plan.backupSnapshot !== undefined);
  });

  it('on populated snapshot — matches input exactly', () => {
    const input = snap({ mainBalance: 1_234_567 });
    const plan = planMigration(input, ctx());
    expectDeepEqual(plan.backupSnapshot, input);
  });

  it('on no-op (existingBatchId match) — still present', () => {
    const batchId = computeBatchId('user-abc', '2026-05-19T10:00:00.000Z');
    const plan = planMigration(snap({ mainBalance: 1_000_000 }), ctx({ existingBatchId: batchId }));
    expectEqual(plan.isNoOp, true);
    expectTrue(plan.backupSnapshot.mainBalance === 1_000_000);
  });

  it('backup is a defensive copy (mutating it does not change later plan output)', () => {
    const input = snap({ mainBalance: 5_000_000 });
    const plan = planMigration(input, ctx());
    // Mutate the input AFTER planning
    input.mainBalance = 999;
    // Backup payload should still reflect original snapshot
    expectEqual(plan.backupSnapshot.mainBalance, 5_000_000);
  });
});

// ════════════════════════════════════════════════════════════════════
//  Audit metadata (LA8 — auditActor='migration', not user)
// ════════════════════════════════════════════════════════════════════

describe('Migration audit metadata', () => {
  it('every domain event has audit.actor=migration', () => {
    const plan = planMigration(
      snap({
        mainBalance: 1_000_000,
        emergencyBalance: 500_000,
        goalsBalance: 200_000,
      }),
      ctx(),
    );
    for (const event of plan.domainEvents) {
      expectEqual(event.audit.actor, 'migration');
      expectEqual(event.audit.sourceUI, 'legacy-to-three-account-v1');
      expectEqual(event.audit.relatedEventId, plan.batchId);
    }
  });

  it('every engine event has metadata.auditActor=migration', () => {
    const plan = planMigration(snap({ mainBalance: 1_000_000 }), ctx());
    for (const event of plan.engineEvents) {
      expectEqual(event.metadata?.auditActor, 'migration');
    }
  });

  it('reason field documents the legacy source', () => {
    const plan = planMigration(snap({ billFundBalance: 1_000_000 }), ctx());
    expectTrue(plan.domainEvents[0].reason.includes('billFundBalance'));
  });
});

// ════════════════════════════════════════════════════════════════════
//  Validation
// ════════════════════════════════════════════════════════════════════

describe('Validation', () => {
  it('rejects negative balance', () => {
    expectThrows(
      () => planMigration(snap({ mainBalance: -1 }), ctx()),
      /non-negative/,
    );
  });

  it('rejects fractional balance', () => {
    expectThrows(
      () => planMigration(snap({ mainBalance: 1.5 }), ctx()),
      /integer/,
    );
  });

  it('rejects NaN balance', () => {
    expectThrows(
      () => planMigration(snap({ mainBalance: NaN }), ctx()),
      /finite/,
    );
  });

  it('rejects invalid mainBalanceRoute', () => {
    expectThrows(
      () =>
        planMigration(snap(), {
          userId: 'u',
          occurredAt: '2026-05-19T10:00:00.000Z',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mainBalanceRoute: 'bogus' as any,
        }),
      /mainBalanceRoute/,
    );
  });

  it('rejects empty userId', () => {
    expectThrows(
      () => planMigration(snap(), ctx({ userId: '' })),
      /userId/,
    );
  });

  it('thrown errors are MigrationValidationError', () => {
    try {
      planMigration(snap({ mainBalance: -1 }), ctx());
      throw new Error('should have thrown');
    } catch (err) {
      expectTrue(err instanceof MigrationValidationError);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  suggestMainBalanceRoute heuristic
// ════════════════════════════════════════════════════════════════════

describe('suggestMainBalanceRoute — production user', () => {
  it('with no demo flag → always returns income with requiresUserConfirmation=true', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 1_000_000,
      totalCategoryLimits: 5_000_000,
      totalFixedBills: 3_000_000,
      recentExpenseCount: 5,
      hasPaidBillThisMonth: true,
      // isDemoUser omitted
    });
    expectEqual(result.income, 1_000_000);
    expectEqual(result.spending, 0);
    expectEqual(result.requiresUserConfirmation, true);
    expectEqual(result.confidence, 'low');
  });

  it('with isDemoUser=false → still production rules', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 1_000_000,
      totalCategoryLimits: 5_000_000,
      totalFixedBills: 3_000_000,
      recentExpenseCount: 5,
      hasPaidBillThisMonth: true,
      isDemoUser: false,
    });
    expectEqual(result.spending, 0);
    expectEqual(result.requiresUserConfirmation, true);
  });

  it('empty / zero mainBalance → income route, requiresUserConfirmation', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 0,
      totalCategoryLimits: 0,
      totalFixedBills: 0,
      recentExpenseCount: 0,
      hasPaidBillThisMonth: false,
    });
    expectEqual(result.income, 0);
    expectEqual(result.spending, 0);
    expectEqual(result.requiresUserConfirmation, true);
  });
});

describe('suggestMainBalanceRoute — demo user', () => {
  it('demo + bill paid + recent expenses + small main → split-70-30', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 5_000_000,
      totalCategoryLimits: 4_000_000,
      totalFixedBills: 3_000_000,
      recentExpenseCount: 5,
      hasPaidBillThisMonth: true,
      isDemoUser: true,
    });
    expectEqual(result.spending, 3_500_000);
    expectEqual(result.income, 1_500_000);
    expectEqual(result.requiresUserConfirmation, false);
    expectEqual(result.confidence, 'high');
  });

  it('demo + no bill history → fallback to income (heuristic not met)', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 5_000_000,
      totalCategoryLimits: 4_000_000,
      totalFixedBills: 3_000_000,
      recentExpenseCount: 5,
      hasPaidBillThisMonth: false,
      isDemoUser: true,
    });
    expectEqual(result.spending, 0);
    expectEqual(result.income, 5_000_000);
    expectEqual(result.requiresUserConfirmation, true);
  });

  it('demo + mainBalance too large → fallback to income', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 50_000_000, // huge
      totalCategoryLimits: 4_000_000,
      totalFixedBills: 3_000_000,
      recentExpenseCount: 5,
      hasPaidBillThisMonth: true,
      isDemoUser: true,
    });
    expectEqual(result.spending, 0);
    expectEqual(result.requiresUserConfirmation, true);
  });

  it('demo + few recent expenses → fallback to income', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: 5_000_000,
      totalCategoryLimits: 4_000_000,
      totalFixedBills: 3_000_000,
      recentExpenseCount: 1, // below threshold
      hasPaidBillThisMonth: true,
      isDemoUser: true,
    });
    expectEqual(result.spending, 0);
    expectEqual(result.requiresUserConfirmation, true);
  });
});

describe('suggestMainBalanceRoute — invariants', () => {
  it('income + spending always sums to mainBalance', () => {
    const inputs = [
      { mainBalance: 1_000_000, totalCategoryLimits: 4_000_000, totalFixedBills: 3_000_000, recentExpenseCount: 5, hasPaidBillThisMonth: true, isDemoUser: true },
      { mainBalance: 1_000_000, totalCategoryLimits: 0, totalFixedBills: 0, recentExpenseCount: 0, hasPaidBillThisMonth: false },
      { mainBalance: 0, totalCategoryLimits: 0, totalFixedBills: 0, recentExpenseCount: 0, hasPaidBillThisMonth: false },
    ];
    for (const input of inputs) {
      const result = suggestMainBalanceRoute(input);
      expectEqual(result.income + result.spending, input.mainBalance);
    }
  });

  it('negative mainBalance returns safe default', () => {
    const result = suggestMainBalanceRoute({
      mainBalance: -100,
      totalCategoryLimits: 0,
      totalFixedBills: 0,
      recentExpenseCount: 0,
      hasPaidBillThisMonth: false,
    });
    expectEqual(result.income, 0);
    expectEqual(result.spending, 0);
    expectEqual(result.requiresUserConfirmation, true);
  });
});

// ════════════════════════════════════════════════════════════════════
//  Engine event round-trip
// ════════════════════════════════════════════════════════════════════

describe('Engine event derivation', () => {
  it('every domain event maps to exactly one engine event', () => {
    const plan = planMigration(
      snap({
        mainBalance: 15_000_000,
        billFundBalance: 8_500_000,
        emergencyBalance: 5_000_000,
        goalsBalance: 2_500_000,
        investmentBalance: 1_200_000,
      }),
      ctx(),
    );
    expectEqual(plan.engineEvents.length, plan.domainEvents.length);
  });

  it('engine events are CREATE_INCOME (target-only ADJUSTMENT)', () => {
    const plan = planMigration(snap({ mainBalance: 1_000_000 }), ctx());
    expectEqual(plan.engineEvents[0].type, 'CREATE_INCOME');
  });

  it('sum of engine event amounts equals legacy total', () => {
    const plan = planMigration(
      snap({
        mainBalance: 15_000_000,
        billFundBalance: 8_500_000,
        emergencyBalance: 5_000_000,
        goalsBalance: 2_500_000,
        investmentBalance: 1_200_000,
      }),
      ctx(),
    );
    expectEqual(sumDomainEvents(plan.engineEvents), plan.totalLegacy);
  });
});
