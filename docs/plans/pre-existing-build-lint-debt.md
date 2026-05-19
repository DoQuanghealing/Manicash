# Pre-existing Build/Lint Debt — Tracker

| Field | Value |
|-------|-------|
| Status | **Open** (DEBT-001 resolved 2026-05-19) |
| Discovered | 2026-05-19 (Phase 1 Day 1-2 verification) |
| Owner | TBD — assign post-Phase-1 |
| Block release? | No build blocker left. Lint errors still tracked. |

## 1. Summary

| Bucket | Original | Current |
|--------|----------|---------|
| TypeScript build error | 1 | **0** ✅ |
| ESLint error | 24 | 24 |
| ESLint warning (file mới đếm là blocker, pre-existing để theo dõi) | 25 | 25 |

These errors existed **before** Phase 1 work and are **not introduced** by the 3-account model migration. Per leadership decision 2026-05-19, Phase 1 may proceed with new code 100% clean, while these debts are tracked separately.

**No new Phase 1 code is allowed to add to this count.** Every Phase 1 report must include a "Pre-existing debt count" line — if the count rises, work stops until reverted/fixed.

---

## 2. Critical — Build Blocker

### DEBT-001 — `LoginForm.tsx:65` totalMoney type error — ✅ RESOLVED 2026-05-19

| Field | Value |
|-------|-------|
| Severity | 🔴 P0 (was — now resolved) |
| File | `src/app/(auth)/login/LoginForm.tsx:65` |
| Type | TypeScript build error |
| Actual effort | ~10 minutes |
| Fix approach | **Hướng A** per leadership guidance |

**Resolution**:
- Removed `totalMoney: 5000000` from dev-bypass `setUserProfile()` call.
- Added 8 missing required `UserProfile` fields (`email`, `photoURL`, `lastActiveDate`, `resistCount`, `totalResistSaved`, `isPremium`, `plan`, `premiumExpiresAt`) using defaults matching `src/lib/firebase/auth.ts:52-72` pattern.
- Verified `npm run build` passes.
- Verified `npm run test:three-account` (88/88) and `npm run test` still pass.
- No behavior change for dev-bypass flow (demo user still logs in with rank gold + xp 1500).

**Design note**: `totalMoney` was a domain leak — finance balances belong in finance stores, not `UserProfile`. Removing it preserves the boundary: `UserProfile` carries identity + gamification only.

**Original error (for archive)**:
```
Type error: Object literal may only specify known properties,
and 'totalMoney' does not exist in type 'UserProfile'.
> 65 |       totalMoney: 5000000,
```

---

## 3. ESLint Errors (24 total)

### DEBT-002 — `useBudgetStore.ts` require() imports + any types (7 errors)

| Field | Value |
|-------|-------|
| Severity | 🟠 **P1** |
| File | `src/stores/useBudgetStore.ts:183-195` |
| Estimate | 1 hour |

```
183:33  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
185:37  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
187:44  error  Unexpected any. Specify a different type
190:19  error  Unexpected any. Specify a different type
191:32  error  Unexpected any. Specify a different type
194:19  error  Unexpected any. Specify a different type
195:32  error  Unexpected any. Specify a different type
```

**Root cause**: `updateSnapshotTotals` uses runtime `require('@/stores/useFinanceStore')` to avoid circular dependency. The `any` types are on `.filter`/`.reduce` callbacks for `Transaction[]`.

**Fix strategy**: Replace `require` with deferred `import()` or refactor to pass `useFinanceStore` reference via constructor pattern. Type the callbacks with `Transaction` from `@/types/transaction`.

**Phase 1 relevance**: Phase 1 selectors are **pure** and do NOT depend on this code path — fix can wait until Phase 4 store refactor.

### DEBT-003 — `GoalsContent.tsx` React Compiler memoization (2 errors)

| Field | Value |
|-------|-------|
| Severity | 🟡 **P2** |
| File | `src/app/(app)/goals/_components/GoalsContent.tsx:37, 44` |
| Estimate | 30 min |

```
37:47  error  Compilation Skipped: Existing memoization could not be preserved
44:43  error  Compilation Skipped: Existing memoization could not be preserved
```

