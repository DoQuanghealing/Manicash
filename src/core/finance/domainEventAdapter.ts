/**
 * Pure adapter: domain events → engine events.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §3.2-§3.3
 *   - docs/plans/phase-1-read-model.md §6
 *
 * ──────────────────────────────────────────────────────────────────
 * INVARIANTS (LA3 + LA8 + Day 6 spec):
 *   1. Pure function. No I/O. No store access. No side effects.
 *   2. Does NOT call `awardXP` or trigger any gamification.
 *   3. Does NOT mutate the input domain event.
 *   4. Output engine events carry `metadata.domainEventId` AND
 *      `metadata.domainEventType` so downstream code can re-group
 *      ledger entries back to a domain-level event.
 *   5. Amounts must be positive VND integers — adapter throws otherwise.
 *   6. Reverse / sensitive flows must carry `reason` + `audit.{actor,createdAt}`.
 * ──────────────────────────────────────────────────────────────────
 */

import {
  INCOME_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from './accounts';
import { getAccountIdForSavingBucket } from './accountRoles';
import type {
  AdjustmentEvent,
  AllocateToSavingEvent,
  AllocateToSpendingEvent,
  DomainAuditMetadata,
  DomainEvent,
  IncomeReceivedEvent,
  MonthlyRolloverEvent,
  PayBillEvent,
  PayExpenseEvent,
  ReallocateEvent,
  RefundEvent,
} from './domainEvents';
import type {
  CreateExpenseEvent,
  CreateIncomeEvent,
  FinanceEvent,
  FinanceMetadataValue,
  TransferMoneyEvent,
} from './types';

// ════════════════════════════════════════════════════════════════════
//  Public API
// ════════════════════════════════════════════════════════════════════

export class DomainEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainEventValidationError';
  }
}

/**
 * Convert a domain event into one or more engine-level FinanceEvent
 * primitives suitable for `executeFinanceEvent`.
 *
 * The output is a plain array — caller decides how to feed it to the
 * engine (e.g. `useFinanceCoreStore.executeMany(events)`).
 *
 * Throws `DomainEventValidationError` if the input fails validation.
 */
export function toEngineEvents(event: DomainEvent): FinanceEvent[] {
  validateDomainEvent(event);

  switch (event.type) {
    case 'INCOME_RECEIVED':
      return mapIncomeReceived(event);
    case 'ALLOCATE_TO_SPENDING':
      return mapAllocateToSpending(event);
    case 'ALLOCATE_TO_SAVING':
      return mapAllocateToSaving(event);
    case 'PAY_EXPENSE':
      return mapPayExpense(event);
    case 'PAY_BILL':
      return mapPayBill(event);
    case 'MONTHLY_ROLLOVER':
      return mapMonthlyRollover(event);
    case 'ADJUSTMENT':
      return mapAdjustment(event);
    case 'REALLOCATE':
      return mapReallocate(event);
    case 'REFUND':
      return mapRefund(event);
  }
}

// ════════════════════════════════════════════════════════════════════
//  Validation
// ════════════════════════════════════════════════════════════════════

