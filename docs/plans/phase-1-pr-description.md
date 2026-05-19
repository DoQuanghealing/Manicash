# Phase 1 — Three-Account Model: Foundation (read model + migration planner)

| Field | Value |
|-------|-------|
| Status | Ready for review — Day 10 acceptance sweep passed 2026-05-19 |
| Parent ADR | [docs/adr/0001-three-account-model.md](../adr/0001-three-account-model.md) |
| Plan | [docs/plans/phase-1-read-model.md](phase-1-read-model.md) |
| Debt tracker | [docs/plans/pre-existing-build-lint-debt.md](pre-existing-build-lint-debt.md) |

---

## 1. Summary

This PR establishes the **foundation** for migrating ManiCash from the legacy 3-wallet model (Main / Emergency / BillFund) to the new 3-account product model (**Thu nhập / Chi tiêu / Tiết kiệm**) approved in ADR 0001.

**Phase 1 introduces no user-visible change.** Every new code path is gated by `NEW_THREE_ACCOUNT_MODEL` (default **OFF**) and the legacy Overview / Ledger / Money tabs continue to work identically. UI redesign, allocation modal, and actual data migration are explicitly deferred to Phase 2-4.

What this PR delivers:
- 11 pure selectors + 1 snapshot builder over the FinanceCore ledger
- 9-event domain layer + adapter → engine primitives
- Plan-only migration helper (no auto-execute) with backup payload + idempotent batchId
- 3 feature flags wired into `useAccountOverviewStore` (dual-read available, not surfaced)
- 194 new tests, 0 regression on existing 25 tests
- 1 build blocker (`DEBT-001`) resolved as part of the wiring gate

---

## 2. Why

ADR 0001 §1.2 — legacy 3-wallet model breaks mental model: BillFund as a top-level wallet adds cognitive load, Safe-to-Spend is confusingly displayed as a balance, and `splitFunds` forces users to allocate immediately. The new model speaks the language users actually need: tiền vào (Income), tiền sống (Spending), tiền xây tương lai (Saving).

Phase 1 builds the math/data layer first so Phase 2 UI work can ship without re-deriving balances at the component level, and so future migration of real user data has a deterministic, auditable, rollback-safe path.

---

## 3. What changed

### New runtime files

| File | Purpose |
|------|---------|
| `src/lib/featureFlags.ts` | Single source of truth for 3 flags — strict `'true'` env semantics |
| `src/core/finance/accountRoles.ts` | Logical role → ledger account mapping |
| `src/core/finance/threeAccountSelectors.ts` | 11 pure selectors over `LedgerEntry[]` |
| `src/core/finance/threeAccountSnapshot.ts` | `buildThreeAccountSnapshot(input)` aggregating snapshot |
| `src/core/finance/domainEvents.ts` | 9 semantic event types (INCOME_RECEIVED / ALLOCATE_TO_* / PAY_* / MONTHLY_ROLLOVER / ADJUSTMENT / REALLOCATE / REFUND) |
| `src/core/finance/domainEventAdapter.ts` | Pure `toEngineEvents()` + validation |
| `src/core/finance/migrations/legacyToThreeAccount.ts` | `planMigration()` + `suggestMainBalanceRoute()` |

### Modified runtime files

| File | Change |
|------|--------|
| `src/core/finance/accounts.ts` | Add `INCOME_ACCOUNT_ID` + `RESERVE_FUND_ACCOUNT_ID` aliases. **String values preserved** (`'main_bank'`, `'emergency_fund'`) — no ledger rewrite |
| `src/stores/useAccountOverviewStore.ts` | Add flag-gated `getThreeAccountSnapshot()` + `useThreeAccountSnapshot()` hook + pure helper `assembleThreeAccountSnapshotInput()`. **Legacy snapshot path untouched** |
| `src/app/(auth)/login/LoginForm.tsx` | `DEBT-001` fix — remove `totalMoney`, add 8 missing required `UserProfile` fields |
| `.env.example` | Document the 3 feature flags (commented out, default OFF) |
| `package.json` | Add `test:three-account` script |

### Docs added

