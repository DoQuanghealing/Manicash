# Phase 5 Report — Action History, Audit Log, Undo & Local Persistence

## 1. Summary
**Đã làm:** Lớp an toàn cho client-executed actions — audit log append-only (persist localStorage), undo an toàn cho cả 10 action, undo executor có stale-guard, UI lịch sử thao tác + nút Hoàn tác. Thêm store API nhỏ (có test) để rollback. Giữ nguyên invariant Phase 4 (server không execute).
**Chưa làm (đúng scope):** cloud sync (Firestore/TiDB), audit export, undo XP/streak, action analytics — để Phase 6.

## 2. Branch / Git
- Branch: `codex/ai-money-chat`
- Starting commit: `f3743d8` (Phase 4B)
- Ending commit: chưa commit (chờ duyệt)
- Working tree: 8 modified + 6 untracked

## 3. Audit Log
- Types (`actions/actionAuditTypes.ts`): `MoneyActionAuditRecord` + `events[]` + `MoneyActionUndoSnapshot` (before/after).
- Store (`stores/useActionAuditStore.ts`): Zustand + `persist` (localStorage, key `manicash-action-audit`, version 1). Append-only: mỗi đổi trạng thái push event, không mất event cũ. Newest-first, **giới hạn 200 record**.
- Persistence: `createJSONStorage(localStorage)` (đồng convention `useAiMoneyMemoryStore`). Reload không mất history.
- Event flow: `requested → confirmed → executed | cancelled | failed`; `executed → undo_requested → undone | undo_failed`.

## 4. Undo Support (tất cả 10 action undoable, có caveat XP)
| Action | Undo qua | Caveat |
|---|---|---|
| MARK_BILL_PAID | `setBillPaidStatus(id,false)` + hoàn billFund | clamp khi fund<amount (hiếm) |
| CREATE_EXPENSE | `removeTransaction(id)` (đảo balance) | XP/streak không đảo |
| CREATE_INCOME | `removeTransaction(id)` | XP/streak không đảo |
| CREATE_FIXED_BILL | `removeBill(id)` | — |
| SET_CATEGORY_BUDGET | `setCategoryBudget(old)` | nếu trước chưa có ngân sách → undo về 0 |
| ADD_GOAL_DEPOSIT | `removeGoalDeposit(goalId,depositId)` | XP tiết kiệm không đảo |
| CREATE_EARNING_TASK | `removeTask(id)` | — |
| COMPLETE_EARNING_TASK | `undoCompleteTask(id)` | XP + sub-task state không khôi phục |
| ADD_WISHLIST_ITEM | `removeItem(id)` | — |
| FLAG_TRANSACTION | `setTransactionFlags([id], prev)` | — |

Caveat ghi vào `undoReason` (action vẫn undoable=true) → UI hiển thị nhẹ.

## 5. Store Changes (thêm API nhỏ cho undo)
- **Finance**: `addBill` → trả `FixedBill` (+ id thêm random suffix tránh collision); `setBillPaidStatus(billId,isPaid)`; `removeTransaction(id):boolean` (đảo balance chính xác như addTransaction).
- **Budget**: không đổi (dùng sẵn `setCategoryBudget`, `setTransactionFlags`).
- **Goals**: `addFundsToGoal` → trả `depositId`; `removeGoalDeposit(goalId,depositId):boolean`.
- **Tasks**: `addTask` → trả `EarningTask`; `removeTask(id):boolean`; `undoCompleteTask(id):boolean`.
- **Wishlist**: không đổi (dùng sẵn `addItem`→item, `removeItem`).

## 6. UI
- History panel (`AiMoneyChatContent.tsx` + CSS `tg-history-*`): nút "Lịch sử thao tác" mở danh sách 20 record gần nhất (preview, status, result/error, caveat).
- Undo button: hiện trên record `executed` + `undoable`.
- Confirm/cancel: tích hợp audit (addRequested → markConfirmed → markExecuted/markFailed; cancel → markCancelled).

## 7. Safety
- Server execution guard: grep CLEAN — không Zustand trong `api`/`moneyBrain`/`parser`/`handlers`. Zustand chỉ trong `clientActionExecutor.ts` + `clientActionUndoExecutor.ts` (client) + UI/audit store.
- Stale data guard: undo executor chỉ chạy khi `status==='executed'` + `undoable` + còn `undoSnapshot`; re-check entity tồn tại / cờ còn ở trạng thái 'after'; nếu lệch → "Dữ liệu đã thay đổi, không thể undo an toàn."
- XP/streak caveats: undo KHÔNG đảo XP (chưa có XP-reversal API) — ghi rõ `undoReason`.
- Not undoable: không có action nào hoàn toàn không undo; chỉ có caveat XP/sub-task.

## 8. Tests
- New: `ai-money-action-audit-store` (8), `ai-money-action-undo-executor` (6), `ai-money-action-history-flow` (3); updated `ai-money-client-action-executor` (+3 undo metadata).
- Scripts: thêm `test:ai-act-audit|undo|history`, gộp vào `test:ai-money`.
- Commands & kết quả:
  - `npx tsc --noEmit` → **0 errors**
  - `npm run test:ai-money` → **251 PASS / 0 FAIL**
  - `npm run test:moneybrain` → 0 FAIL
  - `npm run test:ai-all` → 0 FAIL (no regression)
  - eslint changed files → 0 errors/warnings (đã dọn 1 unused import pre-existing `parseMonthKey`)

## 9. Đề xuất / bug phát hiện trong lúc làm (theo yêu cầu PO)
1. **addBill id collision** (pre-existing): `bill-${Date.now()}` có thể trùng nếu tạo 2 bill cùng millisecond → đã thêm random suffix. (Robustness fix, không phá caller.)
2. **setBillPaidStatus clamp**: nếu lúc trả bill quỹ < số tiền (clamp về 0), undo cộng đủ amount sẽ dư nhẹ → caveat, hiếm gặp. Phase 6 có thể lưu billFund-before trong snapshot để undo chính xác tuyệt đối.
3. **SET_CATEGORY_BUDGET undo khi chưa có ngân sách**: thiếu `removeCategoryBudget` → undo đặt về 0 thay vì xóa hẳn. Đề xuất Phase 6 thêm `removeCategoryBudget(catId, month)`.
4. **XP/streak một chiều**: chưa có cơ chế đảo XP → undo data nhưng không đảo XP. Đề xuất Phase 6 thêm XP audit/reversal.

## 10. Risks / Follow-up Phase 6
- Firestore/TiDB persistence + audit export.
- Undo XP/streak (XP audit), `removeCategoryBudget`, billFund-exact undo.
- Action analytics.

---

## Phase 5 Acceptance Checklist
- [x] action audit types
- [x] action audit store (persist local)
- [x] confirm/cancel/execute/fail được log
- [x] audit history persist local (localStorage)
- [x] client executor trả undo metadata
- [x] undo executor
- [x] ≥4 action undo an toàn (MARK_BILL_PAID, CREATE_EXPENSE/INCOME, SET_CATEGORY_BUDGET, FLAG_TRANSACTION) — thực tế cả 10
- [x] action có caveat ghi rõ undoReason
- [x] UI hiển thị action history
- [x] UI có undo button cho action undoable
- [x] undo stale fail an toàn
- [x] server invariant giữ
- [x] Phase 4 actions không regression
- [x] tests pass; tsc pass; eslint changed files pass
- [x] report Phase 5
- [x] chưa commit (chờ duyệt)
