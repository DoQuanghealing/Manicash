/**
 * Tests for src/core/finance/domainEventAdapter.ts
 *
 * Covers all 11 requirements from Day 6 spec:
 *   - Map count per event type
 *   - Amount validation (positive integer, no fractional)
 *   - Required metadata (savingBucket / billId+dueDay / reason+audit)
 *   - No mutation of input
 *   - Preserve domainEventType + domainEventId
 *   - No awardXP, no Zustand imports (compile-time guarantee)
 */

import {
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import {
  DomainEventValidationError,
  toEngineEvents,
} from '@/core/finance/domainEventAdapter';
import type {
  AdjustmentEvent,
  AllocateToSavingEvent,
  AllocateToSpendingEvent,
  DomainAuditMetadata,
  IncomeReceivedEvent,
  MonthlyRolloverEvent,
  PayBillEvent,
  PayExpenseEvent,
  ReallocateEvent,
  RefundEvent,
} from '@/core/finance/domainEvents';
import {
  describe,
  expectDeepEqual,
  expectEqual,
  expectThrows,
  expectTrue,
  it,
} from './harness';

// ════════════════════════════════════════════════════════════════════
//  Test builders
// ════════════════════════════════════════════════════════════════════

const FIXED_OCCURRED_AT = '2026-05-15T10:00:00.000Z';

const SAMPLE_AUDIT: DomainAuditMetadata = {
  actor: 'user',
  createdAt: '2026-05-15T10:00:01.000Z',
  sourceUI: 'test',
};

function income(overrides: Partial<IncomeReceivedEvent> = {}): IncomeReceivedEvent {
  return {
    id: 'inc-1',
    type: 'INCOME_RECEIVED',
    amount: 5_000_000,
    occurredAt: FIXED_OCCURRED_AT,
    incomeKind: 'salary',
    categoryId: 'salary',
    ...overrides,
  };
}

function allocSpending(overrides: Partial<AllocateToSpendingEvent> = {}): AllocateToSpendingEvent {
  return {
    id: 'alloc-sp-1',
    type: 'ALLOCATE_TO_SPENDING',
    amount: 3_000_000,
    occurredAt: FIXED_OCCURRED_AT,
    monthKey: '2026-05',
    allocationSessionId: 'sess-1',
    ...overrides,
  };
}

function allocSaving(overrides: Partial<AllocateToSavingEvent> = {}): AllocateToSavingEvent {
  return {
    id: 'alloc-sv-1',
    type: 'ALLOCATE_TO_SAVING',
    amount: 500_000,
    occurredAt: FIXED_OCCURRED_AT,
    monthKey: '2026-05',
    savingBucket: 'reserve',
    allocationSessionId: 'sess-1',
    ...overrides,
  };
}

function expense(overrides: Partial<PayExpenseEvent> = {}): PayExpenseEvent {
  return {
    id: 'exp-1',
    type: 'PAY_EXPENSE',
    amount: 80_000,
    occurredAt: FIXED_OCCURRED_AT,
    categoryId: 'food',
    ...overrides,
  };
}

function bill(overrides: Partial<PayBillEvent> = {}): PayBillEvent {
  return {
    id: 'bill-1',
    type: 'PAY_BILL',
    amount: 2_500_000,
    occurredAt: FIXED_OCCURRED_AT,
    billId: 'bill-rent',
    dueDay: 5,
    paidOnTime: true,
    ...overrides,
  };
}

function rollover(overrides: Partial<MonthlyRolloverEvent> = {}): MonthlyRolloverEvent {
  return {
    id: 'roll-1',
    type: 'MONTHLY_ROLLOVER',
    amount: 1_000_000,
    occurredAt: FIXED_OCCURRED_AT,
    monthKeyFrom: '2026-05',
    monthKeyTo: '2026-06',
    reason: 'auto rollover',
    audit: { actor: 'system', createdAt: FIXED_OCCURRED_AT, sourceUI: 'rollover-job' },
    ...overrides,
  };
}

function adjustment(overrides: Partial<AdjustmentEvent> = {}): AdjustmentEvent {
  return {
    id: 'adj-1',
    type: 'ADJUSTMENT',
    amount: 100_000,
    occurredAt: FIXED_OCCURRED_AT,
    targetAccountId: INCOME_ACCOUNT_ID,
    reason: 'manual correction',
    audit: { actor: 'admin', createdAt: FIXED_OCCURRED_AT },
    ...overrides,
  };
}

function reallocate(overrides: Partial<ReallocateEvent> = {}): ReallocateEvent {
  return {
    id: 'real-1',
    type: 'REALLOCATE',
    amount: 200_000,
    occurredAt: FIXED_OCCURRED_AT,
    sourceAccountId: RESERVE_FUND_ACCOUNT_ID,
    targetAccountId: SPENDING_ACCOUNT_ID,
    reason: 'emergency need',
    audit: SAMPLE_AUDIT,
    ...overrides,
  };
}

function refund(overrides: Partial<RefundEvent> = {}): RefundEvent {
  return {
    id: 'ref-1',
    type: 'REFUND',
    amount: 50_000,
    occurredAt: FIXED_OCCURRED_AT,
    originalExpenseEventId: 'exp-orig',
    reason: 'merchant refund',
    audit: SAMPLE_AUDIT,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
//  Map counts per event type
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — emits exactly one engine event per domain event', () => {
  it('INCOME_RECEIVED → 1 CREATE_INCOME', () => {
    const events = toEngineEvents(income());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'CREATE_INCOME');
  });

  it('ALLOCATE_TO_SPENDING → 1 TRANSFER_MONEY', () => {
    const events = toEngineEvents(allocSpending());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'TRANSFER_MONEY');
  });

  it('ALLOCATE_TO_SAVING → 1 TRANSFER_MONEY per call', () => {
    const events = toEngineEvents(allocSaving());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'TRANSFER_MONEY');
  });

  it('PAY_EXPENSE → 1 CREATE_EXPENSE', () => {
    const events = toEngineEvents(expense());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'CREATE_EXPENSE');
  });

  it('PAY_BILL → 1 CREATE_EXPENSE', () => {
    const events = toEngineEvents(bill());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'CREATE_EXPENSE');
  });

  it('MONTHLY_ROLLOVER → 1 TRANSFER_MONEY', () => {
    const events = toEngineEvents(rollover());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'TRANSFER_MONEY');
  });

  it('REALLOCATE → 1 TRANSFER_MONEY', () => {
    const events = toEngineEvents(reallocate());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'TRANSFER_MONEY');
  });

  it('REFUND → 1 CREATE_INCOME', () => {
    const events = toEngineEvents(refund());
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'CREATE_INCOME');
  });
});

