/**
 * Shared fixtures for three-account test suites.
 *
 * Builds ledger entries via the real engine (executeFinanceEvent) so tests
 * exercise selectors against authentic ledger shapes — not hand-rolled
 * entries that could drift from engine semantics.
 */

import {
  GOAL_FUND_ACCOUNT_ID,
  INCOME_ACCOUNT_ID,
  INVESTMENT_FUND_ACCOUNT_ID,
  RESERVE_FUND_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import { executeFinanceEvent } from '@/core/finance/engine';
import type {
  FinanceEvent,
  FinanceMetadataValue,
  LedgerEntry,
} from '@/core/finance/types';
import type { FixedBillView } from '@/core/finance/threeAccountSelectors';

let eventCounter = 0;
function nextEventId(prefix: string): string {
  eventCounter += 1;
  return `${prefix}-${eventCounter}`;
}

/** Reset counter between tests for deterministic IDs. */
export function resetFixtureState(): void {
  eventCounter = 0;
}

interface BuildOpts {
  occurredAt?: string;
  metadata?: Record<string, FinanceMetadataValue>;
  description?: string;
}

export function incomeEvent(amount: number, opts: BuildOpts = {}): FinanceEvent {
  return {
    id: nextEventId('inc'),
    type: 'CREATE_INCOME',
    amount,
    occurredAt: opts.occurredAt ?? '2026-05-15T10:00:00.000Z',
    targetAccountId: INCOME_ACCOUNT_ID,
    description: opts.description,
    metadata: opts.metadata,
  };
}

export function transferEvent(
  amount: number,
  sourceAccountId: string,
  targetAccountId: string,
  opts: BuildOpts = {},
): FinanceEvent {
  return {
    id: nextEventId('xfer'),
    type: 'TRANSFER_MONEY',
    amount,
    occurredAt: opts.occurredAt ?? '2026-05-15T10:00:00.000Z',
    sourceAccountId,
    targetAccountId,
    description: opts.description,
    metadata: opts.metadata,
  };
}

export function expenseEvent(
  amount: number,
  sourceAccountId: string,
  opts: BuildOpts = {},
): FinanceEvent {
  return {
    id: nextEventId('exp'),
    type: 'CREATE_EXPENSE',
    amount,
    occurredAt: opts.occurredAt ?? '2026-05-15T10:00:00.000Z',
    sourceAccountId,
    description: opts.description,
    metadata: opts.metadata,
  };
}

/** Run a list of events through the engine and return the full ledger. */
export function buildLedger(events: FinanceEvent[]): LedgerEntry[] {
  let ledger: LedgerEntry[] = [];
  for (const event of events) {
    const result = executeFinanceEvent({ event, ledgerEntries: ledger });
    ledger = result.allLedgerEntries;
  }
  return ledger;
}

// ════════════════════════════════════════════════════════════════════
//  Scenario fixtures
// ════════════════════════════════════════════════════════════════════

/** Empty state — no events. */
export function emptyLedger(): LedgerEntry[] {
  return [];
}

/** Income 19.111.550đ landed in Income account, nothing allocated yet. */
export function unallocatedIncomeFixture(): LedgerEntry[] {
  resetFixtureState();
  return buildLedger([
    incomeEvent(19_111_550, { occurredAt: '2026-05-01T09:00:00.000Z' }),
  ]);
}

/** Demo seed allocation per ADR sample: 19.1M income, allocate 14.95M spending + 1.7M saving. */
export function fullySeededFixture(): LedgerEntry[] {
  resetFixtureState();
  return buildLedger([
    incomeEvent(19_111_550, { occurredAt: '2026-05-01T09:00:00.000Z' }),
    transferEvent(14_950_000, INCOME_ACCOUNT_ID, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:05:00.000Z',
      metadata: { monthKey: '2026-05', allocationSessionId: 'sess-1' },
    }),
    transferEvent(800_000, INCOME_ACCOUNT_ID, RESERVE_FUND_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:06:00.000Z',
      metadata: { monthKey: '2026-05', allocationSessionId: 'sess-1', subBucket: 'reserve' },
    }),
    transferEvent(500_000, INCOME_ACCOUNT_ID, GOAL_FUND_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:07:00.000Z',
      metadata: { monthKey: '2026-05', allocationSessionId: 'sess-1', subBucket: 'goals' },
    }),
    transferEvent(400_000, INCOME_ACCOUNT_ID, INVESTMENT_FUND_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:08:00.000Z',
      metadata: { monthKey: '2026-05', allocationSessionId: 'sess-1', subBucket: 'investment' },
    }),
    expenseEvent(120_000, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-03T12:00:00.000Z',
      metadata: { categoryId: 'food', isBill: false },
    }),
    expenseEvent(80_000, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-04T18:00:00.000Z',
      metadata: { categoryId: 'coffee', isBill: false },
    }),
    expenseEvent(2_500_000, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-05T09:00:00.000Z',
      metadata: { isBill: true, billId: 'bill-rent', dueDay: 5, paidOnTime: true },
    }),
  ]);
}

/** Fixture spanning 2 months — for monthKey filtering tests. */
export function multiMonthFixture(): LedgerEntry[] {
  resetFixtureState();
  return buildLedger([
    incomeEvent(10_000_000, { occurredAt: '2026-04-01T09:00:00.000Z' }),
    transferEvent(8_000_000, INCOME_ACCOUNT_ID, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-04-01T09:10:00.000Z',
    }),
    expenseEvent(300_000, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-04-05T10:00:00.000Z',
      metadata: { categoryId: 'food', isBill: false },
    }),
    incomeEvent(15_000_000, { occurredAt: '2026-05-01T09:00:00.000Z' }),
    transferEvent(12_000_000, INCOME_ACCOUNT_ID, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-01T09:10:00.000Z',
    }),
    expenseEvent(500_000, SPENDING_ACCOUNT_ID, {
      occurredAt: '2026-05-10T10:00:00.000Z',
      metadata: { categoryId: 'food', isBill: false },
    }),
  ]);
}

// ════════════════════════════════════════════════════════════════════
//  Fixed bill fixtures
// ════════════════════════════════════════════════════════════════════

export const SAMPLE_BILLS: FixedBillView[] = [
  { id: 'bill-rent', name: 'Tiền nhà', amount: 2_500_000, dueDay: 1, isPaid: true },
  { id: 'bill-electric', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: false },
  { id: 'bill-water', name: 'Tiền nước', amount: 100_000, dueDay: 15, isPaid: false },
  { id: 'bill-internet', name: 'Internet', amount: 200_000, dueDay: 20, isPaid: false },
];

export const SAMPLE_BILLS_ALL_PAID: FixedBillView[] = SAMPLE_BILLS.map((b) => ({
  ...b,
  isPaid: true,
}));

export const SAMPLE_BILLS_NONE_PAID: FixedBillView[] = SAMPLE_BILLS.map((b) => ({
  ...b,
  isPaid: false,
}));
