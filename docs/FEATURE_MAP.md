# ManiCash — Bản đồ tính năng & Liên kết dữ liệu

> Tài liệu này mô tả **toàn bộ tính năng, trường dữ liệu, logic nghiệp vụ và sự liên kết** giữa 5 tab chính của ManiCash: Tổng quan, Sổ sách, Mục tiêu, Money, Nhập. Cập nhật: 2026-06-08.

---

## Mục lục

1. [Kiến trúc dữ liệu (5 Zustand stores)](#1-kiến-trúc-dữ-liệu)
2. [Tab: Nhập (nút giữa)](#2-tab-nhập-nút-giữa)
3. [Tab: Tổng quan](#3-tab-tổng-quan)
4. [Tab: Sổ sách](#4-tab-sổ-sách)
5. [Tab: Mục tiêu](#5-tab-mục-tiêu)
6. [Tab: Money](#6-tab-money)
7. [Gamification (XP Engine)](#7-gamification-xp-engine)
8. [AI Chat (/chat)](#8-ai-chat-chat)
9. [Sơ đồ liên kết tổng thể](#9-sơ-đồ-liên-kết-tổng-thể)
10. [Vấn đề & điểm chưa kết nối](#10-vấn-đề--điểm-chưa-kết-nối)

---

## 1. Kiến trúc dữ liệu

ManiCash **không dùng database client-side** — toàn bộ state sống trong 5 Zustand stores. Data chỉ persist khi có Firebase auth thật (hiện đang dùng demo seed).

### 1.1 `useFinanceStore` — Giao dịch & Ví
**File:** `src/stores/useFinanceStore.ts`

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `transactions[]` | `Transaction[]` | Toàn bộ lịch sử giao dịch (income/expense/transfer) |
| `mainBalance` | `number` | Số dư ví chính (đ) |
| `emergencyBalance` | `number` | Số dư quỹ dự phòng (đ) |
| `billFundBalance` | `number` | Số dư quỹ bill (đ) |
| `fixedBills[]` | `FixedBill[]` | Danh sách bill cố định hàng tháng |
| `billSnapshots[]` | `BillSnapshot[]` | Lịch sử trạng thái bill theo tháng |

**Transaction fields:**
```
id, type (income/expense/transfer), amount, categoryId, note,
wallet (main/emergency/bill-fund), date (ISO), time (HH:mm),
dateLabel (Hôm nay/Hôm qua/dd/MM), dateKey (YYYY-MM-DD),
kind?, splitBreakdown?, sourceTransactionId?
```

**Computed methods:**
- `getTotalIncome()` / `getTotalExpense()` — tổng toàn thời gian
- `getMonthlyIncome()` / `getMonthlyExpense()` — tháng hiện tại
- `getIncomeForMonth(monthKey)` / `getExpenseForMonth(monthKey)` — theo tháng cụ thể
- `getVirtualBalance()` — số dư ảo = mainBalance + emergencyBalance
- `getDailySummary()` — `Record<dateKey, {income, expense}>` cho calendar
- `getTotalFixedBillsAmount()` — tổng bill cố định
- `getAccumulatedBillTarget()` — xem bill nào đủ tiền đóng với quỹ hiện tại
- `resetBillsPaid()` — reset tất cả bill về chưa đóng khi sang tháng mới

**Seed data (demo mode):** 14 ngày gần nhất, income + 2-4 expense mỗi ngày, random deterministic.

---

### 1.2 `useBudgetStore` — Ngân sách & Rollover
**File:** `src/stores/useBudgetStore.ts`

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `carryOver` | `number` | Tiền dư tháng trước chuyển sang |
| `currentMonth` | `string` | Key tháng hiện tại (YYYY-MM) |
| `categoryBudgets[]` | `CategoryBudget[]` | Ngưỡng + đã chi theo từng danh mục |
| `flaggedCategories[]` | `string[]` | Danh mục user đánh dấu "cẩn thận" |
| `flaggedTransactionIds[]` | `string[]` | Giao dịch user flag riêng lẻ |
| `monthlySnapshots[]` | `MonthlySnapshot[]` | Báo cáo butler cuối mỗi tháng |
| `unviewedReportMonth` | `string \| null` | Tháng có báo cáo chưa xem |
| `xpAtMonthStart` | `number` | XP đầu tháng để tính delta |

**CategoryBudget fields:**
```
categoryId, monthlyLimit (đ), spent (đ), month (YYYY-MM)
```

**Computed methods (quan trọng):**
- `getSafeToSpend()` = `(totalCategoryLimits + carryOver) - totalSpent` — công thức đơn giản trong store
- `getCategoryRemaining(catId)` = `max(0, limit - spent)`
- `getCategoryProgress(catId)` = 0-100%
- `isOverBudget(catId)` — bool
- `getOverBudgetCategories()` — danh sách vượt ngưỡng
- `getSavingsPotential(catId, cutPercent)` = `spent × cutPercent`

**Logic tháng mới (Rollover) — `checkAndRollover()`:**
1. So sánh `currentMonth` vs tháng thực tế
2. Nếu tháng mới: grant `BUDGET_ON_TRACK` XP cho mỗi category đã đạt ngưỡng
3. Generate butler report (`generateButlerReport()`) cho tháng cũ
4. Append `MonthlySnapshot`, set `unviewedReportMonth`
5. Chuyển dư sang `carryOver`, reset spent → 0, chuyển month
6. Gọi `resetBillsPaid()` trên `useFinanceStore`

---

### 1.3 `useGoalsStore` — Mục tiêu dài hạn
**File:** `src/stores/useGoalsStore.ts`

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `goals[]` | `Goal[]` | Danh sách mục tiêu tài chính |

**Goal fields:**
```
id, name, icon, targetAmount, currentAmount, deadline, color,
milestones[], createdAt, deposits[]?, bankInfo?,
photoUrl?, whyNote?, lastCelebratedMilestone?
```

**Computed:**
- `getGoalProgress(id)` = `min(100, round(currentAmount/targetAmount × 100))`
- `getNextMilestone(id)` — milestone chưa hoàn thành đầu tiên
- `getTotalSaved()` = tổng `currentAmount` tất cả goals
- `getDeposits(id)` — lịch sử nạp (mới nhất lên đầu)

**Actions có side-effects:**
- `addFundsToGoal(id, amount)` → cập nhật `currentAmount` + append `deposits[]` + `awardXP(SAVINGS_DEPOSIT)`
- `completeMilestone(goalId, milestoneId)` → set `isCompleted: true`

**Seed data (demo):** 4 mục tiêu — Mua nhà (6 tỷ), Quỹ khẩn cấp (50 triệu), Xe ô tô (800 triệu), Vốn đầu tư (200 triệu).

---

### 1.4 `useTaskStore` — Nhiệm vụ kiếm tiền
**File:** `src/stores/useTaskStore.ts`

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `tasks[]` | `EarningTask[]` | Nhiệm vụ side-gig + subtask |
| `xpPenalties[]` | `XPPenalty[]` | Hình phạt XP khi task trễ hạn |

**EarningTask fields:**
```
id, name, description, expectedAmount, actualAmount?,
startDate, endDate, completedAt?, deletedAt?, deleteReason?,
subTasks[] (id, name, isCompleted, completedAt?)
```

**Task status logic (`getStatus(task)`):**
- `active` — chưa xong, trong hạn
- `overdue` — chưa xong, quá endDate
- `completed` — đã done

**Actions có side-effects:**
- `completeTask(id, actualAmount)` → set `completedAt`, giảm `remainingTasks` trên penalties, `awardXP(TASK_COMPLETE)` với daysEarly bonus
- `deleteOverdueTask(id, reason)` → set `deletedAt`, thêm penalty `{penaltyMultiplier: 0.7, remainingTasks: 3}`, `awardXP(TASK_OVERDUE)` = -15 XP

**XP Multiplier:** `getActiveXPMultiplier()` = min của tất cả penalty hiện hành. Áp dụng cho mọi XP positive về sau.

---

### 1.5 `useAuthStore` — User Profile & XP
**File:** `src/stores/useAuthStore.ts`

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `user` | `UserProfile \| null` | Profile đầy đủ |
| `firebaseUser` | `FirebaseUserMinimal \| null` | Firebase auth info |
| `isLoading` | `bool` | Trạng thái loading auth |
| `isAuthenticated` | `bool` | Đã đăng nhập chưa |

**UserProfile fields:**
```
uid, displayName, email, photoURL,
rank (iron/bronze/silver/gold/platinum/emerald/diamond),
xp, streak, lastActiveDate,
resistCount, totalResistSaved, lastResistAt, resistByDate{},
streakShields (0-3), shieldsUsedAt[],
isPremium, plan (free/pro), premiumExpiresAt,
accountStatus (active/banned/pending_deletion),
birthDate, birthTime, yearOfBirth,
createdAt, updatedAt
```

**`awardXP(action)` — single source of truth:**
1. Tính `baseXP = calculateXP(action)`
2. Lấy `multiplier = useTaskStore.getActiveXPMultiplier()`
3. Nếu XP > 0: `granted = round(baseXP × multiplier)`
4. Cập nhật `user.xp`, tính lại `rank = rankFromXP(newXP)`
5. Emit event → XPToastHost hiển thị toast

**`updateStreak()` — gọi mỗi lần log giao dịch:**
- gap = 1 ngày → streak + 1
- gap = 2 ngày + có shield → streak + 1, tiêu 1 shield
- gap > 2 → reset về 1
- Mốc 7-day → tặng shield (max 3 tích trữ)
- Grant `DAILY_STREAK` XP + `STREAK_BONUS` (500 XP) tại mốc 7-day

---

## 2. Tab: Nhập (nút giữa)

**Route:** `/input`  
**Component:** `TransactionInput` (`src/components/ui/TransactionInput.tsx`)

### 2.1 Form fields

| Field | UI | Kiểu | Ghi chú |
|-------|----|------|---------|
| Type | Tab buttons | `income / expense / transfer` | Default: expense (hoặc từ URL ?type=) |
| Wallet | Toggle | `main / emergency` | Dùng cho transfer |
| Amount | Number input | `number` (đ) | Max 12 chữ số |
| Category | Grid 4-col | `categoryId` | Ẩn khi type=transfer |
| Date | Date picker | `YYYY-MM-DD` | Max hôm nay, min 30 ngày trước |
| Note | Text input | `string` | Tùy chọn |

### 2.2 Flow xử lý khi submit

```
handleSubmit()
  → if expense && amount >= 3.000.000 → BreathGate modal (30s)
      → Confirm → processTransaction()
      → Resist (sau timer) → awardXP(RESIST_SPENDING) + dismiss
  → else → processTransaction() trực tiếp

processTransaction()
  1. addTransaction(type, amount, categoryId, note, wallet, date)
     → useFinanceStore: thêm vào transactions[], cập nhật balance
     → useFinanceCoreStore.execute(CREATE_INCOME / CREATE_EXPENSE) [mirror]
  2. awardXP(INCOME_LOGGED | EXPENSE_LOGGED)
     → awardXP → calculateXP → tính granted → update user.xp + rank
  3. Hiển thị CelebrationModal (dopamine popup)
  4. if income → sau khi đóng CelebrationModal → BillFundReminder
     → User chọn chia tiền → addSplitTransaction()
       → thêm transfer vào bill-fund + emergency
       → SplitSuccessPopup hiển thị kết quả chia
  5. if expense → Butler comment sarcastic
  6. Reset form
  7. Redirect → /ledger
```

### 2.3 Side effects quan trọng

- **Balance tự động cập nhật:** `addTransaction` tăng/giảm ví tương ứng
- **Budget spending track:** Khi expense, gọi `useBudgetStore.addSpending(categoryId, amount)` → cập nhật `spent` trong `categoryBudgets`
- **Streak update:** `updateStreak()` được gọi → có thể +streak, tiêu shield, grant XP streak
- **BreathGate:** Chi ≥ 3 triệu → bắt buộc đợi 30s. Nếu user resist → `RESIST_SPENDING` XP (x2 discipline bonus)

### 2.4 Danh mục (Categories)

- **Income:** `salary, freelance, investment, gift, other-income, ...` (từ `INCOME_CATEGORIES`)
- **Expense:** Custom từ `useCategoryStore` (user có thể thêm/sửa) + defaults `food, coffee, transport, shopping, entertainment, health, ...`

---

## 3. Tab: Tổng quan

**Route:** `/overview`  
**Component:** `OverviewContent` + 20+ sub-components

### 3.1 Block 0 — Sự kiện & Ngày lễ
- `SeasonalEventBanner` — banner theo sự kiện (Tết, lễ...) tự ẩn khi không active
- `UpcomingHolidayHint` — gợi ý ngày lễ âm lịch sắp tới

### 3.2 Block 1 — Safe-to-Spend Card ⭐ (quan trọng nhất)
**Component:** `SafeToSpendCard` dùng hook `useSafeBalance`

**Công thức:**
```
Số dư an toàn = Thu nhập tháng
              + Dư tháng trước (carryOver)
              − Ngưỡng chi tiêu (tổng categoryBudgets.monthlyLimit)
              − Bill cố định (tổng fixedBills.amount)
              − Tiết kiệm tháng (tổng goals contribution)
```

**Nguồn dữ liệu:**
| Thành phần | Lấy từ |
|-----------|--------|
| Thu nhập tháng | `useFinanceStore.getMonthlyIncome()` |
| Dư tháng trước | `useBudgetStore.carryOver` |
| Ngưỡng chi tiêu | `useBudgetStore.getTotalCategoryLimits()` |
| Bill cố định | `useFinanceStore.getTotalFixedBillsAmount()` |
| Tiết kiệm | `useGoalsStore.getTotalSaved()` hoặc tổng monthly contribution |

**Trạng thái hiển thị:**
- 🟢 An toàn: `safeToSpend > 1.000.000`
- 🟡 Cẩn thận: `0 < safeToSpend ≤ 1.000.000`
- 🔴 Nguy hiểm: `safeToSpend ≤ 0` (đang chi nhiều hơn thu)

### 3.3 Block 1b — Cảnh báo & Banners
- `PendingTransactionBanner` — giao dịch từ SMS webhook chờ xác nhận
- `BudgetWarningBanner` — khi ≥ 1 danh mục vượt ngưỡng
- `IdleMoneyBanner` — khi `mainBalance` cao bất thường, CTA chia vào mục tiêu

### 3.4 Block 2 — Layout 1-2-3

**IncomeBlock (full-width):**
- Dữ liệu: `useFinanceStore.transactions` (filter type=income)
- Toggle: Ngày / Tuần / Tháng / Năm
- Chart SVG: Cumulative income theo period (Catmull-Rom smooth line)
- Nút "Ngân hàng": mở `WalletBankModal` (link tài khoản ngân hàng)

**ExpenseBillBlock (chia 2):**
- Cột trái: Chi tiêu tháng = `getMonthlyExpense()`
- Cột phải: Bill cố định = danh sách `fixedBills` với status đã/chưa đóng
- Click vào bill → modal đóng bill → `payBill(billId)`

**FundsBlock (chia 3):**
- Ví chính: `mainBalance`
- Quỹ dự phòng: `emergencyBalance`
- Quỹ bill: `billFundBalance`

### 3.5 Block 3 — Gamification & Nhiệm vụ
- `OnboardingQuestPanel` — 7 bước tân thủ (tự ẩn khi hoàn thành hết)
- `DailyQuestCard` — 3 nhiệm vụ hàng ngày (ví dụ: "Ghi 1 chi tiêu", "Kiểm tra bill")
- `WeeklyChallengeCard` — thử thách tuần (xoay 4 theme)
- `MissionChecklist` — gói 3-bước tối ưu tài chính
- `WishlistPopup` — auto-popup khi cooling period hết (ức chế "muốn mua ngay")

### 3.6 Block 4 — Wellness & Báo cáo
- `WellnessCard` — text chữa lành theo giờ + nhóm tuổi (`resolveVibe + getCopy`)
- `MonthlyReportModal` — auto-show khi `unviewedReportMonth != null` (sau rollover)

**Dữ liệu cần cho Tổng quan:**
```
useFinanceStore: transactions, mainBalance, emergencyBalance, billFundBalance, fixedBills
useBudgetStore: carryOver, categoryBudgets, flaggedCategories, unviewedReportMonth
useGoalsStore: goals (để tính totalSaved / monthly contribution)
useAuthStore: user.xp, user.rank, user.streak, user.yearOfBirth
useSettingsStore: appVibe, butlerName
```

---

## 4. Tab: Sổ sách

**Route:** `/ledger`  
**Component:** `LedgerContent` + 5 sub-components

### 4.1 Header summary
- Thu nhập: `useFinanceStore.getTotalIncome()` (tổng tất cả, không lọc tháng)
- Chi tiêu: `useFinanceStore.getTotalExpense()` (tổng tất cả)

> ⚠️ **Vấn đề:** `getTotalIncome/Expense` tính toàn bộ lịch sử, không lọc theo tháng. Số này không khớp với Safe-to-Spend dùng `getMonthlyIncome`.

### 4.2 Tab "Giao dịch hàng ngày"
- **Dữ liệu:** `useFinanceStore.transactions`
- **Lọc:** All / Thu nhập / Chi tiêu + theo ngày (calendar)
- **Nhóm:** Theo `dateLabel` (Hôm nay, Hôm qua, dd/MM)
- **Calendar:** Mở date picker → lọc theo `dateKey`
- **Mỗi giao dịch:** click → `TransactionDetailSheet`

**TransactionDetailSheet:**
- Hiển thị: số tiền, danh mục, ghi chú, ngày giờ, ví
- Nút flag → `useBudgetStore.toggleTransactionFlag(txnId)`
- Giao dịch split: hiển thị breakdown (billFund, reserve, goals, investment)

**Flag indicators:**
- Giao dịch có `id` trong `flaggedTransactionIds` → hiển thị badge ⚠️
- Danh mục có `id` trong `flaggedCategories` → hiển thị badge riêng

### 4.3 Tab "Bill cố định"
- **Dữ liệu:** `useFinanceStore.fixedBills[]`
- **Hiển thị:** Tên, số tiền, ngày đến hạn, trạng thái (đã/chưa đóng)
- **Thêm bill:** `addBill({name, icon, amount, dueDay})`
- **Sửa/xóa:** `updateBill`, `removeBill`
- **Đóng bill:** `payBill(billId)` → set `isPaid: true`

### 4.4 BudgetSettingsModal
- Xem và chỉnh ngưỡng chi tiêu từng danh mục
- `setCategoryBudget(catId, limit)` → cập nhật `monthlyLimit`
- Hiển thị progress bar: `getCategoryProgress(catId)`
- Flag danh mục: `toggleCategoryFlag(catId)`

### 4.5 CategoryBreakdownPanel + CategoryDetailDrawer
- Tổng chi theo từng danh mục trong tháng
- Vẽ progress bar so với ngưỡng (`getCategoryProgress`)
- Click vào category → `CategoryDetailDrawer`:
  - Dùng `computeCategoryStats(allTxns, categoryId, monthKey)`:
    - `total`, `count`, `avgPerTxn`, `medianPerTxn`
    - `anomalies` (txn ≥ 2.5× avg, khi có ≥ 3 giao dịch)
    - `topTxns` (top 5 lớn nhất)
  - Gợi ý cắt giảm: `getSavingsPotential(catId, 0.2)` = tiết kiệm nếu cắt 20%

**Dữ liệu cần cho Sổ sách:**
```
useFinanceStore: transactions, fixedBills
useBudgetStore: categoryBudgets, flaggedCategories, flaggedTransactionIds
```

---

## 5. Tab: Mục tiêu

**Route:** `/goals`  
**Component:** `GoalsContent` + 9 sub-components

### 5.1 Tab "Mục tiêu lớn"

**Header summary:**
- Tổng đã tích lũy: `getTotalSaved()` = sum(`goal.currentAmount`)
- Tổng cần đạt: sum(`goal.targetAmount`)
- Progress bar tổng

**GoalCard (mỗi mục tiêu):**
| Thông tin | Tính như thế nào |
|-----------|-----------------|
| % hoàn thành | `getGoalProgress(id)` = `min(100, currentAmount/targetAmount × 100)` |
| Milestone kế tiếp | `getNextMilestone(id)` — milestone đầu tiên chưa done |
| At-risk warning | `calcUrgency(goal)` từ `src/lib/goalStats.ts` — nếu tốc độ tích lũy hiện tại không đủ đến deadline |
| Ngày còn lại | deadline - today |

**GoalDepositModal — nạp tiền vào mục tiêu:**
```
addFundsToGoal(id, amount, source, note)
  → goal.currentAmount += amount
  → goal.deposits[] .push(deposit)
  → awardXP(SAVINGS_DEPOSIT, amount)
     base = 20, bonus = floor(amount / 1.000.000) × 10, max bonus 100
     ví dụ: nạp 5.000.000 → 20 + 50 = 70 XP
```

**Milestone Confetti (tự động):**
- Mỗi render, kiểm tra `checkNewMilestone(goal)` → tính % hiện tại
- Nếu vừa vượt 25% / 50% / 75% / 100% → fireConfetti + play audio
- Set `lastCelebratedMilestone` để không trigger lại

**GoalDetailModal:**
- Lịch sử deposit `getDeposits(id)` (mới nhất lên đầu)
- Link ngân hàng `linkBankAccount(goalId, info)`
- Ảnh mục tiêu `setPhoto(goalId, dataUrl)` (compressed data URL)
- Lý do "tại sao" `setWhyNote(goalId, note)` — hiện khi user "yếu lòng"

**GoalCalendar:**
- Visualize lịch sử deposit theo ngày

**BankLinkModal:**
- Nhập thông tin tài khoản ngân hàng gợi ý khi `targetAmount > 100.000.000`

### 5.2 Tab "Wishlist"

**Component:** `WishlistPanel`
- Danh sách wishlist item với cooldown (ức chế mua ngay)
- Deep-link từ daily quest: `/goals?tab=wishlist`

**Anniversary memory bump:**
- `findAnniversaryDeposit(goal.deposits)` — tìm deposit cùng ngày năm trước
- Hiển thị banner nhắc nhớ

**Dữ liệu cần cho Mục tiêu:**
```
useGoalsStore: goals (currentAmount, targetAmount, milestones, deposits, bankInfo, photoUrl, whyNote)
useAuthStore: awardXP (khi nạp tiền)
```

---

## 6. Tab: Money

**Route:** `/money`  
**Component:** `MoneyContent` với 2 sub-tab: Money | CFO

### 6.1 Sub-tab: Money (nhiệm vụ kiếm tiền)

**Stats bar:**
| Stat | Tính như thế nào |
|------|-----------------|
| Đang làm | `tasks.filter(status === 'active').length` |
| Trễ hạn | `tasks.filter(status === 'overdue').length` |
| Hoàn thành | `tasks.filter(completedAt).length` |

**TaskCard (mỗi nhiệm vụ):**
- Tên, mô tả, dự kiến kiếm được, deadline
- Progress sub-tasks: done / total
- Status badge: `getStatus(task)` → active/overdue/completed
- Nút ✅ Hoàn thành → `completeTask(id, expectedAmount)`:
  - Tính `daysEarly = endDate - now` (ngày về sớm)
  - `awardXP(TASK_COMPLETE)` = max(20, floor(earnedAmount/500k) × 10 + daysEarly × 5)
  - fireConfetti
- Nút ❌ Xóa (khi overdue) → `TaskOverdueDialog` chọn lý do → `deleteOverdueTask`:
  - `awardXP(TASK_OVERDUE)` = -15 XP
  - Thêm penalty: 3 giao dịch XP tiếp theo nhân 0.7×

**TaskFormModal — thêm/sửa task:**
- Fields: tên, mô tả, số tiền dự kiến, ngày bắt đầu, ngày kết thúc, sub-tasks[]

**HallOfFame:**
- Hiển thị nhiệm vụ đã hoàn thành với `actualAmount`, `completedAt`

### 6.2 Sub-tab: CFO (AI phân tích)

**Dữ liệu đầu vào — `useCFOSnapshot()`:**
```typescript
payload = {
  totalIncome: getMonthlyIncome(),
  totalExpense: getMonthlyExpense(),
  savingsRate: (income - expense) / income × 100,
  transactions: getCurrentMonthTransactions().map(...)
}
cacheKey = `${monthKey}-${totalIncome}-${totalExpense}`
```

**useCFOReport hook:**
- Cache kết quả 24h theo `cacheKey`
- `fetchInsight(payload, {cacheKey, forceRefresh?})` → POST `/api/cfo`
- Auto-fetch khi `cacheKey` đổi (data tháng thay đổi)
- Nút Refresh → `fetchInsight(..., {forceRefresh: true})`

**CFOInsightCard:**
- Hiển thị: `summary`, `suggestions[]`, `healthScore` (0-100)
- Nút → mở `/report` (CFO Report đầy đủ)

**HealthScoreGauge:**
- Gauge 0-100, chia 3 zone: Nguy hiểm (<40) / Cẩn thận (40-70) / Tốt (>70)
- Source: `cfoInsight.healthScore`

**SavingsLineChart:**
- `useChartData()` → `savingsGrowth[]` — tiết kiệm tích lũy theo tuần
- Source: `useFinanceStore.transactions` filter type=transfer/income

**StackedBarChart:**
- `useChartData()` → `weeklyComparison[]` — so sánh income vs expense 4 tuần
- Source: `useFinanceStore.transactions`

**AI CFO Report (/report):**
- Route riêng: `/report`
- `CfoReportContent` — báo cáo editorial đầy đủ 3 section:
  - `## Tình hình` — tổng quan tháng
  - `## Vấn đề chính` — anomaly, vượt ngưỡng
  - `## Hành động đề xuất` — 3-5 hành động cụ thể

**Dữ liệu cần cho Money:**
```
useTaskStore: tasks, xpPenalties
useFinanceStore: transactions (monthly)
useAuthStore: user.xp (hiển thị XP bar)
API: POST /api/cfo (external Groq/OpenAI)
```

---

## 7. Gamification (XP Engine)

**File:** `src/lib/xpEngine.ts`

### 7.1 Bảng XP Actions

| Action | Công thức | Ghi chú |
|--------|-----------|---------|
| `INCOME_LOGGED` | 15 + min(floor(amount/1M)×5, 50) | Max 65 XP |
| `EXPENSE_LOGGED` | 10 cố định | Không scale theo amount |
| `RESIST_SPENDING` | (25 + min(floor(saved/500k)×10, 50)) × 2 | x2 Discipline Bonus |
| `DAILY_STREAK` | 10→15→20→30 theo mốc 7/14/30 ngày | |
| `STREAK_BONUS` | 500 cố định | Trigger tại mốc 7 ngày |
| `BUDGET_ON_TRACK` | 20 cố định | Grant/category khi rollover |
| `SAVINGS_DEPOSIT` | 20 + min(floor(amount/1M)×10, 100) | Max 120 XP |
| `TASK_COMPLETE` | max(20, floor(earned/500k)×10 + daysEarly×5) | Bonus hoàn thành sớm |
| `TASK_OVERDUE` | -15 cố định | XP âm, không nhân penalty |
| `MISSION_COMPLETE` | action.amount || 50 | |
| `WEBHOOK_CONFIRMED` | 10 cố định | SMS webhook |

### 7.2 Bảng Rank

| Rank | XP tối thiểu |
|------|-------------|
| Iron | 0 |
| Bronze | 500 |
| Silver | 2.000 |
| Gold | 5.000 |
| Platinum | 12.000 |
| Emerald | 25.000 |
| Diamond | 50.000 |

**Rank auto-update:** Mỗi lần `awardXP`, rank tính lại = `rankFromXP(newXP)`.

### 7.3 Penalty Multiplier

Khi `deleteOverdueTask` → thêm `{penaltyMultiplier: 0.7, remainingTasks: 3}`.  
3 hành động XP tiếp theo bị nhân 0.7×.  
Nhiều penalty chồng nhau → lấy `min` của tất cả.  
Penalty tự xóa khi `remainingTasks` về 0.

### 7.4 Streak Shield

- Tích trữ tối đa 3 shield
- Mốc 7-day streak → tặng 1 shield (nếu chưa đủ 3)
- Quên 1 ngày nhưng còn shield → streak không bị reset, tiêu 1 shield

---

## 8. AI Chat (/chat)

**Route:** `/chat`  
**Backend:** `POST /api/chat`  
**Persona:** Lord Diamond — CFO cá nhân

### 8.1 Kiến trúc Hybrid

```
User gõ tin nhắn
  → classifyIntent(text) — 4-tier rule-based (0 LLM token)
  → Deterministic (0 token): QUERY_BALANCE / BILL / TASKS / SPENDING / SAVINGS / SAFE_TO_SPEND / GOALS
  → LLM (tốn token): CFO_REPORT / ANALYZE_FINANCE / ADVICE_CUT_SPENDING
  → FOLLOW_UP: reuse session snapshot, không re-query
  → LOG_TRANSACTION: handle local (không qua /api/chat)
```

### 8.2 ClientSnapshot — dữ liệu gửi lên server

```typescript
buildClientSnapshot() đóng gói từ Zustand:
  wallets: { main, emergency, billFund }
  transactions: [{ type, amount, categoryId, toWallet }]  // tháng hiện tại
  history: [3 tháng gần nhất, grouped by categoryId]
  budgets: [{ categoryId, name, limit }]
  bills: [{ id, name, amount, dueDay, isPaid }]
  goals: [{ id, name, targetAmount, savedAmount, deadline, monthlyContribution }]
  tasks: [{ id, name, expectedAmount, endDate, isCompleted }]
```

### 8.3 Intent Types & Handler

| Intent | Trigger | Handler |
|--------|---------|---------|
| `LOG_TRANSACTION` | regex số tiền + action word | Local (TransactionInput UI) |
| `QUERY_BALANCE` | "còn bao nhiêu tiền", "số dư" | `handleQueryBalance` → 3 ví + tổng |
| `QUERY_BILL_STATUS` | "bill", "hóa đơn", "chưa đóng" | `handleQueryBill` → danh sách + tổng chưa trả |
| `QUERY_TASKS_TODAY` | "task", "nhiệm vụ", "công việc" | `handleQueryTasks` → active/pending/overdue |
| `QUERY_SPENDING` | "chi tiêu", "đã chi", "hôm nay chi" | `handleQuerySpending` → tổng chi + top 3 danh mục |
| `QUERY_SAVINGS` | "tiết kiệm", "tích lũy" | `handleQuerySavings` → tiết kiệm + tỷ lệ % + quỹ |
| `QUERY_SAFE_TO_SPEND` | "còn bao nhiêu để xài", "safe to spend" | `handleQuerySafeToSpend` → số dư an toàn + cảnh báo lố |
| `QUERY_GOAL_PROGRESS` | "mục tiêu", "tới đâu rồi" | `handleQueryGoals` → tiến độ + at-risk |
| `CFO_REPORT` | "phân tích", "báo cáo CFO", "tình hình" | `handleCFOReport` → LLM Lord Diamond (8 credits/lần) |
| `ANALYZE_FINANCE` | "cố vấn", "nhận xét" | `handleCFOReport` |
| `ADVICE_CUT_SPENDING` | "cắt giảm", "tiết kiệm hơn" | `handleCFOReport` |
| `FOLLOW_UP` | "tại sao", "vì sao", "nó", "đó" | `handleFollowUp` → reuse session snapshot |

### 8.4 Conversation State

- In-memory `Map` trên `globalThis` (singleton qua hot-reload)
- TTL: 30 phút per session
- Max 8 turns
- Snapshot gắn vào session → FOLLOW_UP không re-aggregate DB

---

## 9. Sơ đồ liên kết tổng thể

```
┌──────────────────────────────────────────────────────────────────┐
│                        useFinanceStore                           │
│  transactions[] ←── addTransaction() ←── Tab NHẬP               │
│  mainBalance, emergencyBalance, billFundBalance                  │
│  fixedBills[] ←── addBill/payBill ←── Tab SỔ SÁCH               │
│                                                                  │
│  Đọc bởi: TỔng QUAN (balances), SỔ SÁCH (txns), MONEY (chart)   │
│           CHAT (clientSnapshot), CFO API (monthly stats)         │
└──────────────────────────────────────────────────────────────────┘
           ↓ addSpending(catId, amount)
┌──────────────────────────────────────────────────────────────────┐
│                        useBudgetStore                            │
│  categoryBudgets[] — monthlyLimit, spent                         │
│  carryOver ←── checkAndRollover() ←── RolloverGuard (app layout) │
│  flaggedCategories[], flaggedTransactionIds[]                    │
│  monthlySnapshots[], unviewedReportMonth                         │
│                                                                  │
│  Đọc bởi: TỔNG QUAN (safe-to-spend, warning), SỔ SÁCH (budget)  │
│           CHAT (budgets trong clientSnapshot)                    │
└──────────────────────────────────────────────────────────────────┘
           ↓ award XP on rollover (BUDGET_ON_TRACK)
┌──────────────────────────────────────────────────────────────────┐
│                         useAuthStore                             │
│  user.xp, user.rank, user.streak, user.streakShields             │
│  awardXP() ←── gọi từ TẤT CẢ actions có XP                      │
│  updateStreak() ←── NHẬP giao dịch                               │
│                                                                  │
│  Đọc bởi: TỔNG QUAN (rank/xp/streak), MONEY (xp bar)            │
│           NHẬP (xpAction), SỔ SÁCH (rank badge)                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        useGoalsStore                             │
│  goals[] — currentAmount, deposits[], milestones[]               │
│  addFundsToGoal() ←── Tab MỤC TIÊU (deposit modal)              │
│  addFundsToGoal() ←── NHẬP income → BillFundReminder → split     │
│                                                                  │
│  Đọc bởi: TỔNG QUAN (totalSaved → safe-to-spend)                │
│           CHAT (goals trong clientSnapshot)                      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        useTaskStore                              │
│  tasks[], xpPenalties[]                                          │
│  completeTask() → awardXP(TASK_COMPLETE)                        │
│  deleteOverdueTask() → awardXP(TASK_OVERDUE) + add penalty       │
│                                                                  │
│  Đọc bởi: MONEY (task cards), CHAT (tasks trong clientSnapshot)  │
│  Ảnh hưởng XP multiplier → áp dụng cho NHẬP (income/expense XP) │
└──────────────────────────────────────────────────────────────────┘

                    External AI Layer
┌──────────────────────────────────────────────────────────────────┐
│  POST /api/chat (OpenAI GPT-4o-mini + Groq fallback)             │
│    ← clientSnapshot từ Zustand (buildClientSnapshot)             │
│    → deterministic reply (0 token) hoặc Lord Diamond (LLM)       │
│                                                                  │
│  POST /api/cfo (Groq llama-3.3-70b)                              │
│    ← {transactions, totalIncome, totalExpense, savingsRate}       │
│    → {summary, suggestions, healthScore}                          │
└──────────────────────────────────────────────────────────────────┘
```

### Data flow chính (khi user nhập giao dịch):

```
User nhập thu nhập 15.000.000đ → Submit
  ↓
useFinanceStore.addTransaction()
  → transactions[] +1
  → mainBalance + 15.000.000
  ↓
useFinanceCoreStore.execute(CREATE_INCOME) [mirror]
  ↓
useAuthStore.awardXP(INCOME_LOGGED)
  → xp += 15 + min(floor(15M/1M)×5, 50) = 15 + 50 = 65 XP
  → rank tính lại
  → emit XPToastHost → toast "+65 XP"
  ↓
useAuthStore.updateStreak()
  → streak + 1 hoặc tiêu shield
  → awardXP(DAILY_STREAK)
  ↓
CelebrationModal → dopamine popup "Thu nhập +15.000.000đ | +65 XP"
  ↓ đóng modal
BillFundReminder → "Bạn có muốn chia quỹ bill không?"
  → Confirm → addSplitTransaction()
    → billFundBalance + X
    → emergencyBalance + Y
  ↓
Redirect → /ledger
  ↓ (ngay lập tức re-render do Zustand)
LedgerContent hiển thị giao dịch mới đầu danh sách
  ↓
OverviewContent cập nhật:
  → SafeToSpendCard: số dư an toàn mới
  → IncomeBlock: total income mới
```

---

## 10. Vấn đề & Điểm chưa kết nối

### 10.1 Inconsistency dữ liệu tổng quan vs sổ sách

| UI | Hàm dùng | Vấn đề |
|----|---------|--------|
| Sổ sách header "Thu nhập" | `getTotalIncome()` | Tổng toàn lịch sử |
| Safe-to-Spend "Thu nhập tháng" | `getMonthlyIncome()` | Chỉ tháng hiện tại |
| CFO API payload | `getMonthlyIncome()` | Chỉ tháng hiện tại |

→ Sổ sách hiển thị số **không khớp** với số dư an toàn và AI.

### 10.2 Budget spending không sync với actual transactions

`useBudgetStore.categoryBudgets[].spent` được cập nhật qua `addSpending()` khi nhập giao dịch, nhưng **không recompute** từ `transactions[]`. Nếu user xóa giao dịch (tính năng chưa có), `spent` sẽ không giảm.

### 10.3 QUERY_SPENDING trong AI chat trả tháng, không phải ngày

`handleQuerySpending` trả tổng chi **cả tháng** dù user hỏi "hôm nay". Lý do: `clientSnapshot.transactions` không gửi trường `date` lên server.

**Fix đề xuất:** Thêm `date: string` vào `ClientSnapshotInput.transactions`, filter trong handler theo `dateKey === today`.

### 10.4 Quỹ goals không tự động tính vào safe-to-spend

`SafeToSpendCard` trừ "tiết kiệm" nhưng dùng `goal.monthlyContribution` (nếu có) hoặc tổng `currentAmount` — không nhất quán. Chưa có trường `monthlyContribution` explicit trong `Goal` type của `useGoalsStore`.

### 10.5 Firebase persistence chưa hoàn chỉnh

Toàn bộ state là in-memory Zustand. Khi user reload → mất hết, quay về seed data. **Chưa có Firestore sync** cho transactions, goals, tasks trong môi trường demo.

### 10.6 AI CFO chỉ available cho Pro (8 credits/lần)

Free user nhận "nâng cấp Pro" khi yêu cầu CFO report. Để test: tăng `AI_MONEY_CHAT_FREE_MONTHLY_CREDITS` trong env.

---

*Tài liệu này được tạo tự động từ phân tích codebase ngày 2026-06-08. Cập nhật khi có thay đổi lớn về store schema hoặc UI logic.*