describe('toEngineEvents — ADJUSTMENT shape variants', () => {
  it('ADJUSTMENT with target only → CREATE_INCOME', () => {
    const events = toEngineEvents(adjustment({ targetAccountId: INCOME_ACCOUNT_ID, sourceAccountId: undefined }));
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'CREATE_INCOME');
  });

  it('ADJUSTMENT with source only → CREATE_EXPENSE', () => {
    const events = toEngineEvents(adjustment({
      sourceAccountId: SPENDING_ACCOUNT_ID,
      targetAccountId: undefined,
    }));
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'CREATE_EXPENSE');
  });

  it('ADJUSTMENT with both → TRANSFER_MONEY', () => {
    const events = toEngineEvents(adjustment({
      sourceAccountId: SPENDING_ACCOUNT_ID,
      targetAccountId: RESERVE_FUND_ACCOUNT_ID,
    }));
    expectEqual(events.length, 1);
    expectEqual(events[0].type, 'TRANSFER_MONEY');
  });
});

// ════════════════════════════════════════════════════════════════════
//  Amount validation
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — amount validation', () => {
  it('rejects zero amount', () => {
    expectThrows(() => toEngineEvents(income({ amount: 0 })), /positive/);
  });

  it('rejects negative amount', () => {
    expectThrows(() => toEngineEvents(income({ amount: -100 })), /positive/);
  });

  it('rejects fractional amount', () => {
    expectThrows(() => toEngineEvents(income({ amount: 100.5 })), /integer/);
  });

  it('rejects NaN amount', () => {
    expectThrows(() => toEngineEvents(income({ amount: NaN })), /finite|integer/);
  });

  it('rejects Infinity amount', () => {
    expectThrows(() => toEngineEvents(income({ amount: Infinity })), /finite|integer/);
  });

  it('accepts amount = 1 (smallest positive integer)', () => {
    const events = toEngineEvents(income({ amount: 1 }));
    expectEqual(events[0].amount, 1);
  });
});