| File | Purpose |
|------|---------|
| `docs/adr/0001-three-account-model.md` | Approved ADR (rev 1) |
| `docs/plans/phase-1-read-model.md` | Implementation plan (rev 1 with leadership decisions + DoD acceptance matrix) |
| `docs/plans/pre-existing-build-lint-debt.md` | Debt tracker |
| `docs/plans/phase-1-pr-description.md` | This document |

### Tests added (7 suites, 194 cases)

| Suite | Cases |
|-------|-------|
| `feature-flags.test.ts` | 14 |
| `account-roles.test.ts` | 17 |
| `selectors.test.ts` | 31 |
| `safe-to-spend.test.ts` | 12 |
| `snapshot.test.ts` | 14 |
| `wiring.test.ts` | 9 |
| `domain-adapter.test.ts` | 49 |
| `migration.test.ts` | 48 |
| **Total** | **194** |

---

## 4. Feature flags

| Flag | Env var | Default | When this PR enables it |
|------|---------|---------|-------------------------|
| `NEW_THREE_ACCOUNT_MODEL` | `NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL` | OFF | dev/staging only after merge |
| `NEW_OVERVIEW_UI` | `NEXT_PUBLIC_ENABLE_NEW_OVERVIEW` | OFF | Phase 2 |
| `NEW_ALLOCATION_FLOW` | `NEXT_PUBLIC_ENABLE_ALLOCATION_FLOW` | OFF | Phase 3 |

Strict semantics: **only the exact string `'true'` enables** — `'1'`, `'yes'`, `'TRUE'` all stay OFF. This prevents accidental enables via misconfigured CI vars.

All env reads live exclusively in `src/lib/featureFlags.ts`. Verified by grep:

```
$ grep -R "NEXT_PUBLIC_ENABLE" src/
src/lib/featureFlags.ts:38
src/lib/featureFlags.ts:44
src/lib/featureFlags.ts:50
```

---

## 5. Verification commands

```bash
# Test suites
npm run test                      # phase1-foundation legacy tests — PASS
npm run test:phase2               # phase2-backdate legacy tests — PASS
npm run test:three-account        # NEW Phase 1 suite — 194/194 PASS

# Build + lint
npm run build                     # ✓ Compiled successfully
npm run lint                      # 49 problems (24E + 25W) — pre-existing baseline, 0 new
```

### Static invariants (grep checks)

```bash
# (1) No XP triggered in Phase 1 core layer
grep -R "awardXP(" src/core/finance tests/three-account
#  → 0 matches

# (2) Pure finance core does NOT read Zustand
grep -R "from '@/stores" src/core/finance
#  → 0 matches

# (3) Zustand imports in test layer only in INTEGRATION tests (acceptable):
grep -R "from '@/stores" tests/three-account
#  → wiring.test.ts (5 lines) + sample-diff.ts (5 lines)
#  → these are integration test seams, not pure core layer

# (4) billFundBalance only in legacy/migration scope, NOT a new account
grep -R "billFundBalance" src/core/finance src/stores/useAccountOverviewStore.ts
#  → all occurrences are in:
#    - dashboardSelectors.ts (legacy CoreDashboardBalances type — Phase 4 will deprecate)
#    - threeAccountSelectors.ts (1 line, in JSDoc comment)
#    - migrations/legacyToThreeAccount.ts (legacy snapshot field — by design)
#    - useAccountOverviewStore.ts (pre-existing legacy code, untouched by Phase 1)
#  → NO new BillFund account introduced

# (5) Feature flag env reads centralized
grep -R "NEXT_PUBLIC_ENABLE" src/
#  → all 3 in src/lib/featureFlags.ts only
```

---

## 6. Test results

```
npm run test:three-account
──────────────────────────────────
  Passed: 194
  Failed: 0
──────────────────────────────────
```

Coverage highlights:
- Safe-to-Spend boundary cases: 0 / +1 / -1 / 1_000_000 / 1_000_001 — all asserted with status equivalence
- Migration balance invariant: `sum(newEvents) === sum(legacyFields)` enforced on 10 fixtures
- Domain adapter input immutability: `JSON.stringify(input)` before/after — 3 deep cases
- Production guard: `split-70-30` route + no `isDemoUser` flag → fallback to income + warning recorded
- Idempotent rerun: `existingBatchId === computeBatchId(...)` → returns `isNoOp:true` with empty events + preserved backup