function validateDomainEvent(event: DomainEvent): void {
  // Common: id, amount, occurredAt
  if (typeof event.id !== 'string' || event.id.length === 0) {
    throw new DomainEventValidationError('domain event requires non-empty id');
  }
  if (typeof event.amount !== 'number' || !Number.isFinite(event.amount)) {
    throw new DomainEventValidationError('amount must be a finite number');
  }
  if (!Number.isInteger(event.amount)) {
    throw new DomainEventValidationError(
      `amount must be an integer VND value (got ${event.amount})`,
    );
  }
  if (event.amount <= 0) {
    throw new DomainEventValidationError(
      `amount must be strictly positive (got ${event.amount})`,
    );
  }
  if (typeof event.occurredAt !== 'string' || event.occurredAt.length === 0) {
    throw new DomainEventValidationError('occurredAt must be a non-empty ISO timestamp');
  }

  // Per-type required fields
  switch (event.type) {
    case 'ALLOCATE_TO_SAVING':
      if (!event.savingBucket) {
        throw new DomainEventValidationError(
          'ALLOCATE_TO_SAVING requires savingBucket',
        );
      }
      break;

    case 'PAY_BILL':
      if (typeof event.billId !== 'string' || event.billId.length === 0) {
        throw new DomainEventValidationError('PAY_BILL requires billId');
      }
      if (typeof event.dueDay !== 'number' || !Number.isInteger(event.dueDay)) {
        throw new DomainEventValidationError('PAY_BILL requires integer dueDay');
      }
      break;

    case 'MONTHLY_ROLLOVER':
    case 'ADJUSTMENT':
    case 'REALLOCATE':
    case 'REFUND':
      requireReasonAndAudit(event);
      break;

    default:
      break;
  }

  // ADJUSTMENT must specify at least one of source/target account.
  if (event.type === 'ADJUSTMENT') {
    if (!event.sourceAccountId && !event.targetAccountId) {
      throw new DomainEventValidationError(
        'ADJUSTMENT requires at least one of sourceAccountId or targetAccountId',
      );
    }
  }

  // REALLOCATE must have both source + target.
  if (event.type === 'REALLOCATE') {
    if (!event.sourceAccountId || !event.targetAccountId) {
      throw new DomainEventValidationError(
        'REALLOCATE requires both sourceAccountId and targetAccountId',
      );
    }
    if (event.sourceAccountId === event.targetAccountId) {
      throw new DomainEventValidationError(
        'REALLOCATE source and target must differ',
      );
    }
  }
}

function requireReasonAndAudit(event: {
  reason?: string;
  audit?: DomainAuditMetadata;
  type: string;
}): void {
  if (typeof event.reason !== 'string' || event.reason.trim().length === 0) {
    throw new DomainEventValidationError(
      `${event.type} requires a non-empty reason`,
    );
  }
  if (!event.audit || typeof event.audit.actor !== 'string') {
    throw new DomainEventValidationError(
      `${event.type} requires audit.actor`,
    );
  }
  if (typeof event.audit.createdAt !== 'string' || event.audit.createdAt.length === 0) {
    throw new DomainEventValidationError(
      `${event.type} requires audit.createdAt`,
    );
  }
}

// ════════════════════════════════════════════════════════════════════
//  Mapping helpers — one per domain event type
// ════════════════════════════════════════════════════════════════════

function baseMetadata(event: DomainEvent): Record<string, FinanceMetadataValue> {
  return {
    domainEventId: event.id,
    domainEventType: event.type,
  };
}

function auditMetadata(audit: DomainAuditMetadata): Record<string, FinanceMetadataValue> {
  return {
    auditActor: audit.actor,
    auditCreatedAt: audit.createdAt,
    auditSourceUI: audit.sourceUI ?? null,
    auditRelatedEventId: audit.relatedEventId ?? null,
  };
}

function mapIncomeReceived(event: IncomeReceivedEvent): FinanceEvent[] {
  const engine: CreateIncomeEvent = {
    id: `${event.id}-engine`,
    type: 'CREATE_INCOME',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    targetAccountId: INCOME_ACCOUNT_ID,
    metadata: {
      ...baseMetadata(event),
      incomeKind: event.incomeKind ?? null,
      categoryId: event.categoryId ?? null,
    },
  };
  return [engine];
}

function mapAllocateToSpending(event: AllocateToSpendingEvent): FinanceEvent[] {
  const engine: TransferMoneyEvent = {
    id: `${event.id}-engine`,
    type: 'TRANSFER_MONEY',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: INCOME_ACCOUNT_ID,
    targetAccountId: SPENDING_ACCOUNT_ID,
    metadata: {
      ...baseMetadata(event),
      monthKey: event.monthKey,
      allocationSessionId: event.allocationSessionId ?? null,
    },
  };
  return [engine];
}

function mapAllocateToSaving(event: AllocateToSavingEvent): FinanceEvent[] {
  const target = getAccountIdForSavingBucket(event.savingBucket);
  const engine: TransferMoneyEvent = {
    id: `${event.id}-engine`,
    type: 'TRANSFER_MONEY',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: INCOME_ACCOUNT_ID,
    targetAccountId: target,
    metadata: {
      ...baseMetadata(event),
      savingBucket: event.savingBucket,
      monthKey: event.monthKey,
      allocationSessionId: event.allocationSessionId ?? null,
      goalId: event.goalId ?? null,
    },
  };
  return [engine];
}

