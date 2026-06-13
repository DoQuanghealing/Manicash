# Phase 4A Report — Core Client-executed Action Protocol

## 1. Summary
**Đã làm:** Action protocol end-to-end cho 3 action lõi (MARK_BILL_PAID, CREATE_EXPENSE, CREATE_INCOME). Server CHỈ tạo `actionRequest` (không execute); client confirm rồi mới gọi Zustand; expense ≥ 3M không bypass BreathGate; parser deterministic (0 token).
**Chưa làm (đúng scope):** 7 action còn lại (Phase 4B), action history/audit/undo, DB, server-side execution.

## 2. Branch / Git
- Branch: `codex/ai-money-chat`
- Starting commit: `dde3f26` (Phase 3)
- Ending commit: chưa commit (chờ duyệt)
- Working tree: 6 modified + 5 untracked (xem mục 8)

## 3. Action Protocol
- Types (`actions/actionTypes.ts`): `MoneyActionType`, `MoneyActionStatus`, `BaseMoneyActionRequest`, payload 3 action, union `MoneyActionRequest`, `BREATH_GATE_THRESHOLD=3_000_000`.
- Builder (`actions/actionRequestBuilder.ts`): `createActionRequest` — requestId unique, createdAt/expiresAt (TTL 5'), status `pending_confirmation`, requiresConfirmation `true`. `Date.now()` chỉ cho metadata request (comment rõ), không dùng cho logic tài chính.
- Validator (`actions/actionValidators.ts`): đối chiếu snapshot (bill tồn tại/chưa đóng/amount khớp; amount>0; category; wallet hợp lệ).
- Expiry/idempotency: request có `expiresAt`; executor re-check hết hạn + re-check bill state hiện tại trước khi execute.

## 4. Supported Actions
- **MARK_BILL_PAID**: parser match đúng 1 bill chưa đóng theo tên (0/nhiều → null). Preview "Đánh dấu bill … là đã thanh toán?". Risk low.
- **CREATE_EXPENSE**: amount (`amountParser`) + category (`extractSlots`, default `other`/`Khác`), wallet `main`. Risk high (≥3M) / medium (≥500k) / low.
- **CREATE_INCOME**: amount + category optional, wallet `main`. Risk medium.

## 5. Server / API
- Command parser (`actions/actionCommandParser.ts`): deterministic verb-detection + payload; pure question (không verb/không amount) → null.
- API response: thêm optional `reply.actionRequest` (backward-compatible; giữ message/ui/meta). Thêm intent `ACTION_REQUEST`.
- Dispatcher (`/api/chat`): `tryBuildActionReply` chạy TRƯỚC routeIntent — nếu là lệnh hợp lệ → trả actionRequest; nếu validate fail → trả clarification (không actionRequest); else → flow Phase 2/3 cũ.
- LLM guard: action parsing 0 token, không gọi LLM.
- Server-side execution guard: grep xác nhận KHÔNG có `useFinanceStore/useBudgetStore/useGoalsStore/useTaskStore` trong `src/app/api`, `src/lib/moneyBrain`, `actionCommandParser`, `handlers`.

## 6. Client UI
- Confirmation card (`AiMoneyChatContent.tsx` + CSS `tg-action-*`): title, preview, risk label, Confirm/Cancel.
- Confirm flow: `executeMoneyActionOnClient` → append kết quả → clear pending → Zustand re-render tự rebuild snapshot.
- Cancel flow: clear pending + "Đã hủy thao tác."
- Pending state: chỉ 1 action tại một thời điểm; có pending + server trả action mới → báo user xử lý cái cũ trước (không overwrite).

## 7. Client Executor (`actions/clientActionExecutor.ts` — CLIENT ONLY)
- Store actions used: `useFinanceStore.payBill(billId)`, `useFinanceStore.addTransaction({type,amount,categoryId,note,wallet})`.
- Revalidation: re-check expired + bill tồn tại/chưa đóng trước khi execute.
- Large expense/BreathGate: expense ≥ 3.000.000đ → KHÔNG execute, trả message "vượt ngưỡng BreathGate. Vui lòng nhập qua tab Nhập…".
- XP/streak: `addTransaction` tự gọi `updateStreak` (DAILY_STREAK) cho income/expense — đúng utility chuẩn, không hack. BreathGate/CelebrationModal/BillFundReminder là UI form-level → KHÔNG recreate trong 4A (follow-up).

## 8. Tests
**New:** `ai-money-amount-parser` (11), `ai-money-action-validators` (8), `ai-money-action-command-parser` (11), `ai-money-action-protocol` (5).
**Scripts:** thêm `test:ai-amount|act-validators|act-parser|act-protocol`, gộp vào `test:ai-money`.
**Commands & kết quả:**
- `npx tsc --noEmit` → **0 errors**
- `npm run test:ai-money` → **194 PASS / 0 FAIL** (22 suites)
- `npm run test:moneybrain` → 0 FAIL
- `npm run test:ai-all` → **76 PASS / 0 FAIL** (no regression)
- `eslint` changed files → 0 errors/warnings
- guard greps: 0 Zustand server-side; Zustand chỉ trong `clientActionExecutor.ts`.

## 9. Risks / Follow-up for Phase 4B
- 7 action còn lại: CREATE_FIXED_BILL, SET_CATEGORY_BUDGET, ADD_GOAL_DEPOSIT, CREATE_EARNING_TASK, COMPLETE_EARNING_TASK, ADD_WISHLIST_ITEM, FLAG_TRANSACTION (cần audit signature store tương ứng).
- XP/streak/Celebration/BillFundReminder: hiện chỉ có streak qua `addTransaction`; các side-effect UI (CelebrationModal, BillFundReminder, BreathGate slow-confirm) chưa tái hiện trong chat — cân nhắc Phase 4B.
- Stale snapshot: executor re-validate bill; với CREATE_* không có entity nên ít rủi ro.

---

## Phase 4A Acceptance Checklist
- [x] `MoneyActionRequest` type (3 action)
- [x] action request builder
- [x] amount parser
- [x] validator (3 action)
- [x] command parser (3 action)
- [x] server trả actionRequest cho command rõ ràng
- [x] server KHÔNG execute Zustand
- [x] pure question không tạo actionRequest
- [x] client confirmation card
- [x] client confirm → execute Zustand
- [x] client cancel → hủy pending
- [x] client rebuild snapshot sau execute (Zustand re-render)
- [x] expense ≥ 3.000.000đ không bypass BreathGate
- [x] deterministic action parsing không gọi LLM
- [x] tests parser/validator/protocol pass
- [x] moneyBrain/ai-money/ai-all pass
- [x] tsc pass
- [x] eslint changed files pass
- [x] report Phase 4A
- [x] chưa commit (chờ duyệt)