---

## 7. Migration safety

`planMigration` is **plan-only** in Phase 1. The function returns:

```typescript
{
  batchId: string,           // deterministic
  domainEvents: AdjustmentEvent[],
  engineEvents: FinanceEvent[],
  backupSnapshot: LegacyBalanceSnapshot,  // caller MUST persist before applying
  warnings: string[],
  isNoOp: boolean,
  totalLegacy: number,
  totalNew: number,          // MUST equal totalLegacy
}
```

Caller responsibilities (deferred to Phase 2 wiring):
1. Persist `backupSnapshot` to localStorage / Firestore before applying
2. Check ledger for existing entries with `migrationBatchId === plan.batchId` and pass `existingBatchId` if found (idempotent guard)
3. Show user the onboarding modal when `suggestMainBalanceRoute().requiresUserConfirmation === true` — only production case is `route='income'` with confirmation modal

**No production user data is mutated by this PR.**

---

## 8. Rollback plan

| Scenario | Rollback action | Risk |
|----------|-----------------|------|
| Flag stays OFF in production | No action — UI identical to pre-PR | None |
| `NEW_THREE_ACCOUNT_MODEL=true` enabled by mistake in prod | Unset env var; redeploy. No persistent state created. | None — new code path is read-only |
| Future Phase 2+ regression | `git revert` this PR (and Phase 2 PRs); legacy paths still intact | Low — legacy code untouched |
| Catastrophic ledger corruption from future migration apply | Restore from `backupSnapshot` persisted by caller; ledger entries with `metadata.auditActor='migration'` can be filtered + removed | Mitigated by `migrationBatchId` audit metadata |

---

## 9. Known debt / not in scope

### Pre-existing debt tracked in [pre-existing-build-lint-debt.md](pre-existing-build-lint-debt.md)

```
- Build errors:    0   (was 1 — DEBT-001 resolved in this PR)
- Lint errors:    24   (unchanged baseline)
- Lint warnings:  25   (unchanged baseline)
- New errors introduced by Phase 1:   0
- New warnings introduced by Phase 1: 0
```

Per leadership decision 2026-05-19, the 24 lint errors are tracked separately (DEBT-002 → DEBT-005) and do not block Phase 1 merge.

### Explicitly NOT in this PR

- ❌ No Overview UI redesign — Phase 2
- ❌ No `<AllocationSheet />` modal — Phase 3
- ❌ No `splitFunds` refactor → `allocateIncome` — Phase 3
- ❌ No `billFundBalance` removal from `useFinanceStore` — Phase 4
- ❌ No `payBill` change (still deducts from `billFundBalance`) — Phase 4
- ❌ No `TransactionInput` change — out of scope
- ❌ No XP changes — Phase 1 emits 0 XP events
- ❌ No e-learning hooks — Phase 5
- ❌ No actual migration execution on user data — Phase 2 wiring + onboarding modal

---

## 10. Sample outputs

### 10.1 ThreeAccountSnapshot — seed data
[`tests/three-account/sample-snapshot.ts`](../../tests/three-account/sample-snapshot.ts)

Input: 19.111.550đ income → allocate 14.95M Spending + 800k/500k/400k Saving → 120k food expense.

Output:
- `income.balance` = 2.461.550 (unallocated remainder)
- `spending.balance` = 14.83M; `dailyBudgetUsed` = 120k; `billBudgetUsed` = 0
- `saving.breakdown` = { reserve: 800k, goals: 500k, investment: 400k }
- `safeToSpend.amount` = 5.261.550 (status: `safe`)

### 10.2 Legacy vs new snapshot diff
[`tests/three-account/sample-diff.ts`](../../tests/three-account/sample-diff.ts)

Both snapshots produce identical Safe-to-Spend (5.261.550, status safe). Semantic differences surfaced:
- Legacy `income.amount` = monthly inflow ↔ New `income.balance` = unallocated remainder
- Legacy `expense.amount` = legacy txn sum ↔ New `spending.balance` = ledger balance + `dailyBudgetUsed` + `billBudgetUsed` breakdown
- Legacy `saving.amount` = monthly contribution ↔ New `saving.balance` = total accumulated