// ════════════════════════════════════════════════════════════════════
//  Required-field validation
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — required fields', () => {
  it('ALLOCATE_TO_SAVING rejects missing savingBucket', () => {
    expectThrows(
      () =>
        toEngineEvents(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allocSaving({ savingBucket: undefined as any }),
        ),
      /savingBucket/,
    );
  });

  it('PAY_BILL rejects missing billId', () => {
    expectThrows(
      () => toEngineEvents(bill({ billId: '' })),
      /billId/,
    );
  });

  it('PAY_BILL rejects non-integer dueDay', () => {
    expectThrows(
      () => toEngineEvents(bill({ dueDay: 5.5 })),
      /dueDay/,
    );
  });

  it('MONTHLY_ROLLOVER rejects missing reason', () => {
    expectThrows(
      () => toEngineEvents(rollover({ reason: '' })),
      /reason/,
    );
  });

  it('MONTHLY_ROLLOVER rejects missing audit.actor', () => {
    expectThrows(
      () =>
        toEngineEvents(
          rollover({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            audit: { createdAt: '2026-01-01' } as any,
          }),
        ),
      /audit.actor|actor/,
    );
  });

  it('ADJUSTMENT rejects when both source and target missing', () => {
    expectThrows(
      () => toEngineEvents(adjustment({ sourceAccountId: undefined, targetAccountId: undefined })),
      /sourceAccountId|targetAccountId/,
    );
  });

  it('REALLOCATE rejects when source equals target', () => {
    expectThrows(
      () =>
        toEngineEvents(
          reallocate({
            sourceAccountId: SPENDING_ACCOUNT_ID,
            targetAccountId: SPENDING_ACCOUNT_ID,
          }),
        ),
      /differ/,
    );
  });

  it('REFUND rejects missing reason', () => {
    expectThrows(
      () => toEngineEvents(refund({ reason: '' })),
      /reason/,
    );
  });

  it('REFUND rejects missing audit.createdAt', () => {
    expectThrows(
      () =>
        toEngineEvents(
          refund({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            audit: { actor: 'user' } as any,
          }),
        ),
      /createdAt/,
    );
  });
});

// ════════════════════════════════════════════════════════════════════
//  Metadata preservation
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — metadata preservation', () => {
  it('every output event carries domainEventId + domainEventType', () => {
    const events = toEngineEvents(income({ id: 'income-abc' }));
    expectEqual(events[0].metadata?.domainEventId, 'income-abc');
    expectEqual(events[0].metadata?.domainEventType, 'INCOME_RECEIVED');
  });

  it('ALLOCATE_TO_SAVING preserves savingBucket in metadata', () => {
    const events = toEngineEvents(allocSaving({ savingBucket: 'goals' }));
    expectEqual(events[0].metadata?.savingBucket, 'goals');
  });

  it('PAY_BILL preserves billId + dueDay + isBill in metadata', () => {
    const events = toEngineEvents(bill({ billId: 'bill-rent', dueDay: 5 }));
    expectEqual(events[0].metadata?.billId, 'bill-rent');
    expectEqual(events[0].metadata?.dueDay, 5);
    expectEqual(events[0].metadata?.isBill, true);
  });

  it('PAY_EXPENSE has isBill=false in metadata', () => {
    const events = toEngineEvents(expense());
    expectEqual(events[0].metadata?.isBill, false);
  });

  it('MONTHLY_ROLLOVER preserves audit + reason in metadata', () => {
    const events = toEngineEvents(rollover({
      reason: 'auto end-of-month',
      audit: { actor: 'system', createdAt: '2026-05-31T23:59:59Z', sourceUI: 'rollover-job' },
    }));
    const meta = events[0].metadata;
    expectEqual(meta?.reason, 'auto end-of-month');
    expectEqual(meta?.auditActor, 'system');
    expectEqual(meta?.auditCreatedAt, '2026-05-31T23:59:59Z');
    expectEqual(meta?.auditSourceUI, 'rollover-job');
  });

  it('REALLOCATE preserves reason + audit + monetary flow', () => {
    const events = toEngineEvents(reallocate({
      sourceAccountId: RESERVE_FUND_ACCOUNT_ID,
      targetAccountId: SPENDING_ACCOUNT_ID,
      amount: 300_000,
      reason: 'emergency need',
    }));
    expectEqual(events[0].type, 'TRANSFER_MONEY');
    if (events[0].type === 'TRANSFER_MONEY') {
      expectEqual(events[0].sourceAccountId, RESERVE_FUND_ACCOUNT_ID);
      expectEqual(events[0].targetAccountId, SPENDING_ACCOUNT_ID);
    }
    expectEqual(events[0].metadata?.reason, 'emergency need');
    expectEqual(events[0].metadata?.auditActor, 'user');
  });
});

