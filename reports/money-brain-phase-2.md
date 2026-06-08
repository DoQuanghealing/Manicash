# Phase 2 Report — Deterministic Money Chat V2

**Date:** 2026-06-08 · **Branch:** `codex/ai-money-chat` · **Starting commit:** `26285a6` · **Working tree:** chưa commit (chờ duyệt)

## 1. Summary

### Đã làm
- Mở rộng Intent Router V2: thêm 8 intent deterministic mới + slot extractor.
- 4 handler deterministic MỚI (income, budget/category, health, streak).
- Mở rộng 3 handler (bill: +upcoming +coverage; tasks: +earning pipeline; safe-to-spend → engine v1.1).
- Tất cả số liệu lấy từ `src/lib/moneyBrain` — không duplicate công thức.
- Tất cả câu hỏi số liệu trả lời **0 token** (không gọi LLM).
- Wire `user` (streak/shields) + `actualAmount` (task) qua snapshot pipeline.

### Chưa làm (đúng phạm vi — để Phase sau)
- Không nâng CFO AI / CFOContextPack (Phase 3).
- Không implement actionRequest / execute Zustand action từ server.
- Không thêm DB, không refactor UI lớn.

## 2. Git
- Branch: `codex/ai-money-chat`
- Starting / Ending commit: `26285a6` (chưa tạo commit Phase 2 — chờ duyệt)
- Working tree: 12 modified, 9 untracked (xem mục 7)

## 3. Intent Router V2
**Intent mới:** `QUERY_INCOME`, `QUERY_UPCOMING_BILLS`, `QUERY_BILL_COVERAGE`, `QUERY_BUDGET_STATUS`, `QUERY_CATEGORY_SPENDING`, `QUERY_EARNING_PIPELINE`, `QUERY_HEALTH_SCORE`, `QUERY_STREAK` (giữ `QUERY_TASKS_TODAY` làm alias tasks).

**Classification rules (điểm chính):**
- `QUERY_TASKS_TODAY` thêm `mustMatch` từ ngữ công việc → tránh "hôm nay" nuốt nhầm câu chi tiêu.
- `QUERY_CATEGORY_SPENDING` chỉ fire khi câu nêu tên danh mục (mustMatch); bỏ `\ban\b` trần để không dính "an toàn".
- `QUERY_SAFE_TO_SPEND` mở rộng: "còn/được/để ... xài/tiêu", "mỗi/một ngày", "nên tiêu", "tiêu an toàn".
- Bill upcoming/coverage được route tới `handleQueryBill` (classify là `QUERY_BILL_STATUS`, handler tự phân nhánh theo slot `days` / từ khóa "quỹ bill", "đủ trả").
- Earning pipeline route tới `handleQueryTasks` (handler tự nhận "làm hết task", "thêm bao nhiêu").
- `bill` thêm vào keyword bill để thắng false-positive `LOG_TRANSACTION` khi câu có chữ số ("7 ngày tới có bill nào").

## 4. Slot Extractor (`intent/slotExtractor.ts`)
- **period**: hôm nay/hôm qua/tuần này/tháng này/tháng trước (chỉ set khi nêu rõ → câu không nêu trả slots rỗng).
- **days**: "N ngày", "tuần tới"→7.
- **wallet**: ví chính→main, quỹ dự phòng→emergency, quỹ bill→bill-fund.
- **category**: cụm ô danh mục (ăn uống/cà phê/di chuyển/giải trí/sức khỏe/đi chợ) + `EXPENSE_KEYWORD_RULES` (longest-match) + `normalizeCategoryId`. Loại "ngân sách" trước khi dò để tránh 'sách'→Học tập.
- **billName**: điện/nước/internet/tiền nhà/học phí/trả góp/điện thoại.
- **goalName**: mua nhà/quỹ khẩn cấp/xe/vốn đầu tư.
- **taskStatus**: trễ hạn→overdue, đang làm→active, hoàn thành→completed.

## 5. Deterministic Handlers (đều dùng moneyBrain, source='deterministic')
| Handler | Engine functions |
|---|---|
| Balance | `getFinanceSnapshot` wallets (giữ nguyên) |
| **Income** (mới) | `getIncomeForPeriod` + guard last_month thiếu data |
| Spending | `getExpenseForPeriod` + top categories (Phase 0) |
| **Bills** | status (snapshot due/overdue) + `getUpcomingBills` + `getTotalUnpaidBills`/`getBillFundGap` |
| **Budget/Category** (mới) | `getBudgetCategoryProgress`, `getOverBudget…`, `getPlannedMonthlyBudget`, `computeBudgetSpentByCategory`, `getSavingsPotentialForCategory` |
| Safe-to-spend | **migrate → `getSafeToSpendBreakdown` (v1.1, isomorphic với UI)** |
| Savings | `getFinanceSnapshot` cashflow (giữ nguyên) |
| Goals | `getFinanceSnapshot` goals (đã deterministic + atRisk) |
| **Tasks/Pipeline** | list (snapshot) + `getExpectedIncomePipeline`, `getActualTaskIncomeForPeriod` |
| **Health** (mới) | `getFinancialHealthScore` (6 thành phần, 100đ) |
| **Streak** (mới) | `snapshot.user` (báo thiếu nếu vắng — không bịa 0) |

## 6. LLM Guard
- Deterministic routes (15 intent): 0 token, `meta.source='deterministic'`.
- LLM routes: chỉ `CFO_REPORT` / `ANALYZE_FINANCE` / `ADVICE_CUT_SPENDING` → `handleCFOReport`; `FOLLOW_UP` → `handleFollowUp`.
- `grep` xác nhận chỉ `handleCFOReport.ts` + `handleFollowUp.ts` import LLM; các handler deterministic mới KHÔNG.

## 7. Tests
**Mới:** `tests/ai-money-slot-extractor.test.ts` (25), `tests/ai-money-intent-router-v2.test.ts` (37 — gồm pipeline guard), `tests/ai-money-deterministic-handlers.test.ts` (14).
**Cập nhật:** `ai-money-queries` (safe-to-spend → v1.1 13.25M/an toàn).
**Scripts mới:** `test:mb-slots`, `test:ai-intents-v2`, `test:ai-handlers-v2` (đã thêm vào `test:ai-money`).

**Commands & kết quả:**
- `npx tsc --noEmit` → **0 errors**
- `npm run test:moneybrain` → 10 suites PASS
- `npm run test:ai-money` → **131 PASS / 0 FAIL** (8 suites)
- `npm run test:ai-all` → **76 PASS / 0 FAIL** (không regression)
- `npx eslint <changed>` → **0 errors, 0 warnings**

## 8. Risks / Follow-up cho Phase 3
- Bill status path còn dùng `getFinanceSnapshot` (đã tính paid/due/overdue) thay vì engine billMetrics — giữ để không phá test; có thể isomorphic-hoá sau.
- Goals/Savings handler vẫn dùng `getFinanceSnapshot` (deterministic, đúng số) — có thể chuyển sang `goalMetrics` để đồng nhất nguồn.
- Streak cần FE gửi `user` trong clientSnapshot (đã wire `buildClientSnapshot` + `AiMoneyChatContent`); production cần app đồng bộ profile.
- Phase 3: CFO Context Pack — feed báo cáo Money Brain đã tính sẵn cho LLM thay vì chỉ prompt vai trò.