### 10.3 Domain event mappings
[`tests/three-account/sample-domain-events.ts`](../../tests/three-account/sample-domain-events.ts)

- `INCOME_RECEIVED` 19.1M → `CREATE_INCOME` targetAccountId=`main_bank`, metadata preserves `domainEventType: INCOME_RECEIVED`
- `ALLOCATE_TO_SAVING(reserve)` 800k → `TRANSFER_MONEY` main_bank → emergency_fund, metadata.savingBucket=`reserve`
- `PAY_BILL` 2.5M → `CREATE_EXPENSE` source=`spending`, metadata.isBill=true + billId/dueDay/paidOnTime

### 10.4 Migration plan — production vs demo
[`tests/three-account/sample-migration.ts`](../../tests/three-account/sample-migration.ts)

Production user (default route=income):
- `suggestMainBalanceRoute` → `requiresUserConfirmation: true, confidence: low`
- Plan: 5 domain events, mainBalance routed ENTIRELY to Income
- `totalLegacy === totalNew === 35.200.000đ`

Demo user (route=split-70-30):
- `suggestMainBalanceRoute` → `spending: 70%, income: 30%, confidence: high, requiresUserConfirmation: false`
- Plan: 6 domain events (mainBalance split)

Production guard violation:
- Production user with route=`split-70-30` → falls back to income + warning recorded
- Confirmed by test "Fixture 5 — production fallback to income with warning"

Idempotent rerun:
- `existingBatchId === computeBatchId(...)` → `isNoOp: true, domainEvents: [], backupSnapshot still present`

---

## 11. Release-readiness decision

| Question | Answer | Rationale |
|----------|--------|-----------|
| Safe to merge Phase 1? | **YES** (after engineering lead approval) | All 194 tests pass, build pass, 0 new lint debt, flags default OFF |
| Safe to enable `NEW_THREE_ACCOUNT_MODEL` in production? | **NO** | Enable in dev/staging only. New code path is read-only but never integration-tested with real Firestore data |
| Safe to enable `NEW_OVERVIEW_UI`? | **NO** | UI not built yet — Phase 2 |
| Safe to execute migration for real users? | **NO** | Phase 1 is plan-only. No wiring layer that calls `engine.executeMany(plan.engineEvents)` exists yet — Phase 2 onboarding will add it with user confirmation |
| Safe to deploy this PR with all flags OFF? | **YES** | Zero behavioral change. Legacy paths untouched. wiring.test asserts identical legacy output |

---

## 12. How to verify locally

```bash
# 1. Pull this branch + install
npm install

# 2. Run the new test suite
npm run test:three-account
# expect: 194/194 PASS

# 3. Run pre-existing tests (regression check)
npm run test && npm run test:phase2
# expect: all PASS

# 4. Build
npm run build
# expect: ✓ Compiled successfully

# 5. Verify legacy UI works (flag OFF default)
npm run dev
# open http://localhost:3000/overview
# expect: identical Overview / Ledger / Money tabs

# 6. Try the new snapshot path (flag ON)
echo "NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL=true" >> .env.local
npm run dev
# expect: still identical UI (UI doesn't consume new snapshot yet — Phase 2)
# but useThreeAccountSnapshot() now returns valid data when called

# 7. Inspect samples (optional)
node -e "process.env.JITI_ALIAS=JSON.stringify({'@':process.cwd()+'/src'}); \
  import('jiti/register').then(() => import('./tests/three-account/sample-migration.ts'))"
```

---

## 13. Next phase recommendation — Phase 2 (Overview UI)

After Phase 1 merges and `NEW_THREE_ACCOUNT_MODEL=true` is enabled in dev/staging, **Phase 2 should rebuild the Overview tab** consuming `useThreeAccountSnapshot()`. Suggested scope, in order:

### 13.1 Sequencing

1. **Use the new hook** — `useThreeAccountSnapshot()` from `useAccountOverviewStore`. Phase 1 already wires it. Phase 2 components just consume the snapshot shape.
2. **Do not delete legacy UI** — gate new Overview behind `NEW_OVERVIEW_UI`. Legacy Overview keeps rendering when flag OFF. Phase 5 cleanup deletes legacy once new is 100% rolled out.
3. **Flag chain** — `NEW_OVERVIEW_UI` should require `NEW_THREE_ACCOUNT_MODEL=true` (since it depends on the new snapshot path). Add a sanity check on app boot.