// ════════════════════════════════════════════════════════════════════
//  Routing correctness
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — account routing', () => {
  it('INCOME_RECEIVED targets INCOME_ACCOUNT_ID', () => {
    const events = toEngineEvents(income());
    if (events[0].type === 'CREATE_INCOME') {
      expectEqual(events[0].targetAccountId, INCOME_ACCOUNT_ID);
    }
  });

  it('ALLOCATE_TO_SPENDING flows INCOME → SPENDING', () => {
    const events = toEngineEvents(allocSpending());
    if (events[0].type === 'TRANSFER_MONEY') {
      expectEqual(events[0].sourceAccountId, INCOME_ACCOUNT_ID);
      expectEqual(events[0].targetAccountId, SPENDING_ACCOUNT_ID);
    }
  });

  it('ALLOCATE_TO_SAVING(reserve) → INCOME → RESERVE_FUND', () => {
    const events = toEngineEvents(allocSaving({ savingBucket: 'reserve' }));
    if (events[0].type === 'TRANSFER_MONEY') {
      expectEqual(events[0].targetAccountId, RESERVE_FUND_ACCOUNT_ID);
    }
  });

  it('ALLOCATE_TO_SAVING(goals) → INCOME → GOAL_FUND', () => {
    const events = toEngineEvents(allocSaving({ savingBucket: 'goals' }));
    if (events[0].type === 'TRANSFER_MONEY') {
      expectEqual(events[0].targetAccountId, GOAL_FUND_ACCOUNT_ID);
    }
  });

  it('ALLOCATE_TO_SAVING(investment) → INCOME → INVESTMENT_FUND', () => {
    const events = toEngineEvents(allocSaving({ savingBucket: 'investment' }));
    if (events[0].type === 'TRANSFER_MONEY') {
      expectEqual(events[0].targetAccountId, INVESTMENT_FUND_ACCOUNT_ID);
    }
  });

  it('PAY_EXPENSE comes from SPENDING_ACCOUNT_ID', () => {
    const events = toEngineEvents(expense());
    if (events[0].type === 'CREATE_EXPENSE') {
      expectEqual(events[0].sourceAccountId, SPENDING_ACCOUNT_ID);
    }
  });

  it('PAY_BILL comes from SPENDING_ACCOUNT_ID', () => {
    const events = toEngineEvents(bill());
    if (events[0].type === 'CREATE_EXPENSE') {
      expectEqual(events[0].sourceAccountId, SPENDING_ACCOUNT_ID);
    }
  });

  it('MONTHLY_ROLLOVER flows SPENDING → INCOME', () => {
    const events = toEngineEvents(rollover());
    if (events[0].type === 'TRANSFER_MONEY') {
      expectEqual(events[0].sourceAccountId, SPENDING_ACCOUNT_ID);
      expectEqual(events[0].targetAccountId, INCOME_ACCOUNT_ID);
    }
  });

  it('REFUND defaults to SPENDING_ACCOUNT_ID target when not specified', () => {
    const events = toEngineEvents(refund({ targetAccountId: undefined }));
    if (events[0].type === 'CREATE_INCOME') {
      expectEqual(events[0].targetAccountId, SPENDING_ACCOUNT_ID);
    }
  });

  it('REFUND honors explicit targetAccountId override', () => {
    const events = toEngineEvents(refund({ targetAccountId: INCOME_ACCOUNT_ID }));
    if (events[0].type === 'CREATE_INCOME') {
      expectEqual(events[0].targetAccountId, INCOME_ACCOUNT_ID);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  No mutation of input
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — input immutability', () => {
  it('does not mutate INCOME_RECEIVED input', () => {
    const original = income();
    const snapshotBefore = JSON.stringify(original);
    toEngineEvents(original);
    expectEqual(JSON.stringify(original), snapshotBefore);
  });

  it('does not mutate ALLOCATE_TO_SAVING input including nested fields', () => {
    const original = allocSaving({ savingBucket: 'goals', goalId: 'g-1' });
    const snapshotBefore = JSON.stringify(original);
    toEngineEvents(original);
    expectEqual(JSON.stringify(original), snapshotBefore);
  });

  it('does not mutate MONTHLY_ROLLOVER input including audit object', () => {
    const auditObj: DomainAuditMetadata = {
      actor: 'system',
      createdAt: '2026-05-31T23:59:59Z',
      sourceUI: 'rollover-job',
    };
    const original = rollover({ audit: auditObj });
    const snapshotBefore = JSON.stringify(original);
    const auditBefore = JSON.stringify(auditObj);
    toEngineEvents(original);
    expectEqual(JSON.stringify(original), snapshotBefore);
    expectEqual(JSON.stringify(auditObj), auditBefore);
  });
});

// ════════════════════════════════════════════════════════════════════
//  Engine event id derivation
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — id derivation', () => {
  it('engine event id derives deterministically from domain id', () => {
    const events = toEngineEvents(income({ id: 'inc-xyz' }));
    expectEqual(events[0].id, 'inc-xyz-engine');
  });

  it('amount + occurredAt are passed through unchanged', () => {
    const e = income({ amount: 19_111_550, occurredAt: '2026-05-01T09:00:00.000Z' });
    const [out] = toEngineEvents(e);
    expectEqual(out.amount, 19_111_550);
    expectEqual(out.occurredAt, '2026-05-01T09:00:00.000Z');
  });
});

