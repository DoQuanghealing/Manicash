# Money Brain — Phase 1: Isomorphic Engine + UI Refactor

**Date:** 2026-06-08  
**Branch:** codex/ai-money-chat (uncommitted)  
**Status:** ✅ COMPLETE

---

## Summary

Phase 1 delivered the Isomorphic Money Brain: a set of pure TypeScript engine modules
shared by UI selectors and the Chat server handler — eliminating dual-source-of-truth
number discrepancies between what the UI displays and what the AI narrates.

---

## Deliverables

### 1. Engine Modules (`src/lib/moneyBrain/`)

| File | Exports | Purpose |
|------|---------|---------|
| `financeMetrics.ts` | 8 functions | Income, expense, net cashflow, savings rate, top categories, largest txns |
| `budgetMetrics.ts` | 7 functions | Budget spent recomputed from transactions (no trust in `budget.spent` field) |
| `billMetrics.ts` | 7 functions | Upcoming bills, unpaid total, fund coverage rate/gap |
| `goalMetrics.ts` | 7 functions | Progress list, at-risk goals, planned monthly contributions |
| `taskMetrics.ts` | 8 functions | Task status, pipeline, actual income per period, subtask progress |
| `safeToSpend.ts` | 1 function | Formula v1.1: income + carryOver − budget − unpaid bills − goal contrib/month |
| `healthScore.ts` | 1 function | Deterministic 6-component score (100 pts max), no LLM |
| `index.ts` | barrel | Re-exports all engine + types + dateRange + normalize + snapshot |

All modules:
- **Pure TypeScript** — no React, Zustand, or API imports
- **Isomorphic** — same function runs in UI hooks and Chat server handlers
- **Timezone-safe** — read `snapshot.clientNow + snapshot.timezone`, never call `Date.now()`
- **budget.spent not trusted** — `computeBudgetSpentByCategory` recomputes from transactions

### 2. Formula v1.1 — Safe-to-Spend

```
safeToSpend = monthlyIncome
            + carryOver
            − plannedMonthlyBudget       (sum of this month's category limits)
            − totalUnpaidBills           (ONLY unpaid bills, not all bills)
            − plannedMonthlyGoalContributions  (sum of goal.monthlyContributionTarget)
```

Status thresholds:
- `safe` → safeToSpend > 1 000 000
- `caution` → safeToSpend in (0, 1 000 000]
- `danger` → safeToSpend ≤ 0

### 3. Health Score — Deterministic 6-Component Formula

| Component | Max pts | Thresholds |
|-----------|---------|------------|
| cashflow | 25 | net>0→25, net=0→12, net<0→0 |
| billCoverage | 20 | no unpaid or fund≥unpaid→20, rate≥0.5→10, else→0 |
| emergencyRunway | 20 | runway≥3mo→20, ≥1mo→10, else→0 |
| budgetDiscipline | 15 | 0 overbudget→15, 1→8, 2+→0 |
| goalProgress | 10 | plannedContrib>0→10, totalSaved>0→5, else→0 |
| incomePipeline | 10 | activeTasks>0→10, else→0 |

LLM only narrates; score is always deterministic.

### 4. Bridge Hook — `src/hooks/useMoneySnapshotV1.ts`

Selective Zustand subscriptions → `useMemo` → `MoneySnapshotV1`.
Subscribed stores: `useFinanceStore`, `useBudgetStore`, `useGoalsStore`, `useTaskStore`.
All transactions passed (engine filters by period internally).
Category IDs normalized via `normalizeCategoryId` on the way in.

### 5. `useSafeBalance.ts` Refactored

Now calls `useMoneySnapshotV1()` + `getSafeToSpendBreakdown(snapshot)`.
Backward-compatible return shape maintained:

| Old field | Old source | New source |
|-----------|-----------|-----------|
| `totalBills` | all fixed bills | unpaid bills only (**v1.1**) |
| `totalSavings` | dashboard savings (reserve+goals+invest) | `plannedMonthlyGoalContributions` (**v1.1**) |
| `isLow` | `status === 'low'` | `status === 'caution'` (engine name) |
| `safeToSpend` | `accountOverviewMath.ts` | `safeToSpend.ts` engine |

### 6. SafeToSpendCard Labels Updated

| Before | After |
|--------|-------|
| `− Bill cố định` | `− Bill chưa đóng` |
| `− Tiết kiệm (DP+MT+ĐT)` | `− Mục tiêu tiết kiệm/tháng` |
| Modal: `[Bill cố định]` | Modal: `[Bill chưa đóng]` |
| Modal: `[Tiết kiệm tháng]` | Modal: `[Mục tiêu tiết kiệm/tháng]` |

