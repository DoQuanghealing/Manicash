# Phase 6B-1 Report — Local-first Persistence

## 1. Git
- Branch: `codex/ai-money-chat`
- Start HEAD: `af13aad` (Phase 6A)
- End HEAD: chưa commit (chờ duyệt)
- Commit: đề xuất `feat: add local-first money persistence`

## 2. Summary
- **What changed:** Persist 5 store tài chính (finance/budget/goals/tasks/auth) + audit log vào localStorage qua Zustand `persist`. Reload không mất dữ liệu. Có versioning + migrate + hydration gate cho snapshot builder. KHÔNG cloud sync.
- **Why:** Local-first nền tảng cho Phase 6B-2 (cloud sync) — audit/undo model (Phase 6A) đã ổn định để persist.

## 3. Persistence Model
- Store keys: `manicash.finance.v1` / `.budget.v1` / `.goals.v1` / `.tasks.v1` / `.auth.v1` (audit: `manicash-action-audit` từ Phase 5).
- Versions: tất cả `1` (`STORE_VERSIONS`).
- Storage engine: `createJSONStorage(() => localStorage)` (đồng convention repo; SSR-safe — zustand chỉ rehydrate client).
- Migration: mỗi store có `migrate(persisted, version)` fill default an toàn (mảng rỗng, số 0, currentMonth fallback) — chỗ để Phase 6B-2 mở rộng.
- Helper dùng chung: `src/stores/persistConfig.ts` (keys/versions/onRehydrateMark) + `src/stores/useHydrationStore.ts` (theo dõi hydrate).

## 4. Stores Covered
| Store | Persisted fields | Hydration | Notes |
|---|---|---:|---|
| Finance | transactions, mainBalance, emergencyBalance, billFundBalance, fixedBills, billSnapshots | PASS | partialize loại function |
| Budget | carryOver, currentMonth, categoryBudgets, rolloverNotified, flaggedCategories, flaggedTransactionIds, monthlySnapshots, unviewedReportMonth, xpAtMonthStart | PASS | rollover chạy ở app-layout effect (sau sync rehydrate) |
| Goals | goals (deposits/milestones/lastCelebratedMilestone... nằm trong goal) | PASS | deposits sống qua reload |
| Tasks | tasks, xpPenalties | PASS | completed/penalty giữ nguyên |
| Auth | user (XP/rank/streak/shields/resist/premium) | PASS | KHÔNG persist firebaseUser/token/isLoading/isAuthenticated |

## 5. Seed / Hydration
- Demo seed: chỉ ở initial state; `persist` REPLACE field khi rehydrate → reload sau khi user sửa KHÔNG duplicate seed (test xác nhận). First launch (no persisted) vẫn seed như cũ. Empty arrays intentional được giữ.
- Hydration gate: `useHydrationStore` + `areCoreStoresHydrated()`; mỗi store `onRehydrateStorage: onRehydrateMark(key)` đánh dấu sau rehydrate (kể cả khi chưa có data).
- Snapshot builder guard: `askAssistant` (chat) chặn gửi snapshot khi `!areCoreStoresHydrated()` → tránh đọc seed trước hydrate.

## 6. Audit / Undo After Reload
- Audit persisted: `useActionAuditStore` (Phase 5) đã persist localStorage; test xác nhận entry sống qua `persist.rehydrate()`.
- Undo after reload tested: `MARK_BILL_PAID` — execute → persist → rehydrate audit → undo.
- billFund exactness: undo sau reload restore **CHÍNH XÁC** `billFundBefore` (200k, không phải +500k). PASS.

## 7. Migration
- Current version: 1 (baseline đầu tiên).
- v0/v1: `migrate({}, 0)` fill mảng/số mặc định; data lạ (`transactions: 'not-array'`) → fallback `[]`/0 không crash.
- Missing-field defaults: goals thiếu `monthlyContributionTarget` load bình thường.

## 8. Tests
- New: `tests/ai-money-persistence.test.ts` (11) + `tests/_setupLocalStorage.ts` (mock localStorage cho node, import đầu tiên).
- Total: `npm run test:ai-money` → **270 PASS / 0 FAIL**; `test:moneybrain` 0 FAIL; `test:ai-all` 0 FAIL.

## 9. Verification
- `npx tsc --noEmit`: clean.
- `npm run test:ai-money`: 270 PASS / 0 FAIL.
- `npm run test:moneybrain` / `test:ai-all`: 0 FAIL.
- lint changed files: clean.
- Guards: moneyBrain pure (no localStorage/window/persist); server-side no Zustand.

## 10. Risks / Follow-up
- **Bug tìm thấy & xử lý (đề xuất ghi nhận):**
  1. `onRehydrateMark` ban đầu khai báo callback có param `unknown` → poison type inference của persist (`StateCreator<unknown>`). Đã sửa: callback 0-arg.
  2. jiti test resolve `@/stores/x` vs `./x` thành 2 instance → đã thống nhất persistConfig dùng alias `@/stores/useHydrationStore` (cũng nhất quán hơn). Trong Next/webpack không bị (dedupe alias).
- **Auth concurrency caveat:** persist `user` local. Khi Firebase auth thật trả profile khác (multi-user), có thể overwrite progress local — để Phase 6B-2 (merge/conflict). 6B-1 local-first đơn-user nên chấp nhận.
- **Recommended next:** Phase 6B-2 — Cloud sync (Firestore) với conflict strategy + debounce write, GIỮ invariant server không execute action (chỉ persist state).
