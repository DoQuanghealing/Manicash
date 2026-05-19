/**
 * Legacy → Three-Account migration planner.
 *
 * Reference:
 *   - docs/adr/0001-three-account-model.md §7, §13, §15
 *   - docs/plans/phase-1-read-model.md §7
 *
 * ──────────────────────────────────────────────────────────────────
 * INVARIANTS (Phase 1 acceptance — LA1, LA2, LA5, LA6, LA8):
 *   1. PURE function. No I/O, no store reads, no engine execution.
 *   2. NEVER auto-applies. Caller is responsible for persisting
 *      `backupSnapshot` and then feeding `engineEvents` to the engine.
 *   3. Idempotent — calling with the same inputs returns the same
 *      plan; passing `existingBatchId` that matches the computed id
 *      returns a no-op plan.
 *   4. Emits backup payload regardless of plan content (LA6).
 *   5. Speaks in DOMAIN events first (ADJUSTMENT with audit), engine
 *      events derived via the adapter.
 *   6. NO `awardXP`, NO Zustand imports.
 *   7. Production mainBalance routing defaults to INCOME with
 *      `requiresUserConfirmation: true`. Auto 70/30 split is gated
 *      behind `isDemoUser=true` only (leadership 2026-05-19).
 * ──────────────────────────────────────────────────────────────────
 */

import {
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '../accounts';
import { toEngineEvents } from '../domainEventAdapter';
import type { AdjustmentEvent } from '../domainEvents';
import type { AccountId, FinanceEvent } from '../types';

// ════════════════════════════════════════════════════════════════════
//  Public types
// ════════════════════════════════════════════════════════════════════

export interface LegacyBalanceSnapshot {
  /** useFinanceStore.mainBalance — the ambiguous one (see §13.1). */
  mainBalance: number;
  /** useFinanceStore.billFundBalance — Phase 1 routes to SPENDING. */
  billFundBalance: number;
  /** useFinanceStore.emergencyBalance — legacy duplicate of reserve. */
  emergencyBalance: number;
  /** useDashboardStore.accounts.reserve.balance */
  reserveBalance: number;
  /** useDashboardStore.accounts.goals.balance */
  goalsBalance: number;
  /** useDashboardStore.accounts.investment.balance */
  investmentBalance: number;
}

export type MainBalanceRoute = 'income' | 'spending' | 'split-70-30';

export interface MigrationContext {
  /** Stable user identifier — part of the batch id. */
  userId: string;
  /** ISO timestamp anchor for the migration; also used as event occurredAt. */
  occurredAt: string;
  /** Routing decision for ambiguous `mainBalance` (see §13.2 of ADR). */
  mainBalanceRoute: MainBalanceRoute;
  /** If set and equals the computed batchId, planner returns isNoOp=true. */
  existingBatchId?: string;
  /** Demo/dev guard — true permits `split-70-30` heuristic apply. */
  isDemoUser?: boolean;
}

export interface MigrationPlan {
  /** Deterministic id derived from userId + occurredAt date. */
  batchId: string;
  /** Domain events (semantic layer — for human-readable audit). */
  domainEvents: AdjustmentEvent[];
  /** Engine events derived from domainEvents via the adapter. */
  engineEvents: FinanceEvent[];
  /** Copy of the legacy snapshot the caller MUST persist before applying. */
  backupSnapshot: LegacyBalanceSnapshot;
  /** Non-fatal warnings (e.g. production guard fallbacks). */
  warnings: string[];
  /** True when existingBatchId matched — caller should skip applying. */
  isNoOp: boolean;
  /** Pre-computed sum invariant (legacy total = new total) for caller assertion. */
  totalLegacy: number;
  totalNew: number;
}

export interface MainBalanceRouteSuggestion {
  /** Suggested portion to route to INCOME account. */
  income: number;
  /** Suggested portion to route to SPENDING account. */
  spending: number;
  /** Confidence in the heuristic. */
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable explanation for UI/log. */
  reason: string;
  /** Phase 2 wiring MUST show modal when true (production safety). */
  requiresUserConfirmation: boolean;
}

export interface SuggestMainBalanceRouteInput {
  mainBalance: number;
  totalCategoryLimits: number;
  totalFixedBills: number;
  /** Count of expenses in last 7 days. */
  recentExpenseCount: number;
  /** Did user pay any bill this month? */
  hasPaidBillThisMonth: boolean;
  /** TRUE only for demo/dev user — production must be FALSE/omitted. */
  isDemoUser?: boolean;
}

// ════════════════════════════════════════════════════════════════════
//  planMigration
// ════════════════════════════════════════════════════════════════════

export class MigrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationValidationError';
  }
}

export function computeBatchId(userId: string, occurredAt: string): string {
  // 'YYYY-MM-DD' prefix + userId — deterministic, predictable for tests.
  return `mig-${occurredAt.slice(0, 10)}-${userId}`;
}

