# Phase 6B-1.5 Report — Persistence QA & Account Boundary Smoke

## 1. Git
- Branch: `codex/ai-money-chat`
- Start HEAD: `13e1adc` (Phase 6B-1)
- End HEAD: chưa commit (chờ duyệt)
- Commit: đề xuất `fix: harden local persistence boundaries`
- Push status: chưa push (sau khi PASS sẽ commit rồi push cả 3: 6A + 6B-1 + 6B-1.5)

## 2. Summary
- **What changed:** Gia cố local persistence (6B-1) trước khi sang cloud sync (6B-2): thêm account-boundary clear (logout/delete xóa data tài chính local), khóa hydration race cho rollover, QA corrupt-storage/migration/seed/audit-cap/auth-safety bằng tests.
- **Why:** Local persist hiện single-user; cần đảm bảo không lộ data user cũ + không crash edge cases trước khi cloud sync.

## 3. Account Boundary
- Strategy: Option A — clear local money data khi logout/delete (KHÔNG namespace UID; để 6B-2).
- Helper mới: `src/stores/clearLocalMoneyPersistence()` — reset in-memory 5 store + audit về EMPTY, removeItem toàn bộ `STORE_KEYS` (gồm audit), set hydration = true (không treo). Chỉ local, KHÔNG gọi Firebase signOut.
- Wire: `useSignOut` (sign-out chính) + `AccountDeletionDialog` + `AccountDeletionGate` (3 site) gọi `clearLocalMoneyPersistence()` sau `logout()`.
- User A → User B safety: test xác nhận sau clear, session mới rehydrate KHÔNG thấy transaction của A.

## 4. Persistence QA
- Corrupt storage fallback: set key = JSON hỏng → `persist.rehydrate()` KHÔNG throw, state fallback an toàn (mảng), hydration marker không treo. Test cho finance + budget/goals/tasks/auth.
- Migration smoke: `migrate(oldShape, 0)` fill default — finance (data lạ → `[]`/0), budget (thiếu flaggedTransactionIds → `[]`), goals/tasks/auth shape cũ không crash.
- Seed behavior: empty persisted transactions KHÔNG bị re-seed sau rehydrate (persist replace field — không cần marker `hasInitializedDemoData`).
- Hydration race guard: `RolloverGuard` thêm `areCoreStoresHydrated()` gate (+ retry ngắn 50ms) — rollover không chạy trước hydrate. `askAssistant` guard (từ 6B-1) giữ nguyên. Test partial vs full hydration.

## 5. Audit / Retention
- Audit persistence: `useActionAuditStore` dùng `STORE_KEYS.audit` (= `manicash-action-audit`, giữ key cũ — không mất data).
- Cap/retention: **200 entries** (đã có từ Phase 5, newest-first slice). Test: thêm 210 → còn 200, entry mới nhất vẫn truy được (undo được).
- Undo after reload: test 6B-1 (`MARK_BILL_PAID` exact billFund sau rehydrate) vẫn PASS.

## 6. Auth Safety
- Persisted fields: chỉ `user` (XP/rank/streak/streakShields/resist/premium/plan...).
- Excluded: `firebaseUser`, token/credential, `isLoading`, `isAuthenticated` (transient/nhạy cảm).
- Check: test parse JSON `manicash.auth.v1` → có `user`, KHÔNG có firebaseUser/isLoading/isAuthenticated.

## 7. Tests
- New: `tests/ai-money-persistence-boundary.test.ts` (13): clear keys, reset in-memory, A→B boundary, corrupt fallback (×2), migration (×3), hydration partial/full, no-reseed, audit cap, auth-safety.
- Total: `npm run test:ai-money` → **283 PASS / 0 FAIL**; `test:moneybrain` 0 FAIL; `test:ai-all` 0 FAIL.

## 8. Verification
- `npx tsc --noEmit`: clean.
- `npm run test:ai-money`: 283 PASS / 0 FAIL.
- `npm run test:moneybrain` / `test:ai-all`: 0 FAIL.
- lint changed files: clean.
- Guards: moneyBrain pure (no localStorage/window/persist); server-side no Zustand.

## 9. Risks / Follow-up
- **Bug tìm thấy & xử lý (đề xuất ghi nhận):**
  1. `clearLocalMoneyPersistence` ban đầu guard `typeof window !== 'undefined'` → trong node/test (window undefined) bỏ qua removeItem. Sửa: chỉ guard `typeof localStorage`. (Browser vẫn an toàn.)
  2. jiti alias-vs-relative tạo 2 instance store → `clearLocalPersistence` + `persistConfig` thống nhất dùng alias `@/stores/...`.
- **Browser nuance:** sau `clearLocalMoneyPersistence`, reset in-memory trigger persist write (async) có thể ghi lại key với state RỖNG (không lộ data). removeItem là best-effort; dù key tồn tại lại thì nội dung rỗng → vẫn không leak.
- **Account boundary là local-only single-user.** Multi-user cloud merge + namespace theo UID để Phase 6B-2.
- **Recommended next:** Phase 6B-2 — Cloud sync (Firestore): conflict strategy (append-merge cho transactions/audit, LWW cho scalar), debounce/batch, Firestore rules per-uid, giữ invariant server không execute action.
