# Phase 6A Report — Undo Correctness Hardening

## 1. Git
- Branch: `codex/ai-money-chat`
- Start HEAD: `3a569a3` (Phase 5)
- End HEAD: chưa commit (chờ duyệt)
- Commit: đề xuất `fix: harden money action undo audit`

## 2. Summary
- **What changed:** Làm undo CHÍNH XÁC tuyệt đối trước khi sang persistence (6B). Sửa bug billFund clamp; thêm XP/streak reversal exact; restore penalty consumption; xử lý undo budget khi trước chưa có; idempotent double-undo.
- **Why:** 6B sẽ persist audit/undo snapshot vào storage/DB — phải chốt model đúng trước, tránh migrate lại schema.

## 3. Audit / Undo Model
- Audit entry (`MoneyActionAuditRecord`) giữ nguyên shape Phase 5 (đủ field: action/status/timestamps/result/error/`undoSnapshot`) — backward compatible.
- **Undo snapshot strategy:** mỗi action lưu `before`/`after` đủ để restore EXACT:
  - MARK_BILL_PAID: `before.billFundBefore` (số dư quỹ bill trước) → restore chính xác, **không cộng lại amount**.
  - CREATE_EXPENSE/INCOME: `before.userProgress` (xp/rank/streak/shields) + `after.transactionId`.
  - SET_CATEGORY_BUDGET: `before.existedBefore` + `monthlyLimit` + `month`.
  - ADD_GOAL_DEPOSIT: `before.userProgress` + `after.{goalId,depositId,amount}`.
  - COMPLETE_EARNING_TASK: `before.{subTasks, actualAmount, xpPenalties, userProgress}`.
  - FLAG_TRANSACTION: `before.flagged` (trạng thái trước, không blind toggle).
- **XP reversal:** restore chính xác từ `UserProgressSnapshot` (xp/rank/streak/shields/lastActiveDate) — không tính lại bằng `calculateXP`.
- **Idempotency:** undo lần 2 trên cùng record fail an toàn (removeTransaction→false, bill đã unpaid→STALE, deposit đã xóa→false, flag đã đúng→STALE), không mutate lại.

## 4. Actions Covered
| Action | Undo status | Notes |
|---|---:|---|
| CREATE_EXPENSE | PASS | xóa txn + restore balance + reverse XP/streak |
| CREATE_INCOME | PASS | như trên |
| MARK_BILL_PAID | PASS | **restore billFund exact từ billFundBefore** |
| CREATE_FIXED_BILL | PASS | removeBill |
| SET_CATEGORY_BUDGET | PASS | restore limit cũ; nếu trước chưa có → removeCategoryBudget |
| ADD_GOAL_DEPOSIT | PASS | removeGoalDeposit + restore currentAmount + reverse XP |
| CREATE_EARNING_TASK | PASS | removeTask |
| COMPLETE_EARNING_TASK | PASS | restore completedAt/actualAmount/subTasks + penalty + XP |
| FLAG_TRANSACTION | PASS | restore trạng thái cờ trước (setTransactionFlags) |

## 5. Bugs Fixed
- **billFund exact undo:** trước cộng lại `amount` → sai khi quỹ bị clamp về 0 (200k+500k bug). Giờ lưu `billFundBefore`, restore chính xác. Có test 200k/500k.
- **removeCategoryBudget undo:** SET_CATEGORY_BUDGET khi trước chưa có budget → undo xóa hẳn (không để lại limit 0). Thêm `useBudgetStore.removeCategoryBudget`.
- **XP reversal:** thêm `useAuthStore.restoreProgress` — undo CREATE_EXPENSE/INCOME, ADD_GOAL_DEPOSIT, COMPLETE_EARNING_TASK reverse XP/streak chính xác (trước Phase 5 chỉ caveat, không đảo).
- **double undo:** idempotent, không mutate lần 2.
- **penalty restore:** `undoCompleteTask(id, before)` khôi phục `xpPenalties` đã bị completeTask tiêu hao + sub-task state.

## 6. Store Changes (chỉ thêm API nhỏ cho undo)
- `useAuthStore`: `restoreProgress(snapshot)` + type `UserProgressSnapshot`.
- `useFinanceStore`: `setBillPaidStatus(billId, isPaid, billFundOverride?)` (thêm override exact).
- `useBudgetStore`: `removeCategoryBudget(catId, month?)`.
- `useTaskStore`: `undoCompleteTask(id, before?)` (restore subTasks/actualAmount/penalties).

## 7. Tests
- New: `tests/ai-money-undo-correctness.test.ts` (8 — billFund clamp, income undo, budget-not-existed remove, removeCategoryBudget, goal deposit XP reverse, complete-task penalty+XP+subtask, flag restore, double-undo).
- Updated: `ai-money-client-action-executor` (undoSnapshot userProgress thay cho caveat).
- Total: `npm run test:ai-money` → **259 PASS / 0 FAIL**; `test:moneybrain` 0 FAIL; `test:ai-all` 0 FAIL.

## 8. Verification
- `npx tsc --noEmit`: **clean** (repo dùng npm/jiti, không pnpm — đã dùng đúng script repo).
- `npm run test:ai-money`: 259 PASS / 0 FAIL.
- `npm run test:moneybrain` / `test:ai-all`: 0 FAIL.
- eslint changed files: clean.
- Guard: Zustand chỉ trong `clientActionExecutor.ts` + `clientActionUndoExecutor.ts`; server-side CLEAN; Money Brain vẫn pure.

## 9. Risk / Follow-up
- **Concurrency caveat:** restoreProgress khôi phục snapshot tuyệt đối; nếu giữa execute→undo user nhận thêm XP từ hành động khác, undo sẽ ghi đè (hiếm trong luồng chat tuần tự). Phase 6B nếu cần concurrency-safe có thể chuyển sang delta-subtract.
- **Failed action:** UI chỉ `markExecuted` khi `result.ok`; executor không throw giữa chừng (trả `{ok:false}`). Không thêm transaction system lớn (đúng scope).
- **Recommended next:** Phase 6B — Persistence (transactions/bills/budgets/goals/tasks/wishlist/audit) với versioning + migration + offline; audit/undo model giờ đã ổn định để persist.
