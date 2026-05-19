/**
 * Day 7-9 sample — prints MigrationPlan output for the 2 typical paths:
 *   1. Production user (default — income route, requiresUserConfirmation=true)
 *   2. Demo user (split-70-30 heuristic)
 */

import {
  planMigration,
  suggestMainBalanceRoute,
} from '@/core/finance/migrations/legacyToThreeAccount';

const LEGACY_SNAPSHOT = {
  mainBalance: 15_000_000,
  billFundBalance: 8_500_000,
  emergencyBalance: 5_000_000,
  reserveBalance: 3_000_000,
  goalsBalance: 2_500_000,
  investmentBalance: 1_200_000,
};

function divider(title: string): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════════════════════');
}

// ── 1. Production user (default) ─────────────────────────────────────
divider('1. PRODUCTION user — route=income (no auto split)');
const prodSuggestion = suggestMainBalanceRoute({
  mainBalance: LEGACY_SNAPSHOT.mainBalance,
  totalCategoryLimits: 9_800_000,
  totalFixedBills: 3_150_000,
  recentExpenseCount: 5,
  hasPaidBillThisMonth: true,
  // isDemoUser omitted → production
});
console.log('suggestMainBalanceRoute output:');
console.log(JSON.stringify(prodSuggestion, null, 2));
console.log('');
console.log('→ Plan with route=income:');
const prodPlan = planMigration(LEGACY_SNAPSHOT, {
  userId: 'user-prod-001',
  occurredAt: '2026-05-19T10:00:00.000Z',
  mainBalanceRoute: 'income',
});
console.log(`batchId:        ${prodPlan.batchId}`);
console.log(`totalLegacy:    ${prodPlan.totalLegacy}`);
console.log(`totalNew:       ${prodPlan.totalNew}`);
console.log(`isNoOp:         ${prodPlan.isNoOp}`);
console.log(`warnings:       ${JSON.stringify(prodPlan.warnings)}`);
console.log(`domainEvents:   ${prodPlan.domainEvents.length}`);
console.log(`engineEvents:   ${prodPlan.engineEvents.length}`);
console.log('');
console.log('Domain events:');
for (const e of prodPlan.domainEvents) {
  console.log(`  - ${e.amount.toLocaleString('vi-VN')}đ  →  ${e.targetAccountId}  (${e.reason})`);
}

// ── 2. Demo user (split-70-30) ───────────────────────────────────────
divider('2. DEMO user — heuristic auto split-70-30');
const demoSuggestion = suggestMainBalanceRoute({
  mainBalance: 5_000_000, // smaller mainBalance to trigger split heuristic
  totalCategoryLimits: 4_000_000,
  totalFixedBills: 3_000_000,
  recentExpenseCount: 5,
  hasPaidBillThisMonth: true,
  isDemoUser: true,
});
console.log('suggestMainBalanceRoute output:');
console.log(JSON.stringify(demoSuggestion, null, 2));
console.log('');
console.log('→ Plan with route=split-70-30:');
const demoPlan = planMigration(
  { ...LEGACY_SNAPSHOT, mainBalance: 5_000_000 },
  {
    userId: 'user-demo-001',
    occurredAt: '2026-05-19T10:00:00.000Z',
    mainBalanceRoute: 'split-70-30',
    isDemoUser: true,
  },
);
console.log(`batchId:        ${demoPlan.batchId}`);
console.log(`totalLegacy:    ${demoPlan.totalLegacy}`);
console.log(`totalNew:       ${demoPlan.totalNew}`);
console.log(`warnings:       ${JSON.stringify(demoPlan.warnings)}`);
console.log(`domainEvents:   ${demoPlan.domainEvents.length}`);
console.log('');
console.log('Domain events:');
for (const e of demoPlan.domainEvents) {
  console.log(`  - ${e.amount.toLocaleString('vi-VN')}đ  →  ${e.targetAccountId}  (${e.reason})`);
}

// ── 3. Production guard ──────────────────────────────────────────────
divider('3. PRODUCTION user attempts split-70-30 → falls back to income');
const guardPlan = planMigration(
  { ...LEGACY_SNAPSHOT, mainBalance: 5_000_000 },
  {
    userId: 'user-prod-002',
    occurredAt: '2026-05-19T10:00:00.000Z',
    mainBalanceRoute: 'split-70-30',
    // isDemoUser intentionally omitted
  },
);
console.log(`warnings:`);
for (const w of guardPlan.warnings) {
  console.log(`  - ${w}`);
}
console.log(`mainBalance routed to: ${guardPlan.domainEvents.find((e) => e.reason.includes('mainBalance'))?.targetAccountId}`);

// ── 4. Idempotent rerun ──────────────────────────────────────────────
divider('4. IDEMPOTENT rerun (caller signals "already migrated")');
const replay = planMigration(LEGACY_SNAPSHOT, {
  userId: 'user-prod-001',
  occurredAt: '2026-05-19T10:00:00.000Z',
  mainBalanceRoute: 'income',
  existingBatchId: prodPlan.batchId,
});
console.log(`isNoOp:         ${replay.isNoOp}`);
console.log(`domainEvents:   ${replay.domainEvents.length}`);
console.log(`backupSnapshot still present: ${Object.keys(replay.backupSnapshot).length > 0}`);
console.log('');