function mapPayExpense(event: PayExpenseEvent): FinanceEvent[] {
  const engine: CreateExpenseEvent = {
    id: `${event.id}-engine`,
    type: 'CREATE_EXPENSE',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: SPENDING_ACCOUNT_ID,
    metadata: {
      ...baseMetadata(event),
      categoryId: event.categoryId,
      isBill: false,
    },
  };
  return [engine];
}

function mapPayBill(event: PayBillEvent): FinanceEvent[] {
  const engine: CreateExpenseEvent = {
    id: `${event.id}-engine`,
    type: 'CREATE_EXPENSE',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: SPENDING_ACCOUNT_ID,
    metadata: {
      ...baseMetadata(event),
      isBill: true,
      billId: event.billId,
      dueDay: event.dueDay,
      paidOnTime: event.paidOnTime ?? null,
    },
  };
  return [engine];
}

function mapMonthlyRollover(event: MonthlyRolloverEvent): FinanceEvent[] {
  const engine: TransferMoneyEvent = {
    id: `${event.id}-engine`,
    type: 'TRANSFER_MONEY',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: SPENDING_ACCOUNT_ID,
    targetAccountId: INCOME_ACCOUNT_ID,
    metadata: {
      ...baseMetadata(event),
      monthKeyFrom: event.monthKeyFrom,
      monthKeyTo: event.monthKeyTo,
      reason: event.reason,
      ...auditMetadata(event.audit),
    },
  };
  return [engine];
}

function mapAdjustment(event: AdjustmentEvent): FinanceEvent[] {
  const meta = {
    ...baseMetadata(event),
    reason: event.reason,
    ...auditMetadata(event.audit),
  };

  if (event.sourceAccountId && event.targetAccountId) {
    const engine: TransferMoneyEvent = {
      id: `${event.id}-engine`,
      type: 'TRANSFER_MONEY',
      amount: event.amount,
      occurredAt: event.occurredAt,
      description: event.description,
      sourceAccountId: event.sourceAccountId,
      targetAccountId: event.targetAccountId,
      metadata: meta,
    };
    return [engine];
  }

  if (event.targetAccountId) {
    // Money flowing in to an account from outside the ledger.
    const engine: CreateIncomeEvent = {
      id: `${event.id}-engine`,
      type: 'CREATE_INCOME',
      amount: event.amount,
      occurredAt: event.occurredAt,
      description: event.description,
      targetAccountId: event.targetAccountId,
      metadata: meta,
    };
    return [engine];
  }

  // event.sourceAccountId is guaranteed by validateDomainEvent.
  const engine: CreateExpenseEvent = {
    id: `${event.id}-engine`,
    type: 'CREATE_EXPENSE',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: event.sourceAccountId as string,
    metadata: meta,
  };
  return [engine];
}

function mapReallocate(event: ReallocateEvent): FinanceEvent[] {
  const engine: TransferMoneyEvent = {
    id: `${event.id}-engine`,
    type: 'TRANSFER_MONEY',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    sourceAccountId: event.sourceAccountId,
    targetAccountId: event.targetAccountId,
    metadata: {
      ...baseMetadata(event),
      reason: event.reason,
      ...auditMetadata(event.audit),
    },
  };
  return [engine];
}

function mapRefund(event: RefundEvent): FinanceEvent[] {
  const target = event.targetAccountId ?? SPENDING_ACCOUNT_ID;
  const engine: CreateIncomeEvent = {
    id: `${event.id}-engine`,
    type: 'CREATE_INCOME',
    amount: event.amount,
    occurredAt: event.occurredAt,
    description: event.description,
    targetAccountId: target,
    metadata: {
      ...baseMetadata(event),
      originalExpenseEventId: event.originalExpenseEventId ?? null,
      reason: event.reason,
      ...auditMetadata(event.audit),
    },
  };
  return [engine];
}
