# ManiCash — Money Operating System Roadmap **v1.1** (Autobot Quản gia)

> Nâng cấp chatbot thu-chi → "Kế toán cá nhân + Quản gia dòng tiền + CFO mini".
> Nguồn: Product Owner. **v1.1 — 2026-06-08: ĐÃ CHỐT 6 ràng buộc kiến trúc. Lock constraints trước, rồi mới triển khai intent handlers + CFO AI.**

## Phương châm vận hành
**Tăng thu — giảm chi — tích cực kiếm tiền — tiết kiệm làm đòn bẩy — dùng tiền dư để đầu tư vào năng lực, công cụ lao động và dòng tiền.**

## 3 tầng
- **T1 Kế toán dữ liệu** — trả sự thật bằng backend, 0 token.
- **T2 Quản gia điều phối** — nhắc việc + đề xuất hành động.
- **T3 AI CFO** — đọc CFO Context Pack đã tính sẵn. **AI KHÔNG tự đoán số.**

---

## 🔒 6 RÀNG BUỘC KIẾN TRÚC (bất biến, áp cho mọi phase)

1. **Isomorphic Money Brain** — engine là **pure TS functions**: không import React, không Zustand, không gọi API, **không gọi `Date.now()`**. Dùng CHUNG cho cả UI selectors lẫn Chat server. Một công thức, một nơi định nghĩa.
2. **Server KHÔNG execute action** — state nằm ở Zustand client. Server chỉ trả `actionRequest`; **client confirm → client gọi Zustand action**.
3. **Thời gian = `clientNow` + `timezone`** — truyền trong snapshot; engine không bao giờ tự lấy giờ server (Vercel = UTC).
4. **healthScore deterministic** — do engine tính; LLM chỉ narrate, không sinh số mới.
5. **Snapshot Contract `MoneySnapshotV1`** — hợp đồng chung client/server/UI/AI, versioned.
6. **Category normalization** — `entertain → entertainment` qua `CATEGORY_ALIASES`, sửa trước khi recompute budget.

---

## Isomorphic Money Brain — cấu trúc
```
src/lib/moneyBrain/
  types.ts          # MoneySnapshotV1, FinancialMode, CFOContextPack, ActionRequest
  snapshot.ts       # validate + normalize snapshot
  dateRange.ts      # period→range, ISO week (Mon-start), dùng clientNow
  normalize.ts      # CATEGORY_ALIASES, normalize VN text
  financeMetrics.ts # income/expense/cashflow by period, savingsRate
  budgetMetrics.ts  # computeBudgetSpent từ transactions, overBudget, progress
  billMetrics.ts    # unpaid, upcoming(days), coverageRate, "đóng hết còn bao nhiêu"
  goalMetrics.ts    # progress, gap, atRisk, requiredMonthlyContribution
  taskMetrics.ts    # active/overdue/completed, pipeline, actualIncome
  healthScore.ts    # deterministic 100đ
  cfoContextPack.ts # build gói cho AI
```
Luồng:
```
UI selectors → buildMoneySnapshotFromStores() → moneyBrain functions
Chat client  → buildMoneySnapshotFromStores() → POST snapshot
Chat server  → moneyBrain functions(snapshot) → deterministic reply | CFOContextPack
```

---

## Snapshot Contract — `MoneySnapshotV1`
```ts
type MoneySnapshotV1 = {
  version: "money_snapshot_v1";
  clientNow: string;            // BẮT BUỘC
  timezone: "Asia/Ho_Chi_Minh"; // BẮT BUỘC
  wallets: { main: number; emergency: number; billFund: number };
  transactions: Array<{
    id; type: "income"|"expense"|"transfer"; amount;
    categoryId?; categoryName?; wallet?: "main"|"emergency"|"bill-fund"; note?;
    date; dateKey; weekKey; monthKey; time?;
  }>;
  budgets: Array<{ categoryId; categoryName; monthlyLimit; monthKey }>;
  bills: Array<{ id; name; amount; dueDay; isPaid }>;
  goals: Array<{ id; name; targetAmount; currentAmount; deadline?; monthlyContributionTarget? }>;
  tasks: Array<{ id; name; expectedAmount; actualAmount?; startDate; endDate;
                 completedAt?; deletedAt?; subTasks?: Array<{id; isCompleted}> }>;
  user?: { rank?; xp?; streak?; streakShields? };
};
```

## Công thức chốt v1.1

### Safe-to-Spend (SỬA: dùng contribution target, KHÔNG dùng currentAmount)
```
safeToSpend = monthlyIncome + carryOver
            − plannedMonthlyBudget
            − unpaidFixedBills
            − plannedMonthlyGoalContributions
```

### HealthScore (deterministic, 100đ)
```
Cashflow dương            25
Bill coverage             20
Emergency runway          20
Budget discipline         15
Goal progress             10
Income pipeline (tasks)   10
```
AI chỉ diễn giải: "53/100 vì bill coverage yếu và runway thấp." — KHÔNG tự chấm điểm khác.