export function planMigration(
  snapshot: LegacyBalanceSnapshot,
  context: MigrationContext,
): MigrationPlan {
  validateSnapshot(snapshot);
  validateContext(context);

  const batchId = computeBatchId(context.userId, context.occurredAt);
  const backupSnapshot = freezeSnapshot(snapshot);
  const totalLegacy = sumSnapshot(snapshot);

  // Idempotent guard — caller signals "already migrated this batch".
  if (context.existingBatchId === batchId) {
    return {
      batchId,
      domainEvents: [],
      engineEvents: [],
      backupSnapshot,
      warnings: [],
      isNoOp: true,
      totalLegacy,
      totalNew: 0,
    };
  }

  const warnings: string[] = [];
  const domainEvents: AdjustmentEvent[] = [];

  // 1. emergencyBalance + reserveBalance → RESERVE_FUND
  //    Both legacy fields conceptually map to reserve. Sum preserves
  //    total invariant. If user had drift between the two, this
  //    reconciles them into the new model.
  const totalReserve = snapshot.emergencyBalance + snapshot.reserveBalance;
  if (totalReserve > 0) {
    const sourceField =
      snapshot.emergencyBalance > 0 && snapshot.reserveBalance > 0
        ? 'emergencyBalance+reserveBalance'
        : snapshot.emergencyBalance > 0
          ? 'emergencyBalance'
          : 'reserveBalance';
    domainEvents.push(
      buildMigrationAdjustment({
        suffix: 'reserve',
        amount: totalReserve,
        targetAccountId: RESERVE_FUND_ACCOUNT_ID,
        sourceField,
        batchId,
        context,
      }),
    );
  }

  // 2. goalsBalance → GOAL_FUND
  if (snapshot.goalsBalance > 0) {
    domainEvents.push(
      buildMigrationAdjustment({
        suffix: 'goals',
        amount: snapshot.goalsBalance,
        targetAccountId: GOAL_FUND_ACCOUNT_ID,
        sourceField: 'goalsBalance',
        batchId,
        context,
      }),
    );
  }

  // 3. investmentBalance → INVESTMENT_FUND
  if (snapshot.investmentBalance > 0) {
    domainEvents.push(
      buildMigrationAdjustment({
        suffix: 'investment',
        amount: snapshot.investmentBalance,
        targetAccountId: INVESTMENT_FUND_ACCOUNT_ID,
        sourceField: 'investmentBalance',
        batchId,
        context,
      }),
    );
  }

  // 4. billFundBalance → SPENDING (Phase 1: merged)
  if (snapshot.billFundBalance > 0) {
    domainEvents.push(
      buildMigrationAdjustment({
        suffix: 'billfund',
        amount: snapshot.billFundBalance,
        targetAccountId: SPENDING_ACCOUNT_ID,
        sourceField: 'billFundBalance',
        batchId,
        context,
      }),
    );
  }

  // 5. mainBalance → route-dependent
  if (snapshot.mainBalance > 0) {
    const route = resolveSafeMainBalanceRoute(context, warnings);
    switch (route) {
      case 'income':
        domainEvents.push(
          buildMigrationAdjustment({
            suffix: 'main-income',
            amount: snapshot.mainBalance,
            targetAccountId: INCOME_ACCOUNT_ID,
            sourceField: 'mainBalance',
            batchId,
            context,
          }),
        );
        break;
      case 'spending':
        domainEvents.push(
          buildMigrationAdjustment({
            suffix: 'main-spending',
            amount: snapshot.mainBalance,
            targetAccountId: SPENDING_ACCOUNT_ID,
            sourceField: 'mainBalance',
            batchId,
            context,
          }),
        );
        break;
      case 'split-70-30': {
        // Deterministic rounding: spending = round(0.7 * X),
        // income = remainder. Guarantees sum exactness.
        const spendingPortion = Math.round(snapshot.mainBalance * 0.7);
        const incomePortion = snapshot.mainBalance - spendingPortion;
        if (spendingPortion > 0) {
          domainEvents.push(
            buildMigrationAdjustment({
              suffix: 'main-spending-70',
              amount: spendingPortion,
              targetAccountId: SPENDING_ACCOUNT_ID,
              sourceField: 'mainBalance × 0.7',
              batchId,
              context,
            }),
          );
        }
        if (incomePortion > 0) {
          domainEvents.push(
            buildMigrationAdjustment({
              suffix: 'main-income-30',
              amount: incomePortion,
              targetAccountId: INCOME_ACCOUNT_ID,
              sourceField: 'mainBalance × 0.3 (remainder)',
              batchId,
              context,
            }),
          );
        }
        break;
      }
    }
  }

  const engineEvents = domainEvents.flatMap(toEngineEvents);
  const totalNew = domainEvents.reduce((sum, e) => sum + e.amount, 0);

  return {
    batchId,
    domainEvents,
    engineEvents,
    backupSnapshot,
    warnings,
    isNoOp: false,
    totalLegacy,
    totalNew,
  };
}

// ════════════════════════════════════════════════════════════════════
//  suggestMainBalanceRoute — heuristic, suggestion-only
// ════════════════════════════════════════════════════════════════════