### 7. SEED_GOALS — `monthlyContributionTarget` Added

| Goal | monthlyContributionTarget |
|------|--------------------------|
| Mua nhà 🏠 | 5 000 000 đ |
| Quỹ khẩn cấp 🛡️ | 2 000 000 đ |
| Xe ô tô 🚗 | 3 000 000 đ |
| Vốn đầu tư 📈 | 1 500 000 đ |

### 8. HealthScoreGauge — Pre-Satisfied

`MoneyContent` already wires `HealthScoreGauge` to `breakdown.total` from
`useCFOSnapshot()` which calls the local `computeHealthScore()` — not AI-returned.
Migration from old formula → new Phase 1 `getFinancialHealthScore` is a separate
follow-up (both are deterministic; no user-facing regression).

---

## Test Results

| Suite | Assertions | Status |
|-------|-----------|--------|
| `moneybrain-date` | 19 | ✅ PASS |
| `moneybrain-normalize` | 4 | ✅ PASS |
| `moneybrain-summary` | 7 | ✅ PASS |
| `moneybrain-finance-metrics` | 10 | ✅ PASS |
| `moneybrain-budget-metrics` | 8 | ✅ PASS |
| `moneybrain-bill-metrics` | 10 | ✅ PASS |
| `moneybrain-goal-metrics` | 10 | ✅ PASS |
| `moneybrain-task-metrics` | 12 | ✅ PASS |
| `moneybrain-safe-to-spend` | 11 | ✅ PASS |
| `moneybrain-health-score` | 16 | ✅ PASS |
| **Total moneyBrain** | **107** | ✅ |
| `ai-intent` | 17 | ✅ PASS |
| `ai-handlers` | 11 | ✅ PASS |
| `ai-client-snapshot` | 3 | ✅ PASS |
| `ai-queries` | 11 | ✅ PASS |
| `ai-spending-period` | 5 | ✅ PASS |
| **Total ai-money** | **47** | ✅ |

**TypeScript:** `npx tsc --noEmit` → **0 errors**

---

## Files Changed

### New files
- `src/lib/moneyBrain/financeMetrics.ts`
- `src/lib/moneyBrain/budgetMetrics.ts`
- `src/lib/moneyBrain/billMetrics.ts`
- `src/lib/moneyBrain/goalMetrics.ts`
- `src/lib/moneyBrain/taskMetrics.ts`
- `src/lib/moneyBrain/safeToSpend.ts`
- `src/lib/moneyBrain/healthScore.ts`
- `src/lib/moneyBrain/index.ts`
- `src/hooks/useMoneySnapshotV1.ts`
- `tests/moneybrain-finance-metrics.test.ts`
- `tests/moneybrain-budget-metrics.test.ts`
- `tests/moneybrain-bill-metrics.test.ts`
- `tests/moneybrain-goal-metrics.test.ts`
- `tests/moneybrain-task-metrics.test.ts`
- `tests/moneybrain-safe-to-spend.test.ts`
- `tests/moneybrain-health-score.test.ts`

### Modified files
- `src/lib/moneyBrain/dateRange.ts` — export `shiftDateKey`
- `src/lib/moneyBrain/financeSummary.ts` — backward-compat shim re-exporting from financeMetrics
- `src/lib/moneyBrain/snapshot.ts` — already existed (Phase 0)
- `src/hooks/useSafeBalance.ts` — refactored to engine
- `src/stores/useGoalsStore.ts` — SEED_GOALS + `monthlyContributionTarget`
- `src/app/(app)/overview/_components/SafeToSpendCard.tsx` — updated labels
- `package.json` — added 9 new test:mb-* scripts

---

## Invariants Preserved

- **No commit made** — per spec prohibition
- **No push made**
- **No merge to main**
- **No .env.local committed**
- **Server still only returns actionRequest** — client executes Zustand actions
- **All engine functions are pure** — no React/Zustand/API imports
- **clientNow + timezone** passed in snapshot, never calling `Date.now()` inside engine

---

## Known Follow-ups (Post-Phase-1)

1. **HealthScoreGauge migration**: swap `cfoHealthScore.computeHealthScore` → `moneyBrain.getFinancialHealthScore` for full isomorphic consistency
2. **CategoryBreakdownPanel**: already recomputes spent from transactions via its own `useMemo`; can optionally adopt `computeBudgetSpentByCategory` to eliminate the last dual-path
3. **CarryOver from snapshot**: `useAccountOverviewStore.buildAccountOverviewSnapshot` still computes its own safe-to-spend for the old `accounts.safeToSpend` field (used in overview layout); a later PR can redirect that too
