# Phase 0 Report — Money Brain Data Contract, Timezone & Consistency Hardening

## 1. Summary
- **Đã làm:**
  - Tạo Snapshot Contract `MoneySnapshotV1` (shared types, pure).
  - Tạo Money Brain date engine timezone-aware (`dateRange.ts`) — không dùng giờ server.
  - Category normalization `entertain → entertainment`.
  - Adapter `toMoneySnapshotV1` + helper period `getIncome/ExpenseForPeriod`.
  - Sửa `handleQuerySpending`: "hôm nay" ≠ "tháng này" (lọc theo `dateKey`).
  - Mở rộng `ClientSnapshotInput` + `buildClientSnapshot`: thêm `clientNow`, `timezone`, `carryOver`, và per-transaction `date/dateKey/weekKey/monthKey/wallet/categoryName/note/time`.
  - `Goal.monthlyContributionTarget?` + truyền qua snapshot.
  - Làm rõ label Ledger all-time (mismatch fix nhỏ).
  - 4 test file mới (TDD), 36 assertion mới.
- **Chưa làm (đúng phạm vi — để Phase 1):** full Money Calculation Engine, refactor `useSafeBalance`/UI dùng lại engine, recompute budget `spent` từ transactions, CFOContextPack, action execution, deterministic 80 câu.

## 2. Files Changed
**Mới:**
- `src/lib/moneyBrain/types.ts` — `MoneySnapshotV1` + sub-types (pure, no React/Zustand).
- `src/lib/moneyBrain/dateRange.ts` — `getDateKey/getMonthKey/getISOWeekKey/getTodayKey/getCurrentMonthKey/isTransactionInPeriod/detectPeriod` (tz-aware, ISO week Mon-start).
- `src/lib/moneyBrain/normalize.ts` — `CATEGORY_ALIASES`, `normalizeCategoryId`.
- `src/lib/moneyBrain/snapshot.ts` — `toMoneySnapshotV1` adapter (boundary shim).
- `src/lib/moneyBrain/financeSummary.ts` — `getIncomeForPeriod/getExpenseForPeriod`.
- `tests/moneybrain-date.test.ts` (22), `tests/moneybrain-normalize.test.ts` (4), `tests/moneybrain-summary.test.ts` (7), `tests/ai-money-spending-period.test.ts` (3).

**Sửa:**
- `src/lib/aiMoneyChat/aggregation/types.ts` — `ClientSnapshotInput` thêm `version/clientNow/timezone/carryOver` + transaction date fields + goal `monthlyContributionTarget` (đều optional, additive).
- `src/lib/aiMoneyChat/clientSnapshot.ts` — emit date keys + clientNow/timezone/carryOver/monthlyContributionTarget.
- `src/lib/aiMoneyChat/handlers/handleQuerySpending.ts` — period-aware qua Money Brain; fallback aggregated khi không có client snapshot.
- `src/types/budget.ts` — `Goal.monthlyContributionTarget?`.
- `src/app/(app)/chat/_components/AiMoneyChatContent.tsx` — truyền `carryOver` vào builder.
- `src/app/(app)/ledger/_components/LedgerContent.tsx` — label "Thu nhập (tất cả)" / "Chi tiêu (tất cả)".
- `package.json` — 4 test script mới.

## 3. Snapshot Contract
- **version:** `money_snapshot_v1`.
- **fields added:** `clientNow` (bắt buộc), `timezone` (bắt buộc), `carryOver`; transaction: `date, dateKey, weekKey(ISO), monthKey, wallet, categoryName, note, time`; goal: `monthlyContributionTarget`.
- **timezone handling:** mọi key tính qua `Intl.DateTimeFormat` theo timezone client. Engine (dateRange/financeSummary) KHÔNG gọi `Date.now()` — nhận `clientNow`. Fallback `new Date()` chỉ ở boundary adapter khi client (legacy) không gửi clientNow.

## 4. Bug Fixes
- **Hôm nay vs tháng này:** `handleQuerySpending` dùng `detectPeriod(rawText)` + `getExpenseForPeriod` lọc theo `dateKey`. Test chứng minh: snapshot có 660k hôm nay + 2.000.000 ngày khác → "hôm nay" trả 660k (KHÔNG 2.660.000), "tháng này" trả 2.660.000.
- **entertain vs entertainment:** `normalizeCategoryId` áp ở adapter cho transaction + budget categoryId.
- **Ledger all-time/monthly:** relabel rõ "(tất cả)" — Option A least-disruptive. (Phase 1 có thể thêm period toggle.)
- **goals monthlyContributionTarget:** thêm field optional; safe-to-spend Phase 1 sẽ trừ contribution/tháng thay vì `currentAmount`.

## 5. Tests
- **New tests:** moneybrain-date (22), moneybrain-normalize (4), moneybrain-summary (7), ai-money-spending-period (3) — TDD (RED watched trước GREEN).
- **Commands run (project dùng npm + jiti, KHÔNG pnpm):**
  - `npx tsc --noEmit` → exit 0.
  - `npm run test:mb-date | mb-normalize | mb-summary | ai-spending-period | ai-queries | ai-client-snapshot | ai-handlers | ai-cfo-llm | ai-conversation | ai-security | ai-intent`.
  - `npx eslint` trên các file đã đổi → exit 0.
- **Result:** 11 suite, **135 assertion PASS, 0 FAIL**. tsc 0. eslint 0.

## 6. Risks / Follow-up for Phase 1
- **`buildClientSnapshot` vẫn lọc transactions theo tháng hiện tại (UTC `getCurrentMonthKey`).** Nên `last_month`/giao dịch ngày khác tháng chưa lên snapshot — `detectPeriod` hỗ trợ last_month nhưng dữ liệu chưa đủ. Phase 1: mở rộng cửa sổ snapshot (vd current + last month) hoặc gửi raw rộng hơn.
- **Hai bản tính số liệu vẫn tồn tại tạm:** handler dùng Money Brain; UI (`useSafeBalance`) vẫn công thức cũ. Phase 1 phải refactor UI dùng lại engine (isomorphic) — đây là rủi ro lệch số cho tới khi hợp nhất.
- **Budget `spent` vẫn cộng bằng action, chưa recompute từ transactions.** Phase 1: `computeBudgetSpent(transactions, budgets, monthKey)` dùng `normalizeCategoryId`.
- **SEED_GOALS chưa có `monthlyContributionTarget`** → snapshot trả undefined → safe-to-spend Phase 1 cần fallback 0 + UI để user nhập.
- **Pre-existing (KHÔNG do Phase 0):** dev server cảnh báo Turbopack edge-instrumentation ở `security/telemetry.ts` (`NEXT_PUBLIC_APP_URL`). tsc pass; không liên quan Phase 0.
- **Fallback `new Date()` trong adapter** chỉ cho legacy snapshot thiếu clientNow; flow thật luôn gửi clientNow. Cân nhắc Phase 1 ép clientNow bắt buộc.