### Cash Runway (2 loại)
```
liquidBalance = mainBalance + emergencyBalance
monthlySurvivalBurn = fixedBills + essentialCategoryAvgLast3Months
  (essential: ăn uống, nhà, điện, nước, internet, di chuyển, sức khỏe)
survivalRunwayDays  = liquidBalance / monthlySurvivalBurn  * 30
lifestyleRunwayDays = liquidBalance / monthlyAvgExpense    * 30
```

### FinancialMode (auto-derive v1, user override sau)
```
type FinancialMode = "stabilize" | "build_cashflow" | "accelerate" | "protect_capital";
safeToSpend<=0 || billCoverage<1            → stabilize
safeToSpend>0 && savingsRate<20%            → build_cashflow
savingsRate>=20% && runway>=3 tháng         → accelerate
liquidBalance lớn + mục tiêu dài hạn ổn     → protect_capital
```

### Category aliases
```ts
const CATEGORY_ALIASES = { entertain: "entertainment" };
normalizedCategoryId = CATEGORY_ALIASES[categoryId] ?? categoryId;
```

---

## Action Protocol (Phase 4) — client-executed
Server trả:
```ts
{ type:"action_request", action:"MARK_BILL_PAID",
  preview:"Đánh dấu bill Tiền điện 350.000đ là đã thanh toán?",
  payload:{ billId:"bill_electricity" }, requiresConfirmation:true }
```
Luồng: `User lệnh → server đề xuất actionRequest → client confirm → user OK → client execute Zustand → client cập nhật UI + snapshot mới`.
Actions: MARK_BILL_PAID, CREATE_EXPENSE, CREATE_INCOME, CREATE_FIXED_BILL, SET_CATEGORY_BUDGET, ADD_GOAL_DEPOSIT, CREATE_EARNING_TASK, COMPLETE_EARNING_TASK, ADD_WISHLIST_ITEM, FLAG_TRANSACTION.

## CFO AI — JSON schema (chỉ nhận Context Pack)
```ts
{ summary: string; diagnosis: string[]; risks: string[];
  opportunities: string[]; actionPlan7Days: string[] }
```
Không trả số tự chế.

## 3 Mode trả lời
A — Kế toán nhanh (số liệu) · B — Quản gia cảnh báo (rủi ro) · C — CFO chuyên sâu (phân tích/tư vấn/kế hoạch/tối ưu).

---

## Roadmap 14 ngày (v1.1)
- **D1–2** Snapshot Contract + Date Engine (clientNow, timezone, dateKey/weekKey/monthKey, ISO week Mon-start).
- **D3–4** Isomorphic Money Brain — pure functions: income/expense/cashflow/bills/budget/goals/tasks/safe-to-spend.
- **D5** Refactor UI dùng lại Money Brain (`useSafeBalance`, Tổng quan, Sổ sách summary, Money CFO chart) — cùng công thức.
- **D6** Category normalization + budget recompute từ transactions (bỏ hardcoded spent).
- **D7–8** Intent Router V2 — slot period/category/bill/goal/task; sửa triệt để "hôm nay" vs "tháng này" (filter dateKey===today).
- **D9–10** Deterministic handlers — 80 câu 0-token (số dư/chi/thu/bill/budget/goals/wishlist/task/streak).
- **D11** Client-executed action protocol.
- **D12** CFOContextPack V2 (executive summary, behavior, overbudget, bill risk, goal risk, income pipeline).
- **D13** AI CFO JSON schema — chỉ nhận context pack.
- **D14** Test + QA (hôm nay/tháng này/tuần này, bill, "đóng hết còn bao nhiêu", goal gap, task ưu tiên, CFO phân tích).

## Test QA chốt (D14)
"Hôm nay chi bao nhiêu?" · "Tháng này chi bao nhiêu?" · "Tuần này thu bao nhiêu?" · "Bill nào chưa đóng?" · "Nếu đóng hết bill thì còn bao nhiêu?" · "Quỹ khẩn cấp còn thiếu bao nhiêu?" · "Task nào nên làm trước để kiếm tiền nhanh nhất?" · "Phân tích CFO tháng này."

---
## ⚠️ Gotchas khi triển khai (ghi nhớ)
- UI `SafeToSpendCard` đang hiển thị breakdown dùng **tổng bill** + ngưỡng chi; v1.1 đổi sang **unpaid bill** + **goal contribution** → số hiển thị sẽ đổi (đúng ý đồ), cần cập nhật cả 5 dòng breakdown + modal giải thích.
- SEED_GOALS chưa có `monthlyContributionTarget` → cần seed giá trị + UI để user đặt.
- Khi recompute budget từ transactions, demo numbers sẽ đổi (seed spent hardcode ≠ seed transactions) → chấp nhận hoặc reseed nhất quán.
- `essentialCategoryAvgLast3Months` cần đủ lịch sử; seed hiện chỉ 14 ngày → runway tháng trước có thể thiếu data, cần fallback.