export function suggestMainBalanceRoute(
  input: SuggestMainBalanceRouteInput,
): MainBalanceRouteSuggestion {
  if (input.mainBalance < 0 || !Number.isFinite(input.mainBalance)) {
    return {
      income: 0,
      spending: 0,
      confidence: 'low',
      reason: 'Invalid mainBalance — defaulting to zero',
      requiresUserConfirmation: true,
    };
  }

  // ── DEMO / DEV ONLY: auto-route 70/30 cho trải nghiệm đẹp ──
  // Production user phải nhận route 'income' với requiresUserConfirmation=true.
  const isDevOrDemo = isDemoOrDev(input.isDemoUser);

  if (
    isDevOrDemo &&
    input.hasPaidBillThisMonth &&
    input.mainBalance <= input.totalCategoryLimits + input.totalFixedBills &&
    input.recentExpenseCount >= 3
  ) {
    const spending = Math.round(input.mainBalance * 0.7);
    const income = input.mainBalance - spending;
    return {
      income,
      spending,
      confidence: 'high',
      reason:
        'Demo/dev only: user has bill history + recent expenses + small mainBalance — 70/30 split applied',
      requiresUserConfirmation: false,
    };
  }

  // ── PRODUCTION DEFAULT ──
  return {
    income: input.mainBalance,
    spending: 0,
    confidence: 'low',
    reason:
      'Legacy mainBalance is ambiguous — defaulting to Income; user must confirm allocation',
    requiresUserConfirmation: true,
  };
}

// ════════════════════════════════════════════════════════════════════
//  Internal helpers
// ════════════════════════════════════════════════════════════════════

function isDemoOrDev(isDemoUser: boolean | undefined): boolean {
  if (isDemoUser === true) return true;
  if (typeof process === 'undefined') return false;
  return process.env?.NODE_ENV === 'development';
}

/** Falls back from split-70-30 to income if production guard violated. */
function resolveSafeMainBalanceRoute(
  context: MigrationContext,
  warnings: string[],
): MainBalanceRoute {
  if (context.mainBalanceRoute !== 'split-70-30') {
    return context.mainBalanceRoute;
  }
  if (!isDemoOrDev(context.isDemoUser)) {
    warnings.push(
      'split-70-30 attempted in production context (isDemoUser !== true) — falling back to income route',
    );
    return 'income';
  }
  return 'split-70-30';
}

function buildMigrationAdjustment(args: {
  suffix: string;
  amount: number;
  targetAccountId: AccountId;
  sourceField: string;
  batchId: string;
  context: MigrationContext;
}): AdjustmentEvent {
  return {
    id: `${args.batchId}-${args.suffix}`,
    type: 'ADJUSTMENT',
    amount: args.amount,
    occurredAt: args.context.occurredAt,
    targetAccountId: args.targetAccountId,
    reason: `Legacy migration: ${args.sourceField} → ${args.targetAccountId}`,
    audit: {
      actor: 'migration',
      createdAt: args.context.occurredAt,
      sourceUI: 'legacy-to-three-account-v1',
      relatedEventId: args.batchId,
    },
  };
}

function validateSnapshot(snapshot: LegacyBalanceSnapshot): void {
  const fields: Array<keyof LegacyBalanceSnapshot> = [
    'mainBalance',
    'billFundBalance',
    'emergencyBalance',
    'reserveBalance',
    'goalsBalance',
    'investmentBalance',
  ];
  for (const field of fields) {
    const value = snapshot[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new MigrationValidationError(
        `snapshot.${field} must be a finite number (got ${value})`,
      );
    }
    if (!Number.isInteger(value)) {
      throw new MigrationValidationError(
        `snapshot.${field} must be an integer VND value (got ${value})`,
      );
    }
    if (value < 0) {
      throw new MigrationValidationError(
        `snapshot.${field} must be non-negative (got ${value})`,
      );
    }
  }
}

function validateContext(context: MigrationContext): void {
  if (typeof context.userId !== 'string' || context.userId.length === 0) {
    throw new MigrationValidationError('context.userId must be a non-empty string');
  }
  if (typeof context.occurredAt !== 'string' || context.occurredAt.length < 10) {
    throw new MigrationValidationError(
      'context.occurredAt must be an ISO timestamp string',
    );
  }
  const route = context.mainBalanceRoute;
  if (route !== 'income' && route !== 'spending' && route !== 'split-70-30') {
    throw new MigrationValidationError(
      `context.mainBalanceRoute invalid (got ${String(route)})`,
    );
  }
}

function freezeSnapshot(snapshot: LegacyBalanceSnapshot): LegacyBalanceSnapshot {
  return {
    mainBalance: snapshot.mainBalance,
    billFundBalance: snapshot.billFundBalance,
    emergencyBalance: snapshot.emergencyBalance,
    reserveBalance: snapshot.reserveBalance,
    goalsBalance: snapshot.goalsBalance,
    investmentBalance: snapshot.investmentBalance,
  };
}

function sumSnapshot(snapshot: LegacyBalanceSnapshot): number {
  return (
    snapshot.mainBalance +
    snapshot.billFundBalance +
    snapshot.emergencyBalance +
    snapshot.reserveBalance +
    snapshot.goalsBalance +
    snapshot.investmentBalance
  );
}
