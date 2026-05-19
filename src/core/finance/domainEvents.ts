/**
 * Domain event vocabulary for the 3-account model.
 *
 * Speaks the language of product (Thu nhập, Chi tiêu, Tiết kiệm, Bill,
 * Rollover) rather than ledger primitives (CREATE_INCOME / TRANSFER /
 * CREATE_EXPENSE). Mapping to engine events happens in
 * `domainEventAdapter.ts`.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §3
 *   - docs/plans/phase-1-read-model.md §6
 *
 * ──────────────────────────────────────────────────────────────────
 * Audit & metadata invariants (leadership 2026-05-19):
 *   - "Reverse" or sensitive flows MUST carry `reason` + `audit`:
 *     MONTHLY_ROLLOVER, ADJUSTMENT, REALLOCATE, REFUND.
 *   - `audit.actor` and `audit.createdAt` are required on those events.
 *   - PAY_BILL must carry billId + dueDay.
 *   - ALLOCATE_TO_SAVING must carry savingBucket.
 *   - Amounts are VND integers, strictly positive.
 * ──────────────────────────────────────────────────────────────────
 */

import type { AccountId } from './types';

export type DomainEventType =
  | 'INCOME_RECEIVED'
  | 'ALLOCATE_TO_SPENDING'
  | 'ALLOCATE_TO_SAVING'
  | 'PAY_EXPENSE'
  | 'PAY_BILL'
  | 'MONTHLY_ROLLOVER'
  | 'ADJUSTMENT'
  | 'REALLOCATE'
  | 'REFUND';

export type DomainAuditActor = 'user' | 'system' | 'admin' | 'migration';

export interface DomainAuditMetadata {
  actor: DomainAuditActor;
  /** ISO timestamp when the action was initiated (separate from the
   *  financial occurredAt). */
  createdAt: string;
  /** Optional — for tracing UI origin (e.g. 'overview-edit'). */
  sourceUI?: string;
  /** Optional — link back to a related engine/domain event id. */
  relatedEventId?: string;
}

export type SavingBucket = 'reserve' | 'goals' | 'investment';

// ════════════════════════════════════════════════════════════════════
//  Event shapes
// ════════════════════════════════════════════════════════════════════

interface DomainEventBase {
  /** Unique id assigned by the caller. */
  id: string;
  /** VND integer, strictly positive. Validated by the adapter. */
  amount: number;
  /** ISO timestamp of when the financial action happened. */
  occurredAt: string;
  /** Optional free-form description for UI/audit logs. */
  description?: string;
}

export interface IncomeReceivedEvent extends DomainEventBase {
  type: 'INCOME_RECEIVED';
  /** e.g. 'salary' | 'freelance' | 'bonus' | 'gift'. Optional. */
  incomeKind?: string;
  /** Category id from the user's income category list. Optional. */
  categoryId?: string;
}

export interface AllocateToSpendingEvent extends DomainEventBase {
  type: 'ALLOCATE_TO_SPENDING';
  /** Month for the allocation, format 'YYYY-MM'. */
  monthKey: string;
  /** Anti-spam XP grouping — same id across sub-events of one
   *  allocation session. Optional in Phase 1. */
  allocationSessionId?: string;
}

export interface AllocateToSavingEvent extends DomainEventBase {
  type: 'ALLOCATE_TO_SAVING';
  /** REQUIRED — which saving sub-bucket receives the money. */
  savingBucket: SavingBucket;
  /** Month for the allocation, format 'YYYY-MM'. */
  monthKey: string;
  allocationSessionId?: string;
  /** Optional link to a Goal entity when bucket is 'goals'. */
  goalId?: string;
}

export interface PayExpenseEvent extends DomainEventBase {
  type: 'PAY_EXPENSE';
  /** Category id from the user's expense category list. */
  categoryId: string;
}

export interface PayBillEvent extends DomainEventBase {
  type: 'PAY_BILL';
  /** REQUIRED — id of the fixed bill being paid. */
  billId: string;
  /** REQUIRED — day-of-month the bill was due. */
  dueDay: number;
  /** Optional — true if paid on/before dueDay. Caller computes. */
  paidOnTime?: boolean;
}

export interface MonthlyRolloverEvent extends DomainEventBase {
  type: 'MONTHLY_ROLLOVER';
  /** Month that just ended, format 'YYYY-MM'. */
  monthKeyFrom: string;
  /** Month starting, format 'YYYY-MM'. */
  monthKeyTo: string;
  /** REQUIRED — short reason string. */
  reason: string;
  /** REQUIRED — audit trail. */
  audit: DomainAuditMetadata;
}

export interface AdjustmentEvent extends DomainEventBase {
  type: 'ADJUSTMENT';
  /** Provide one or both:
   *    - {targetAccountId}                → money in (e.g. correction up)
   *    - {sourceAccountId}                → money out (e.g. correction down)
   *    - {sourceAccountId, targetAccountId} → transfer between accounts
   */
  sourceAccountId?: AccountId;
  targetAccountId?: AccountId;
  reason: string;
  audit: DomainAuditMetadata;
}

export interface ReallocateEvent extends DomainEventBase {
  type: 'REALLOCATE';
  sourceAccountId: AccountId;
  targetAccountId: AccountId;
  reason: string;
  audit: DomainAuditMetadata;
}

export interface RefundEvent extends DomainEventBase {
  type: 'REFUND';
  /** Optional — links back to the original expense being refunded. */
  originalExpenseEventId?: string;
  /** Optional — defaults to SPENDING_ACCOUNT_ID if absent. */
  targetAccountId?: AccountId;
  reason: string;
  audit: DomainAuditMetadata;
}

export type DomainEvent =
  | IncomeReceivedEvent
  | AllocateToSpendingEvent
  | AllocateToSavingEvent
  | PayExpenseEvent
  | PayBillEvent
  | MonthlyRolloverEvent
  | AdjustmentEvent
  | ReallocateEvent
  | RefundEvent;

// ════════════════════════════════════════════════════════════════════
//  Convenience: type guards (used by tests + Phase 2 wiring)
// ════════════════════════════════════════════════════════════════════

export function isReverseOrSensitiveFlow(
  event: DomainEvent,
): event is MonthlyRolloverEvent | AdjustmentEvent | ReallocateEvent | RefundEvent {
  return (
    event.type === 'MONTHLY_ROLLOVER' ||
    event.type === 'ADJUSTMENT' ||
    event.type === 'REALLOCATE' ||
    event.type === 'REFUND'
  );
}

export const REVERSE_OR_SENSITIVE_FLOW_TYPES: readonly DomainEventType[] = [
  'MONTHLY_ROLLOVER',
  'ADJUSTMENT',
  'REALLOCATE',
  'REFUND',
] as const;

export const ALL_DOMAIN_EVENT_TYPES: readonly DomainEventType[] = [
  'INCOME_RECEIVED',
  'ALLOCATE_TO_SPENDING',
  'ALLOCATE_TO_SAVING',
  'PAY_EXPENSE',
  'PAY_BILL',
  'MONTHLY_ROLLOVER',
  'ADJUSTMENT',
  'REALLOCATE',
  'REFUND',
] as const;