### 13.2 The 4 Overview indicators (top-down)

| # | Indicator | Source field |
|---|-----------|--------------|
| 1 | **Số dư chi tiêu an toàn** (Safe-to-Spend) | `snapshot.safeToSpend.amount` + status — copy locked per ADR §4.4 |
| 2 | **Tài khoản thu nhập** | `snapshot.income.balance` — label "Tiền đã nhận, chưa phân bổ hết" |
| 3 | **Tài khoản chi tiêu** | `snapshot.spending.balance` (top-line), click → expanded breakdown |
| 4 | **Tài khoản tiết kiệm** | `snapshot.saving.balance` (top-line, single number), click → drill-down 3 sub-buckets |

### 13.3 Spending card breakdown (drill-down)

| Row | Source |
|-----|--------|
| Tài khoản chi tiêu hiện có | `snapshot.spending.balance` |
| Ngân sách tháng | `snapshot.spending.monthlyBudget` (= daily + bills) |
| Chi tiêu hằng ngày đã dùng | `snapshot.spending.dailyBudgetUsed` of `dailyBudgetUsed + dailyBudgetRemaining` |
| Bill đã trả | `snapshot.spending.billBudgetUsed` of `billBudgetTotal` |
| Bill còn nợ | `snapshot.spending.unpaidBills.length` items |
| Bill quá hạn | `snapshot.spending.overdueBills.length` items — coaching tone, NOT alarm |

### 13.4 Saving card

Overview shows **single total** (`snapshot.saving.balance`). User taps → bottom sheet drills down:

| Bucket | Source |
|--------|--------|
| Dự phòng | `snapshot.saving.breakdown.reserve` |
| Mục tiêu | `snapshot.saving.breakdown.goals` |
| Đầu tư | `snapshot.saving.breakdown.investment` |

### 13.5 Phase 2 acceptance criteria suggestion

- All 4 Overview cards render from `useThreeAccountSnapshot()` only
- Flag `NEW_OVERVIEW_UI=true` renders new; OFF renders legacy (no shared component leaks)
- 0 direct Zustand reads in new Overview components (consume snapshot only)
- A11y: status indicators (`safe / low / negative`) carry semantic labels
- Copy from ADR §4.4 (Safe-to-Spend) and §13.3 (mainBalance route confirmation modal) used verbatim
- Visual regression test for legacy Overview when flag OFF — no pixel diff vs current

### 13.6 What Phase 2 should NOT do

- ❌ Touch `payBill` / `splitFunds` (those are Phase 3-4)
- ❌ Execute migration auto on user open — only show onboarding modal with `requiresUserConfirmation` from `suggestMainBalanceRoute`
- ❌ Delete `useAccountOverviewSnapshot` legacy hook (Phase 5 cleanup)
- ❌ Add new XP actions (Phase 3 introduces ALLOCATE_TO_SAVING XP event via `awardXP` at the wiring layer, not in selectors)

---

## 14. Reviewer checklist

- [ ] Spot-check `threeAccountSelectors.ts` for purity — no imports from `@/stores`, no Date.now() at module scope
- [ ] Spot-check `domainEventAdapter.ts` — every output engine event has `metadata.domainEventType`
- [ ] Spot-check `legacyToThreeAccount.ts:planMigration` — `backupSnapshot` is a defensive copy (test "backup is a defensive copy" verifies)
- [ ] Read `migration.test.ts` — confirm 10 fixtures match Phase 1 plan §7.4
- [ ] Verify `LoginForm.tsx` fix preserves dev-bypass demo login behavior (manual test)
- [ ] Confirm `.env.example` flags are commented out
- [ ] Run `npm run test:three-account` locally and see 194/194 pass

---

## Reviewers

- Engineering lead (final approval)
- Product (verify copy in ADR §4.4 and migration onboarding modal text in §13.3)

After approval + merge: enable `NEXT_PUBLIC_ENABLE_THREE_ACCOUNT_MODEL=true` in staging environment for Phase 2 work.