// ════════════════════════════════════════════════════════════════════
//  Error type
// ════════════════════════════════════════════════════════════════════

describe('DomainEventValidationError', () => {
  it('thrown errors are instances of DomainEventValidationError', () => {
    try {
      toEngineEvents(income({ amount: -1 }));
      throw new Error('should have thrown');
    } catch (err) {
      expectTrue(err instanceof DomainEventValidationError);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  Full mapping smoke (deep-equal one engine event for sanity)
// ════════════════════════════════════════════════════════════════════

describe('toEngineEvents — deep equality on canonical samples', () => {
  it('PAY_BILL produces the expected engine event shape', () => {
    const events = toEngineEvents(bill({
      id: 'bill-may-rent',
      amount: 2_500_000,
      occurredAt: '2026-05-05T09:00:00.000Z',
      billId: 'bill-rent',
      dueDay: 5,
      paidOnTime: true,
    }));
    expectDeepEqual(events[0], {
      id: 'bill-may-rent-engine',
      type: 'CREATE_EXPENSE',
      amount: 2_500_000,
      occurredAt: '2026-05-05T09:00:00.000Z',
      description: undefined,
      sourceAccountId: SPENDING_ACCOUNT_ID,
      metadata: {
        domainEventId: 'bill-may-rent',
        domainEventType: 'PAY_BILL',
        isBill: true,
        billId: 'bill-rent',
        dueDay: 5,
        paidOnTime: true,
      },
    });
  });
});