**Root cause**: React Compiler can't preserve manual `useCallback` because inferred deps `setCelebration` / `setDeleteTarget` don't match declared deps.

**Fix strategy**: Remove `useCallback` and let React Compiler auto-memoize, OR add setter to deps array (cheaper).

**Phase 1 relevance**: None. UI-only issue.

### DEBT-004 — `FloatingButler.tsx` ref during render (1 error)

| Field | Value |
|-------|-------|
| Severity | 🟡 **P2** |
| File | `src/components/ui/FloatingButler.tsx:188` |
| Estimate | 30 min |

```
188:19  error  Cannot access refs during render
animate={!dragging.current ? { left: pos.x, top: pos.y } : undefined}
```

**Fix**: Mirror `dragging.current` to a state variable, or compute the conditional during pointer events instead.

### DEBT-005 — Legacy test files `any` types (6 errors)

| Field | Value |
|-------|-------|
| Severity | 🟢 **P3** |
| Files | `tests/date-helpers.test.ts:83-85` (2), `tests/phase2-backdate.test.ts:24,26,35` (3) |
| Estimate | 30 min |

```
date-helpers.test.ts:83  error  Unexpected any
date-helpers.test.ts:85  error  Unexpected any
phase2-backdate.test.ts:24  error  Unexpected any
phase2-backdate.test.ts:26  error  Unexpected any
phase2-backdate.test.ts:35  error  Unexpected any
```

**Fix**: Replace `as any` with proper imports of `Transaction`, `DashboardAccounts`, etc.

**Phase 1 relevance**: None. New Phase 1 tests use the strict harness with no `any`.

---

## 4. ESLint Warnings (25 total — pre-existing only, file mới phải 0 warnings)

Grouped by type for triage:

### Unused imports (17 occurrences)
Files: `WishlistPanel.tsx`, `SplitFundsPanel.tsx`, `SplitSuccessPopup.tsx`, `TabSwitcher.tsx`, `TransactionInput.tsx`, `useButlerContext.ts`, `usePendingTransactions.ts`, `useFinanceStore.ts`, `phase2-backdate.test.ts`.

**Fix**: Auto-fixable with `npm run lint -- --fix`. Estimate: 5 min total.

### Missing dependency in useCallback (1)
`SplitFundsPanel.tsx:201` — missing `sourceTransactionId`.

**Fix**: Add to deps array or wrap with useEvent.

### Other (1)
- `TransactionInput.tsx:54` — `play` variable assigned but never used. Likely dead code.

---

## 5. Priority + Fix order (Recommended)

| Order | Item | Why first | Est |
|-------|------|----------|-----|
| 1 | DEBT-001 LoginForm | Build blocker — nothing ships without this | 0.5h |
| 2 | All warnings (auto-fix) | One command, instant cleanup | 5min |
| 3 | DEBT-005 test files | Test files = no UI risk, easy `any` removal | 30min |
| 4 | DEBT-003 GoalsContent | Small, isolated component | 30min |
| 5 | DEBT-004 FloatingButler | Small, isolated component | 30min |
| 6 | DEBT-002 useBudgetStore | Trickiest — needs careful require/import refactor | 1h |

**Total estimate**: ~3 hours focused work to bring codebase to lint+build clean.

**Recommended schedule**:
- Sprint 1 (immediate): DEBT-001 (build blocker)
- Sprint 2 (post-Phase 1 Day 5): items 2-5
- Sprint 3 (post-Phase 1 merge): DEBT-002

---

## 6. Tracking discipline

Every Phase 1 progress report must include:

```
Pre-existing debt count:
- Build errors: <N>
- Lint errors: <N>
- New errors introduced by Phase 1: 0
```

If "New errors introduced by Phase 1" > 0:
1. **STOP** new feature work.
2. Identify which file introduced the error.
3. Either revert or fix immediately.
4. Resume only after counts confirmed.

This rule is non-negotiable per leadership decision 2026-05-19.

---

## 7. Update log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-19 | Phase 1 Day 1 | Initial cataloging from `npm run lint` + `npm run build` output |
| 2026-05-19 | Phase 1 Day 3.5 | DEBT-001 resolved (Hướng A: removed `totalMoney`, added 8 missing UserProfile fields). Build now passes. |
