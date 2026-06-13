# Phase 4B Report — Extended Client-executed Actions

## 1. Summary
**Đã làm:** Mở rộng action protocol (tái dùng Phase 4A) cho 7 action: CREATE_FIXED_BILL, SET_CATEGORY_BUDGET, ADD_GOAL_DEPOSIT, CREATE_EARNING_TASK, COMPLETE_EARNING_TASK, ADD_WISHLIST_ITEM, FLAG_TRANSACTION. Cả 7 đều có type + validator + parser + client executor (đều có store thật, không cần fallback "không hỗ trợ"). Server chỉ tạo `actionRequest`; client confirm rồi execute; 0-token; không nhân đôi XP.
**Chưa làm (đúng scope):** audit log / history / undo / persistence / database (Phase 5).

## 2. Branch / Git
- Branch: `codex/ai-money-chat`
- Starting commit: `f45824d` (Phase 4A — đã commit đầu phiên này để thỏa precondition Step 1)
- Ending commit: chưa commit (chờ duyệt)
- Working tree: 7 modified + 1 untracked

## 3. Actions Added
| Action | Parser ví dụ | Preview | Risk |
|---|---|---|---|
| CREATE_FIXED_BILL | "thêm bill internet 250k hạn ngày 12" | "Tạo bill Internet 250.000đ, hạn ngày 12 mỗi tháng?" | medium |
| SET_CATEGORY_BUDGET | "đặt ngân sách ăn uống 3 triệu" | "Đặt ngân sách Ăn uống tháng này là 3.000.000đ?" | medium |
| ADD_GOAL_DEPOSIT | "nạp 2 triệu vào quỹ khẩn cấp" | "Nạp 2.000.000đ vào mục tiêu Quỹ khẩn cấp?" | medium |
| CREATE_EARNING_TASK | "tạo task freelance logo 3 triệu hạn 20/6" | "Tạo nhiệm vụ … kỳ vọng 3.000.000đ, hạn 20/06/2026?" | medium |
| COMPLETE_EARNING_TASK | "hoàn thành task dạy kèm" | "Đánh dấu task Dạy kèm là hoàn thành?" | medium |
| ADD_WISHLIST_ITEM | "thêm iphone vào wishlist 20 triệu" | "Đưa … vào wishlist và khóa mua trong 48 giờ?" | low |
| FLAG_TRANSACTION | "gắn cờ giao dịch quần áo hôm nay" | "Gắn cờ giao dịch Quần áo 600.000đ?" | low |

## 4. Store Support Audit
- **Supported by existing stores (tất cả):**
  - `useFinanceStore.addBill(Omit<FixedBill,'id'|'isPaid'>)` — `icon` bắt buộc → executor default `🧾`.
  - `useBudgetStore.setCategoryBudget(catId, limit)`; `useBudgetStore.toggleTransactionFlag(txnId)`.
  - `useGoalsStore.addFundsToGoal(id, amount, source='manual', note?)`.
  - `useTaskStore.addTask({name,expectedAmount,startDate,endDate,subTasks?})`; `useTaskStore.completeTask(id, actualAmount)`.
  - `useWishlistStore.addItem({name, price, reason, coolingHours})` — `CoolingHours=24|48|72|96|168`; executor map `cooldownHours`→48 mặc định.
- **Not supported / fallback:** không có — cả 7 đều có store action thật.
- **XP side effects:** `addFundsToGoal` (SAVINGS_DEPOSIT) và `completeTask` (TASK_COMPLETE) tự cộng XP trong store → executor KHÔNG nhân đôi. Các action còn lại không có XP.

## 5. Server / API
- Parser (`actionCommandParser.ts`): 7 nhánh deterministic chạy TRƯỚC income/expense (để verb 'mua'/'thêm' của goal-deposit/wishlist không bị nuốt nhầm). Thiếu dữ liệu → null (clarification).
- Validator (`actionValidators.ts`): 7 case mới (dueDay 1–31, limit≥0, goal/task tồn tại, task chưa completed/deleted, endDate ISO hợp lệ, txn tồn tại…).
- actionRequest shape: tái dùng `MoneyActionRequest` union (Phase 4A) + 7 payload mới; mọi request `pending_confirmation` + `requiresConfirmation:true`.
- LLM guard: grep `openai|groq|generateLLMResponse` trong `actions/` + `api/chat` → CLEAN.
- Server execution guard: grep Zustand trong `api`/`moneyBrain`/`parser`/`handlers` → CLEAN.

## 6. Client Executor (`clientActionExecutor.ts` — CLIENT ONLY)
- Store actions used: addBill, setCategoryBudget, addFundsToGoal, addTask, completeTask, addItem, toggleTransactionFlag.
- Revalidation: re-check expired; goal/task/txn còn tồn tại; task chưa completed/deleted trước khi execute.
- Unsupported fallback: N/A (tất cả supported). BreathGate (Phase 4A) cho CREATE_EXPENSE vẫn giữ.

## 7. UI
- Confirmation card: generic (Phase 4A) — tự render mọi `MoneyActionRequest`, không sửa.
- Confirm/cancel: không đổi (no regression).
- Risk labels + title: thêm 7 title vào `actionCopy.ts`.

## 8. Tests
- New: `tests/ai-money-client-action-executor.test.ts` (12 — mutate Zustand thật + guard expired/BreathGate/stale).
- Updated: `ai-money-action-command-parser` (+13 case 4B), `ai-money-action-validators` (+12 case 4B).
- Scripts: thêm `test:ai-act-executor`, gộp vào `test:ai-money`.
- Commands & kết quả:
  - `npx tsc --noEmit` → **0 errors**
  - `npm run test:ai-money` → **231 PASS / 0 FAIL**
  - `npm run test:moneybrain` → 0 FAIL
  - `npm run test:ai-all` → 0 FAIL (no regression)
  - eslint changed files → 0 errors/warnings
  - guard greps: Zustand chỉ trong `clientActionExecutor.ts`; không LLM trong parser/api.

## 9. Risks / Follow-up Phase 5
- Audit log / action history: chưa có (Phase 5).
- Undo: chưa có.
- Persistence: action chỉ mutate Zustand client; chưa sync Firestore.
- Missing store actions: không còn — 10/10 action đã có store.
- Name extraction (task/wishlist) là best-effort heuristic; có thể tinh chỉnh sau.
- Side-effects UI (CelebrationModal/BillFundReminder/BreathGate slow-confirm) vẫn ở form-level, chưa tái hiện trong chat.

---

## Phase 4B Acceptance Checklist
- [x] 7 action mới có type
- [x] 7 action mới có validator
- [x] 7 action mới có parser (hoặc safe null/clarification)
- [x] 7 action mới có client executor path
- [x] server trả actionRequest cho command rõ ràng
- [x] server không execute Zustand
- [x] pure questions không tạo actionRequest
- [x] confirmation card support tất cả action
- [x] confirm/cancel flow không regression
- [x] client revalidation trước execute
- [x] không hack unsupported (tất cả có store thật)
- [x] action commands không gọi LLM
- [x] Phase 4A actions vẫn pass
- [x] tests parser/validator/protocol/executor pass
- [x] moneyBrain/ai-money/ai-all pass
- [x] tsc pass
- [x] eslint changed files pass
- [x] report Phase 4B
- [x] chưa commit (chờ duyệt)
