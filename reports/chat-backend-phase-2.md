# Chat Backend Upgrade — Phase 2 Report (Deterministic Queries Pipeline)

Date: 2026-06-07
Branch: `codex/ai-money-chat`
Author: Claude Code (Execution)
Reviewer: Selena (Architect)

## Mục tiêu

Xây pipeline xử lý câu hỏi **deterministic (0 token)**: số dư, hóa đơn, nhiệm vụ;
endpoint `/api/chat` duy nhất; cache 5 phút; trả Markdown số liệu thật.

## Quyết định kiến trúc lớn (đã được PO duyệt): HYBRID data source

Phát hiện điểm vênh: prompt giả định server đọc Firestore `users/{uid}/state/wallets`,
`/bills`, `/tasks` — **các collection này KHÔNG tồn tại**. Thực tế: chỉ
`users/{uid}/finance_core/state` (ledger) được sync; bills/tasks sống client-side Zustand;
pattern dự án (`/api/cfo`) là **client gửi snapshot lên**.

→ PO chốt **Hybrid**:
1. Route nhận `clientSnapshot` (optional) trong body.
2. `getFinanceSnapshot(uid, { clientSnapshot })`: có client snapshot hợp lệ → dùng ngay
   (real-time, validate nhẹ); không có → fallback Promise.all đọc Firestore.
3. Giữ nguyên chữ ký hàm cho Phase 3.

## Đã hoàn thành

- `getFinanceSnapshot` hybrid + validate + cache `Map` TTL 5 phút + `invalidateSnapshotCache`.
- 3 handler deterministic (balance/bill/tasks) + `handleLogTransaction` (confirm card).
- Endpoint `/api/chat` POST: auth → routeIntent → switch-case dispatch → đo `latencyMs`
  → placeholder cho intent LLM (Phase 3).
- Test 13 ca, **13/13 PASS**. Lint exit 0. tsc-clean cho toàn bộ file mới + vá 1 lỗi type
  tồn đọng từ Phase 1.

## Files changed

| File | Loại | Mô tả |
|---|---|---|
| `src/lib/aiMoneyChat/aggregation/types.ts` | NEW | `MonthlyFinancialSnapshot` (rút gọn), `ClientSnapshotInput`, `GetSnapshotOptions`, `ChatHandlerContext`. |
| `src/lib/aiMoneyChat/aggregation/snapshotBuilder.ts` | NEW | `getFinanceSnapshot`, `validateClientSnapshot`, `invalidateSnapshotCache`, `CACHE_TTL_MS`, Firestore fallback (Promise.all). |
| `src/lib/aiMoneyChat/handlers/format.ts` | NEW | `formatVnd` (Intl vi-VN). |
| `src/lib/aiMoneyChat/handlers/handleQueryBalance.ts` | NEW | 3 ví + tổng. |
| `src/lib/aiMoneyChat/handlers/handleQueryBill.ts` | NEW | bóc slot loại bill + đối chiếu paid/due/overdue. |
| `src/lib/aiMoneyChat/handlers/handleQueryTasks.ts` | NEW | liệt kê nhiệm vụ active + thu nhập dự kiến. |
| `src/lib/aiMoneyChat/handlers/handleLogTransaction.ts` | NEW | confirm-transaction card. |
| `src/app/api/chat/route.ts` | NEW | endpoint duy nhất. |
| `tests/ai-money-chat-handlers.test.ts` | NEW | 13 ca async. |
| `src/lib/aiMoneyChat/intent/intentRouter.ts` | EDIT | vá lỗi tsc TS2322 (cast slots). |
| `package.json` | EDIT | thêm script `test:ai-handlers`. |

## Data logic

- **Wallet**: client gửi `{ main, emergency, billFund }` → tổng `total`. Fallback Firestore
  suy từ ledger: `main = MAIN_BANK + SPENDING`, `emergency = EMERGENCY_FUND`,
  `billFund = BILL_FUND` (approximate, có warning).
- **Bill status**: `isPaid → paid`; chưa trả & `dayOfMonth > dueDay → overdue`; còn lại `due`.
  Slot loại bill bóc bằng keyword fold dấu (`dien/nuoc/internet/thue nha...`), match tên bill.
- **Task**: lọc `deletedAt`; `completedAt` trong tháng → completed; quá `endDate` → overdue;
  còn lại active/pending. "Hôm nay có việc gì" = pending+active+overdue.
- **Cache**: client snapshot luôn refresh cache (real-time); lượt sau không gửi client →
  trả cached trong 5 phút; `invalidateSnapshotCache(uid)` xóa theo prefix.

## Ví dụ output thật (từ test)

- `tôi còn bao nhiêu tiền` → "Ví chính: **4.500.000 ₫** ... Tổng cộng: **11.700.000 ₫**".
- `tiền điện đóng chưa` → "Hóa đơn Tiền điện 350.000 ₫ tháng này ngài **ĐÃ ĐÓNG rồi**."
- `internet trả chưa` → "... ngài **CHƯA ĐÓNG**."
- `hôm nay tôi có việc gì` → "**Viết bài thuê** — dự kiến 1.500.000 ₫ (1/2 việc nhỏ)".
- `mua trứng 30k` → confirm card, `ui.kind = 'confirm-transaction'`, payload.amount=30000.

## Tests

- `npm run test:ai-handlers` → **13/13 PASS**.
- `npm run test:ai-intent` (Phase 1 regression) → 30/30 PASS.
- `npm run test:ai-chat` (parser regression) → 0 FAIL.
- `npx eslint <phase 2 files>` → exit 0.
- `npx tsc --noEmit` → 0 lỗi trong file của Phase 1/2 (xem rủi ro #1).

> Lưu ý test log có dòng `[snapshotBuilder] Firestore fallback failed: Firebase Admin not
> configured` — đây là **fail-safe có chủ đích**: không có env, fallback catch → trả `empty`
> kèm warning, KHÔNG throw, KHÔNG rớt request (đúng test "invalidateSnapshotCache").

## Rủi ro còn lại

1. **2 lỗi tsc pre-existing** ở `tests/ai-money-memory.test.ts` (thiếu `export {}`) và
   `tests/ai-money-quota.test.ts` (thiếu `cfoNarrationCredits`) — KHÔNG do Phase 2, đã tách
   thành task nền riêng. Không ảnh hưởng `next build` (chỉ ở tests).
2. **Firestore fallback suy số dư là approximate** (mapping account→ví). Đường chính
   (client snapshot) chính xác tuyệt đối. Cần Architect xác nhận mapping ví khi sync server
   thật ở phase sau.
3. **Chưa wire client** gửi `clientSnapshot` từ `/chat` page (việc FE, ngoài scope BE Phase 2).
4. `QUERY_SAVINGS / QUERY_SAFE_TO_SPEND / QUERY_GOAL_PROGRESS` mới có placeholder — sẽ thêm
   handler khi snapshot mở rộng cashflow/budget/goals ở Phase 3.

## Việc tiếp theo (Phase 3)

- Mở rộng `MonthlyFinancialSnapshot`: cashflow, budget/safeToSpend, top categories, anomaly
  z-score, goals, comparison tháng trước.
- `llm/systemPrompts.ts` (Lord Diamond), `promptBuilder.ts`, `llmClient.ts`
  (OpenAI GPT-4o-mini primary, Groq fallback — provider-agnostic).
- `handleCFOReport` thật + quota gate.
