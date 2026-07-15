# 🏦 ManiCash — Báo Cáo Kỹ Thuật Toàn Diện

> **Phiên bản gộp** · Backend · Chat · Tính năng · Gamification · CFO · Bugs · Roadmap  
> Tháng 6/2026 · Vietnamese Personal Finance App  
> *Next.js 16 · React 19 · TypeScript · Firebase · Zustand · Groq / OpenAI*

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Tính năng Chat — Đã & Chưa liên kết](#2-tính-năng-chat--đã--chưa-liên-kết)
3. [5 Trang chính và trang phụ](#3-5-trang-chính-và-trang-phụ)
4. [Hệ thống nhiệm vụ](#4-hệ-thống-nhiệm-vụ)
5. [Gamification & Cơ chế dopamine](#5-gamification--cơ-chế-dopamine)
6. [Cơ chế Báo cáo CFO](#6-cơ-chế-báo-cáo-cfo)
7. [Bugs & Vấn đề kỹ thuật](#7-bugs--vấn-đề-kỹ-thuật)
8. [Điểm mù (Blind Spots)](#8-điểm-mù-blind-spots)
9. [Road map nâng cấp Chat](#9-road-map-nâng-cấp-chat)
10. [Hướng dẫn cài đặt API Keys](#10-hướng-dẫn-cài-đặt-api-keys)
11. [Bảng trạng thái tất cả tính năng](#11-bảng-trạng-thái-tất-cả-tính-năng)
12. [Tóm tắt nhanh](#12-tóm-tắt-nhanh)

---

# 1. Tổng quan kiến trúc

ManiCash là ứng dụng quản lý tài chính cá nhân tiếng Việt kèm gamification.  
**Stack:** Next.js 16 App Router · React 19 · TypeScript · Firebase (Auth + Firestore) · Zustand · Tailwind CSS v4.

## 1.1 Luồng dữ liệu chính

```
Client (Zustand stores)
  ↓ buildClientSnapshot()
clientSnapshot JSON
  ↓ POST /api/chat
Server: routeIntent() → 22 intent handlers
  ↓ getFinanceSnapshot() → buildFromClient() / Firestore fallback
MonthlyFinancialSnapshot (validated)
  ↓ buildCFOContextPack()
CFOContextPackV1 (tất cả số do moneyBrain tính)
  ↓ generateLLMResponse()  [chỉ khi cần AI]
Groq / OpenAI  →  text diễn giải (không tự bịa số)
  ↓
ChatReply { message, ui.kind, actionRequest? }
```

**Nguyên tắc cốt lõi:** LLM chỉ nhận JSON đã tính sẵn, chỉ sinh text diễn giải — không tự tính toán con số tài chính.

## 1.2 Các Zustand stores chính

| Store | Quản lý |
|---|---|
| `useFinanceStore` | Giao dịch, 3 ví (Chính / Dự phòng / Quỹ hóa đơn), fixed bills |
| `useBudgetStore` | Ngân sách danh mục tháng, carryover, safe-to-spend |
| `useGoalsStore` | Mục tiêu lớn + milestones + deposits |
| `useTaskStore` | Earning tasks + sub-tasks + XP penalties |
| `useQuestStore` | Onboarding / Daily / Weekly / Seasonal quests |
| `useMissionStore` | Legacy 3-mission checklist (backward compat) |
| `useAuthStore` | Firebase user + UserProfile (rank, XP, streak) |
| `useWishlistStore` | Wishlist items + cooling period |
| `useRewardStore` | Cosmetic rewards + unlock state |
| `useAiMoneyMemoryStore` | Long-term profile từ [profile: ...] LLM tags |

## 1.3 Các API Endpoints

| Endpoint | Vai trò | Ghi chú |
|---|---|---|
| `/api/chat` | Chat gateway chính | routeIntent → dispatch → 22 handlers. Phase 2–5 hoàn chỉnh |
| `/api/cfo` | CFO legacy | Vẫn chạy cho CFOInsightCard. 2 path: snapshot mới (moneyBrain) + legacy |
| `/api/ai-money-chat/parse` | AI Fallback Parse | Groq phân loại giao dịch thấp confidence. Cần `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true` |
| `/api/ai-money-chat/cfo-narration` | CFO Narration | Groq sinh narration cho CFOInsightCard. Có fingerprint cache Firestore |
| `/api/auth/session` | Session check | Xác minh Firebase session cookie |
| `/api/sms-webhook` | SMS Banking | Nhận SMS → parse giao dịch auto (ACB, MB, VCB, TPBank, VPBank, Techcombank, Sacombank) |
| `/api/billing/verify` | Billing | Xác minh thanh toán, cấp quyền Pro |
| `/api/account/deletion` | Xóa tài khoản | Soft delete + cron dọn dẹp sau 30 ngày |
| `/api/admin/bans` | Admin | Quản lý ban user |

## 1.4 Route Groups

```
(auth)/login          — Google OAuth login
(app)/overview        — Dashboard tổng quan
(app)/input           — Nhập giao dịch thủ công
(app)/ledger          — Sổ sách giao dịch
(app)/goals           — Mục tiêu + Wishlist
(app)/money           — Earning Tasks + CFO tab
(app)/chat            — AI Chat (Lord Diamond)
(app)/report          — Báo cáo CFO đầy đủ
(app)/profile         — Hồ sơ người dùng
(app)/settings        — Cài đặt
(app)/upgrade         — Nâng cấp Pro
admin/                — Dashboard quản trị
```

---

# 2. Tính năng Chat — Đã & Chưa liên kết

Trang Chat (`/chat`) là trung tâm thần kinh của app — nhập liệu NLP, truy vấn số liệu, ra lệnh AI và nhận báo cáo CFO.

## 2.1 Các tính năng ĐÃ liên kết

### A. Nhập giao dịch (LOG_TRANSACTION)

*Xử lý: Client-side `parseInput()` → DraftCard confirm UI — hoàn toàn offline*

- Nhập: `"mua trà sữa 50k"` → phân tích cú pháp → card xác nhận (danh mục, số tiền, loại)
- Xác nhận → `useFinanceStore` → Firestore sync → XP award (EXPENSE_LOGGED +10, INCOME_LOGGED +15–65)
- Fallback AI parse (Groq) khi confidence thấp, cần `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true`
- Pipeline: `parseInput()` → `parseMoneyText()` → `applyMemoryToIntent()` → AI fallback → DraftCard → `handleConfirmDraft()`

### B. Truy vấn số dư & ví (QUERY_BALANCE / QUERY_WALLET)

- `"Tôi còn bao nhiêu tiền?"` → số dư 3 ví từ clientSnapshot
- `"Quỹ dự phòng của tôi"` → thông tin cụ thể từng ví
- Hoàn toàn deterministic — không cần AI, không gọi Firestore

### C. Hỏi về hóa đơn (QUERY_BILLS)

- `"Tiền điện đóng chưa?"` → kiểm tra `fixedBills` trong snapshot
- `"Hóa đơn nào sắp đến hạn?"` → lọc theo `dueDate` gần nhất

### D. Lệnh hành động Phase 4A (ACTION_REQUEST)

*Server tạo `actionRequest` → client confirm → execute với undo 30 giây*

- `"Chuyển 500k vào quỹ dự phòng"` → tạo transfer transaction + trừ ví chính
- `"Đặt ngân sách ăn uống 3 triệu"` → cập nhật `categoryBudgets`
- Full undo: `handleUndo()` khôi phục state chính xác

### E. Lên kế hoạch earning task (PLAN_EARNING_TASK)

- `"Tôi muốn freelance thiết kế"` → chat hỏi chi tiết → tạo `EarningTask` + sub-tasks
- Kết nối với `useTaskStore.addTask()`

### F. Báo cáo CFO (CFO_REPORT) — cần API key

- Phân tích toàn diện: healthScore, cashflow, categories, goals, tasks, anomalies
- Output: 3-part markdown (## Tình hình / ## Vấn đề chính / ## Hành động đề xuất)
- Quota: free 3 CFO/tháng, Pro unlimited
- Fallback deterministic khi không có API key

### G. Phân tích & tư vấn (ANALYZE_FINANCE / ADVICE_CUT_SPENDING / ADVICE_INCOME)

- `"Tôi tiêu nhiều nhất vào gì?"` → phân tích categories từ snapshot
- `"Làm sao cắt giảm?"` → gợi ý dựa trên cutSimulation 10/20/30%
- `"Cách kiếm thêm tiền?"` → đề xuất dựa trên earning tasks

### H. Follow-up hội thoại (FOLLOW_UP) — cần API key

- Session TTL 30 phút, MAX_TURNS = 8
- Nhớ context trong session (lịch sử hội thoại)
- Lord Diamond nhận `[profile: ...]` → lưu vào `useAiMoneyMemoryStore`
- Không cần gửi lại snapshot cho follow-up

### I. Quick chips báo cáo nhanh

| Chip | Hành động |
|---|---|
| Nhập thủ công | Mở form transaction thủ công |
| Báo cáo trưa | Snapshot chi tiêu buổi sáng |
| Tổng kết tối | Tóm tắt ngày, so sánh ngân sách |
| Đối chiếu số dư | `reconciliationForm` nhập số dư ngân hàng thực |
| Lịch sử thao tác | Danh sách action log gần đây |

## 2.2 Các tính năng CHƯA liên kết

| Tính năng | Vấn đề | Hướng bổ sung |
|---|---|---|
| Rank / XP query | Không có intent QUERY_RANK | Thêm intent + đọc từ `useAuthStore` |
| Quest system | `useQuestStore` chưa vào clientSnapshot | Thêm `activeQuests` vào snapshot |
| Wishlist | `useWishlistStore` chưa vào snapshot | Thêm `wishlistItems` vào snapshot |
| Rewards / Cosmetics | `useRewardStore` ngoài tầm chat | Cần intent QUERY_REWARDS |
| SMS Webhook | Tách biệt hoàn toàn với chat | Thêm `pendingWebhookTxns` vào snapshot |
| MoneySync | Không tương tác được qua chat | Cần intent SYNC_NOW |
| History tháng trước | Chỉ có aggregate, không có txn cụ thể | Thêm API lấy history theo tháng |
| Export CSV | Chỉ có trên /report page | Thêm intent EXPORT_REPORT |

---

# 3. 5 Trang chính và trang phụ

## 3.1 Overview (`/overview`) — Tổng quan tài chính

Dashboard chính, layout **1-2-3**: IncomeBlock → ExpenseBillBlock → FundsBlock.

| Khối | Mô tả |
|---|---|
| `SafeToSpendCard` | Số tiền có thể tiêu hôm nay. Tính: Budget − Chi − HĐ đến hạn |
| `IncomeBlock` | Thu nhập tháng, top 3 nguồn |
| `ExpenseBillBlock` | Chi tiêu vs hóa đơn cố định. Chia 2 cột |
| `FundsBlock` | Ba quỹ: Chính / Dự phòng / Hóa đơn. Chia 3 |
| `BudgetWarningBanner` | Cảnh báo khi chi tiêu vượt ngưỡng category |
| `PendingTransactionBanner` | Pending tx từ SMS webhook chờ confirm |
| `IdleMoneyBanner` | Cảnh báo tiền nhàn rỗi, gợi ý chuyển vào Goals |
| `WishlistPopup` | Xuất hiện sau 7 ngày cooling: "Bạn còn muốn mua không?" |
| `SeasonalEventBanner` | Banner sự kiện mùa (Hè 2026 đang active) |
| `UpcomingHolidayHint` | Gợi ý tiết kiệm cho dịp lễ gần nhất |
| `OnboardingQuestPanel` | 7 nhiệm vụ tân thủ gated (tự ẩn khi hoàn thành) |
| `DailyQuestCard` | 3 nhiệm vụ hàng ngày reset 0h |
| `WeeklyChallengeCard` | Thử thách 7 ngày xoay vòng 4 theme |
| `MissionChecklist` | Legacy 3-mission (backward compat) |
| `WellnessCard` | Tin nhắn theo giờ trong ngày + age-group vibe |
| `MonthlyReportModal` | Auto-popup báo cáo tháng từ Lord Diamond |
| `BankSyncReminder` | Nhắc cài SMS webhook (feature flag) |

**Trang phụ:** `/profile` · `/settings` · `/upgrade` · `/admin`

## 3.2 Input (`/input`) — Nhập giao dịch

Wrapper quanh `TransactionInput`:

- Tab: chi tiêu / thu nhập / chuyển quỹ
- Chọn danh mục từ grid (30+ expense, 10+ income)
- Split Transaction: 1 khoản chia nhiều danh mục
- AI fallback parse: câu nhập mập mờ → Groq phân loại
- XP fire sau confirm
- Deep-link từ quest: `/input?type=expense` / `/input?type=income`

## 3.3 Ledger (`/ledger`) — Sổ sách

3 tab:

**Tab Chi tiêu (Daily)**
- Giao dịch nhóm theo ngày, bộ lọc Thu/Chi/Tất cả + Calendar filter
- Tap → `TransactionDetailSheet` (xem, sửa, xóa)
- Flagged transactions: highlight vàng giao dịch bất thường

**Tab Danh mục (CategoryBreakdownPanel)**
- Thanh tiến độ từng category so với ngân sách tháng
- Color-coded: xanh (an toàn) → vàng (cảnh báo) → đỏ (vượt ngưỡng)
- `BudgetSettingsModal`: đặt monthly limit theo category

**Tab Bill cố định (FixedBillsPanel)**
- Recurring bills với status Đã trả / Chưa trả
- Xác nhận thanh toán → cập nhật `paidMonths`

## 3.4 Goals (`/goals`) — Mục tiêu & Wishlist

**Tab Mục tiêu lớn**
- Tổng tích lũy / tổng target, thanh tiến độ gradient
- `GoalCard`: tên, icon, số tiền, deadline, progress, milestones
- `GoalDepositModal`: nạp tiền → SAVINGS_DEPOSIT XP
- `GoalDetailModal`: lịch sử deposits
- Confetti + âm thanh khi đạt 25/50/75/100%
- Memory bump: "Cùng ngày này năm trước bạn đã nạp X"

**Tab Wishlist**
- Add item với cooling period (7/14/30 ngày)
- Trong cooling: locked, đếm ngược
- Sau cooling: `WishlistPopup` "Bạn còn muốn không?"
- Resist → RESIST_SPENDING XP (tính theo saved amount)
- Purchase → tạo transaction expense tự động
- Deep-link: `/goals?tab=wishlist`

## 3.5 Money (`/money`) — Earning Tasks & CFO

**Tab Money**
- Stats: Active / Completed / Overdue
- `TaskCard`: tên, amount, deadline, sub-task progress
- Complete → nhập actual amount → TASK_COMPLETE XP + confetti
- Overdue → chọn lý do (không phù hợp / hoãn / đổi kế hoạch)
- `HallOfFame`: top 3 completed tasks cao nhất
- Charts: `StackedBarChart` (4 tuần) + `SavingsLineChart` (6 tháng)

**Tab CFO**
- `CFOInsightCard`: summary AI, healthScore, suggestions
- `HealthScoreGauge`: gauge 0–100 (đỏ→vàng→xanh)
- Auto-fetch khi data thay đổi (cacheKey tracking)

**Trang phụ `/report`**
- CFO Report đầy đủ: health gauge lớn, top 5 categories, budget stats
- AI narration từ `/api/ai-money-chat/cfo-narration` (fingerprint cache)
- Export CSV: `buildMonthlyReportCsv()` → tải file .csv

---

# 4. Hệ thống nhiệm vụ

ManiCash có **4 lớp nhiệm vụ** phục vụ mục tiêu tâm lý khác nhau.

## 4.1 Earning Tasks (useTaskStore)

**Vòng đời:**

| Trạng thái | Điều kiện |
|---|---|
| `pending` | `startDate > now` |
| `active` | `startDate ≤ now ≤ endDate` |
| `overdue` | `now > endDate` và chưa completed |
| `completed` | `completedAt` có giá trị |

**XP Formula:**
- TASK_COMPLETE: `max(20, floor(earnedAmount/500k)×10 + daysEarly×5)`
- Ví dụ: 3tr, xong sớm 2 ngày → `max(20, 6×10 + 2×5) = 70 XP`
- TASK_OVERDUE: `-15 XP`
- Penalty multiplier: task trễ → 3 task tiếp theo nhận 70% XP

**Sub-task system:**
- Mỗi task có 1–6 sub-tasks với checkbox + timestamp
- `completeTask()` tự tick tất cả sub-tasks
- `undoCompleteTask()` khôi phục chính xác state trước đó

**5 Seed Tasks mặc định (demo):**

| Task | Expected | Status |
|---|---|---|
| Freelance thiết kế logo | 3,000,000đ | active (2/5 sub-tasks) |
| Bán hàng online Shopee | 1,500,000đ | pending |
| Dạy kèm tiếng Anh | 2,000,000đ | overdue |
| Viết bài blog công nghệ | 800,000đ | completed |
| Chụp ảnh sự kiện | 5,000,000đ | pending |

## 4.2 Onboarding Quests (7 bước gated)

Quest N+1 chỉ mở khi quest N hoàn thành. Tự ẩn khi hoàn thành hết 7 quest.

| # | Quest | Metric | Target | XP | Reward |
|---|---|---|---|---|---|
| 1 | Giới thiệu bản thân | `profile_completed` | ≥ 1 | 30 | title-newbie |
| 2 | Lần đầu ghi chi tiêu | `expense_logged_count` | ≥ 1 | 25 | — |
| 3 | Ghi khoản thu nhập | `income_logged_count` | ≥ 1 | 25 | sound-coin |
| 4 | Thêm vào Wishlist | `wishlist_count` | ≥ 1 | 30 | — |
| 5 | Đặt mục tiêu lớn | `goal_created` | ≥ 1 | 40 | — |
| 6 | Tạo earning task | `earning_task_created` | ≥ 1 | 50 | effect-sparkle |
| 7 | Điểm danh 3 ngày | `app_open_days` | ≥ 3 | 80 | zodiac-ty |

## 4.3 Daily Quests (3/ngày — reset 0h)

3 quest random từ pool 10+ template, seed theo ngày (cùng ngày = cùng kết quả).

| Quest | Metric | XP |
|---|---|---|
| Ghi 2 chi tiêu hôm nay | `expense_today ≥ 2` | 30 |
| Ghi 1 thu nhập | `income_today ≥ 1` | 25 |
| Điểm danh hôm nay | `streak_advanced ≥ 1` | 15 |
| Kiểm tra Safe-to-Spend | `overview_opened ≥ 1` | 10 |
| Mở Wishlist | `wishlist_viewed ≥ 1` | 15 |
| Ghi 3 giao dịch bất kỳ | `transactions_today ≥ 3` | 40 |
| Kiềm chế 1 lần | `resist_today ≥ 1` | 35 |
| Hoàn thành 1 sub-task | `subtask_today ≥ 1` | 20 |
| Xem tab Danh mục | `budget_viewed ≥ 1` | 10 |
| Duy trì streak | `streak_advanced ≥ 1` | 20 |

## 4.4 Weekly Challenges (xoay vòng 4 theme)

Target tính động theo % thu nhập tháng trước.

| Tuần %4 | Theme | Metric | Target | XP |
|---|---|---|---|---|
| 0 | 🛡️ Tiết Kiệm | `saved_this_week` | 5% income (min 500k, max 5M) | 300 |
| 1 | 🧊 Kiềm Chế | `resist_count_this_week` | 3–7 lần | 250 |
| 2 | ⚒️ Kiếm Thêm | `tasks_completed_this_week` | 1–2 task | 400 |
| 3 | 🛍️ Wishlist | `wishlist_rejected_this_week` | 2–3 lần từ chối | 200 |

## 4.5 Seasonal Events

Sự kiện có thời gian, 3–6 chương tuyến tính, mở khóa cosmetic limited.  
**Event active: Hè Vàng 2026 (01/05 – 31/08/2026)**

| Chương | Tên | Metric | Target | XP + Reward |
|---|---|---|---|---|
| C1 | Khởi động hè | `event_app_days` | 5 ngày | 150 + theme-emerald |
| C2 | Cày Hè | `event_task_completed` | 2 tasks | 200 + effect-lightning |
| C3 | Tiết Kiệm Mùa Nóng | `event_saved` | 2,000,000đ | 250 |
| C4 | Chiến Binh Kiềm Chế | `event_resist` | 5 lần | 300 + title-summer-warrior |
| Final | Hoàn thành hè | Tất cả chương | — | theme-summer-gold (limited) |

## 4.6 Legacy Mission Checklist (useMissionStore)

- 3 mission ID cố định, tick qua checkbox trên Overview
- `completeMission()`: idempotent — grant XP chỉ 1 lần (MISSION_COMPLETE +50)
- Không persist qua reload (in-memory, không dùng zustand persist)

---

# 5. Gamification & Cơ chế dopamine

7 kỹ thuật gamification song song, thiết kế có chủ ý tạo vòng lặp tài chính tích cực.

## 5.1 XP & Rank — Tiến trình rõ ràng

| Hành động | XP | Ghi chú |
|---|---|---|
| INCOME_LOGGED | +15 đến +65 | 15 base + min(floor(amount/1M)×5, 50) |
| EXPENSE_LOGGED | +10 | Cố định — khuyến khích ghi đều mọi ngày |
| RESIST_SPENDING | +50 đến +150 | (25 + min(saved/500k×10, 50)) × 2 |
| SAVINGS_DEPOSIT | +20 đến +120 | 20 + min(amount/1M×10, 100) |
| TASK_COMPLETE | +20 đến +100+ | max(20, earned/500k×10 + daysEarly×5) |
| DAILY_STREAK 7 ngày | +10 | Streak cơ bản |
| DAILY_STREAK 14 ngày | +15 | |
| DAILY_STREAK 30 ngày | +20 | |
| STREAK_BONUS ×7 ngày | +500 | Milestone bội số 7 — shock reward |
| BUDGET_ON_TRACK | +20 | Category đang kiểm soát |
| MISSION_COMPLETE | +50 | Legacy checklist |
| WEBHOOK_CONFIRMED | +10 | Xác nhận SMS ngân hàng |
| TASK_OVERDUE | **-15** | Penalty duy nhất trong hệ thống |

**7 Bậc Rank:**

| Rank | Icon | XP yêu cầu | Perk |
|---|---|---|---|
| Sắt | 🗡️ | 0 | Tất cả tính năng cơ bản |
| Đồng | 🥉 | 500 | Khóa học "Quản lý chi tiêu 101" |
| Bạc | 🥈 | 2,000 | Khóa học "Tư duy tiết kiệm" |
| Vàng | 🥇 | 5,000 | Khóa học "Đầu tư cơ bản" + AI CFO nâng cao |
| Bạch Kim | 💎 | 12,000 | Khóa học "Chiến lược thu nhập thụ động" |
| Lục Bảo | 🟢 | 25,000 | Khóa học "Xây dựng mạng lưới kinh doanh" |
| Kim Cương | 💠 | 50,000 | MỞ KHÓA TẤT CẢ khóa học đầu tư cao cấp |

## 5.2 Variable Reward — Phần thưởng biến đổi

- Daily Quests random mỗi ngày từ pool → não không bao giờ "đoán trước được" (tương tự slot machine nhưng kết nối với healthy habits)
- Weekly challenge xoay 4 chủ đề → tránh nhàm chán
- Seasonal event có thời hạn → FOMO kích thích hành động
- Reward items không thể mua lại (sound-coin, effect-sparkle, zodiac limited)

## 5.3 Streak System — Mất là đau hơn nhận

- Streak tăng khi ghi giao dịch đầu tiên trong ngày mới
- Bỏ 1 ngày → streak về 0 → **loss aversion** mạnh hơn reward expectation
- STREAK_BONUS +500 XP mỗi bội số 7 ngày → shock reward bất ngờ

## 5.4 Milestone & Celebration

- Goal đạt 25/50/75/100% → confetti + âm thanh khác nhau
- Rank-up → popup overlay với gradient glow của rank mới
- Earning task complete → income confetti (vàng, dày)
- STREAK_BONUS → toast đặc biệt từ Lord Diamond
- `MilestoneCelebration` component: modal animation + câu quote

## 5.5 Progress Bars & Visibility

- XP bar trên header: luôn thấy % tiến độ đến rank tiếp theo
- Sub-task: "2/5 bước" → partial completion thúc đẩy tiếp tục (Zeigarnik effect)
- Budget bars: xanh/vàng/đỏ → visual cảnh báo tức thì
- Goal progress với milestone markers
- HallOfFame: trophy shelf tâm lý

## 5.6 Personalization & Identity

- Lord Diamond xưng "ngài" → cảm giác cao cấp, được tôn trọng
- Vibe system theo tuổi (teen/young/adult/mature) → copy cá nhân hóa
- Zodiac integration: linh vật tương ứng bản mệnh trên header
- `[profile: ...]` tag → Lord Diamond nhớ sở thích, hoàn cảnh
- WellnessCard thay đổi theo giờ → app "biết" bạn

## 5.7 Loss Aversion & Social Accountability

- `IdleMoneyBanner`: "Bạn có X đang ngủ quên trong ví" → khó chịu → hành động
- `WishlistPopup` sau 7 ngày: "Bạn còn muốn không?" → nhiều người chọn Không
- Task overdue -15 XP → mất nhiều hơn không làm → motivation to finish
- Memory bump Goal: "Cùng ngày này năm trước..." → nostalgia + tự hào
- `BudgetWarningBanner` đỏ → sợ mất kiểm soát → tự điều chỉnh

---

# 6. Cơ chế Báo cáo CFO

2 đường song song: (A) Chat CFO_REPORT intent và (B) Standalone `/report` page.

## 6.1 So sánh 2 đường CFO

| | Chat CFO (handleCFOReport) | Standalone /report |
|---|---|---|
| API Endpoint | `/api/chat` → CFO_REPORT | `/api/ai-money-chat/cfo-narration` |
| Trigger | User nhập "báo cáo CFO" | Auto khi mở /report |
| LLM | Groq / OpenAI (qua llmClient) | Groq (qua cfoNarrationClient) |
| Cache | Session 30 phút | Firestore fingerprint cache |
| Quota | 3 CFO/tháng (free) | Narration credit riêng |
| Output | Markdown 3-phần + actionable | Prose narrative + health gauge |
| Fallback | deterministic từ moneyBrain | `buildLocalCfoNarration()` |

## 6.2 Pipeline 6 bước

**Bước 1 — Build Snapshot (client)**
```
buildClientSnapshot()  →  ClientSnapshotInput
Gồm: transactions tháng này, expenseHistory 3 tháng, budgets,
      goals, tasks, bills, userGamification state
```

**Bước 2 — Server validation & cache**
```
getFinanceSnapshot(uid, {clientSnapshot})
  → invalidateSnapshotCache
  → buildFromClient()
  → CACHE in-memory 5 phút (bug B-03 trên serverless)
  → toMoneySnapshotV1()
```

**Bước 3 — moneyBrain computation**
```
buildCFOContextPack(snapshot)  →  CFOContextPackV1:
  - Executive summary (mode: stabilize|build_cashflow|accelerate|protect_capital)
  - Health Score 6 thành phần
  - CutSimulation: cắt 10/20/30% → tiết kiệm bao nhiêu
  - Anomalies: z-score phát hiện giao dịch bất thường
  - Goal metrics: atRisk, projected completion date
  - Behavior: largestTxns, unusualSpending, repeatedSmallLeaks, weekendSpending
```

**Bước 4 — Health Score (6 thành phần)**

| Thành phần | Trọng số | Tính từ |
|---|---|---|
| Savings Rate | 30% | `monthlySavings / monthlyIncome` |
| Emergency Fund | 20% | `emergencyBalance / (monthlyExpense × 3)` |
| Budget Adherence | 20% | categories on track / total |
| Debt-to-Income | 15% | `1 − (totalDue / monthlyIncome)` |
| Goal Progress | 10% | avg % completion của active goals |
| Income Stability | 5% | income consistency qua 3 tháng |

**Bước 5 — LLM Generation**
```
buildLLMMessages():
  - LORD_DIAMOND_SYSTEM_PROMPT (xưng "ngài", no emoji, no số tự bịa)
  - CFOContextPackV1 JSON (compactSnapshot: strip IDs, compress)
  - conversation history (MAX_TURNS=8)
  - user message

generateLLMResponse():
  - primary provider → secondary nếu fail
  - cả 2 fail → throw (không silent fail)
```

**Bước 6 — Output Format**
```markdown
## Tình hình
[Đánh giá tổng quan sức khỏe tài chính]

## Vấn đề chính
[2–3 điểm quan trọng nhất, số từ contextPack — không tự bịa]

## Hành động đề xuất
[3 việc cụ thể user có thể làm ngay]

[profile: ...] (optional — lưu vào AiMoneyMemoryStore)
```

## 6.3 Fallback deterministic

Khi không có API key, `getFallbackNarrative()` phân loại theo healthScore:

| Tier | healthScore | Nội dung |
|---|---|---|
| Good | ≥ 70 | "Tài chính của ngài đang trong vùng xanh. Tiếp tục duy trì..." |
| Fair | 40–69 | "Có một số điểm cần chú ý. Ngân sách tháng này..." |
| Poor | < 40 | "Ngài cần hành động ngay. Chi tiêu vượt ngưỡng an toàn..." |

## 6.4 Quota System

| Plan | CFO Reports/tháng | Narrations/tháng | Follow-up/tháng |
|---|---|---|---|
| Free | 3 | 5 | 10 |
| Pro | Unlimited | Unlimited | Unlimited |

> Quota tracking: Firestore `users/{uid}/aiUsage/{monthKey}` với Firestore transaction tránh race condition.  
> Fingerprint cache: sha256(transactions + budgets + goals) → nếu data không đổi, trả cached narration, không charge credit.

---

# 7. Bugs & Vấn đề kỹ thuật

| ID | Mức độ | File | Mô tả | Hướng sửa |
|---|---|---|---|---|
| **B-01** | 🔴 HIGH | `snapshotBuilder.ts:456` | `safeToSpend` tính sai: `Budget − Expense − DueBills`. Bỏ qua `carryOver` và `goalContributions`. Kết quả khác `moneyBrain.getSafeToSpendBreakdown()` | Dùng `getSafeToSpendBreakdown()` từ moneyBrain thay vì tính lại |
| **B-02** | 🔴 HIGH | `requestAuth.ts:7` | Yêu cầu CẢ HAI cookie `manicash-session` VÀ Bearer token. Thiếu 1 → 401 im lặng. Mobile app (không có cookie) luôn fail | Cho phép chỉ cần Bearer token verify thành công |
| **B-03** | 🔴 HIGH | `snapshotBuilder.ts`, `conversationStore.ts` | In-memory cache (Map) mất khi Vercel cold start. Snapshot TTL 5 phút, conversation TTL 30 phút — cả hai chỉ ổn trong 1 instance | Migrate sang Upstash Redis / Vercel KV |
| **B-04** | 🟡 MEDIUM | `intentRouter.ts` | Router chỉ extract slot cho `LOG_TRANSACTION`. 14 intent truy vấn khác không có slot extraction | Đủ cho Phase 2 hiện tại. Nâng cấp khi cần query theo tháng/danh mục cụ thể |
| **B-05** | 🟡 MEDIUM | `/api/chat/route.ts` | Không có rate-limit riêng. Mỗi request có Firestore transaction 200–400ms — dễ bị spam | Thêm Upstash Ratelimit: 10 req/phút/IP cho free users |
| **B-06** | 🟡 MEDIUM | `AiMoneyChatContent.tsx` | Không có lịch sử hội thoại trong clientSnapshot. Mỗi lượt chat gửi context mới | By design tiết kiệm token. Cân nhắc truyền 2–3 turns cho FOLLOW_UP |
| **B-07** | 🟢 LOW | `cfoNarrationCache.ts` | Cache CFO narration trên Firestore không tự xóa khi user xóa account | Thêm vào account deletion cron |
| **B-08** | 🟢 LOW | `groqClient.ts` | `getCFONarrative` hard-code model `"llama-3.3-70b-versatile"` thay vì đọc env | `model: process.env.AI_MONEY_CHAT_GROQ_MODEL \|\| "llama-3.3-70b-versatile"` |

---

# 8. Điểm mù (Blind Spots)

## 8.1 Chat không có LLM thật → mọi thứ fallback

| Hiện tại (không có API key) | Sau khi có API key |
|---|---|
| Query deterministic vẫn đúng | `LLM_PROVIDER=groq + GROQ_API_KEY`: primary Groq, fallback OpenAI |
| CFO_REPORT / ANALYZE_FINANCE → fallback deterministic | `LLM_PROVIDER=openai + OPENAI_API_KEY`: primary OpenAI, fallback Groq |
| AI Fallback Parse: tắt | Bật `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true` |
| CFO Narration: tắt | Quota tự charge, có free và Pro plan |

## 8.2 Tính năng có code nhưng chưa kết nối

- **SMS Webhook** (`NEXT_PUBLIC_SMS_WEBHOOK_ENABLED=false`): parser sẵn sàng cho 7 ngân hàng — chưa expose cho user
- **MoneySync** (`NEXT_PUBLIC_MONEY_SYNC_ENABLED=false`): module đồng bộ Firestore đa thiết bị hoàn chỉnh — đang tắt
- **Chat session không persist**: follow-up sau re-open app sẽ mất context (30 phút in-memory)
- **Long-term profile UI**: LLM ghi `[profile: ...]` vào Firestore nhưng không có UI để user xem/xóa
- **CFO card / follow-up buttons**: type `ChatReplyUiKind` có `cfo-card`, `follow-up-buttons` nhưng `AiMoneyChatContent` chưa render payload
- **Action Protocol edge cases**: `executeMoneyActionOnClient` có nhưng chưa test concurrent actions, undo quá hạn

## 8.3 LLM "mù" — không thấy được

- **Giao dịch tháng cũ**: snapshot chỉ có txn tháng hiện tại; history chỉ là aggregate 3 tháng (không có txn cụ thể)
- **Query chi tiết danh mục tháng trước**: "café tháng trước bao nhiêu?" → không trả được
- **Flagged transactions**: logic có trong `/api/cfo` legacy path nhưng không có trong chat flow
- **Số dư ngân hàng thực**: mọi câu hỏi dựa trên số user tự nhập, không kết nối ngân hàng thực

---

# 9. Road map nâng cấp Chat

4 giai đoạn để mở ra trải nghiệm **chat tài chính đầy đủ nhất Việt Nam**:

## Phase A — P0: Kết nối API Key + Sửa bug

- [ ] **B-01**: Sửa `safeToSpend` trong `snapshotBuilder` dùng `getSafeToSpendBreakdown()`
- [ ] **B-02**: Sửa `requestAuth` chỉ cần Bearer token
- [ ] **B-08**: Sửa `groqClient.ts` đọc env model
- [ ] Cấu hình `.env.local`: `GROQ_API_KEY` + `OPENAI_API_KEY` + `LLM_PROVIDER=groq`
- [ ] Bật `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true`
- [ ] Test toàn bộ intent flow với LLM thật

## Phase B — P1: Nâng cấp UI Chat

- [ ] Render CFO card (`cfo-card`) khi server gửi `kind="cfo-card"`
- [ ] Render follow-up buttons: "Giải thích thêm", "Kế hoạch tuần"
- [ ] Message streaming (ReadableStream) thay vì đợi full response
- [ ] Typing indicator chính xác
- [ ] Markdown renderer: support bảng, highlight số tiền

## Phase C — P1: Mở tính năng SMS & Sync

- [ ] Bật SMS Webhook (`NEXT_PUBLIC_SMS_WEBHOOK_ENABLED=true`)
- [ ] Hướng dẫn user cài Tasker/Shortcut gửi SMS ngân hàng
- [ ] Bật MoneySync sau khi deploy Firestore rules
- [ ] **B-03**: Chuyển cache sang Upstash Redis / Vercel KV
- [ ] Test sync đa thiết bị (merge conflict)

## Phase D — P2: Chat thông minh hơn

- [ ] Chat memory dài hạn: lưu sessionId → Redis, load lại khi mở app
- [ ] Multi-turn context: truyền 3–5 turns trước vào prompt cho mọi query
- [ ] History tháng cũ: API lấy txn theo tháng cụ thể khi user hỏi
- [ ] Proactive insights: LLM push cảnh báo khi phát hiện anomaly
- [ ] Voice input (Web Speech API) cho mobile
- [ ] **B-05**: Rate limiting (Upstash Ratelimit)
- [ ] Quest integration vào snapshot: chat biết user đang làm quest nào
- [ ] Wishlist + Rank query intents

---

# 10. Hướng dẫn cài đặt API Keys

## 10.1 .env.local tối thiểu để chat AI hoạt động

```env
# LLM — bắt buộc cho CFO Report, phân tích, follow-up
GROQ_API_KEY=sk-...                         # từ console.groq.com
OPENAI_API_KEY=sk-...                       # optional, dùng làm fallback
LLM_PROVIDER=groq                           # hoặc "openai"

# Bật AI features
AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (server-side)
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# License (bắt buộc ở production, pass mọi thứ ở dev)
MANICASH_LICENSE_KEY=any-string-8-chars

# Optional features
NEXT_PUBLIC_MONEY_SYNC_ENABLED=false        # bật sau khi deploy Firestore rules
NEXT_PUBLIC_SMS_WEBHOOK_ENABLED=false       # bật khi có webhook endpoint public
```

## 10.2 Kiểm tra chat hoạt động

1. Chạy `npm run dev`
2. Vào `/chat` → nhập `"len bao cao CFO thang nay"`
3. Nếu thấy response 3 phần `## Tình hình / ## Vấn đề / ## Hành động` → **thành công** (LLM thật)
4. Nếu nhận 1 đoạn text ngắn không có heading → đang dùng **fallback deterministic** (kiểm tra server log)
5. Console error `"License invalid"` → thêm `MANICASH_LICENSE_KEY`

---

# 11. Bảng trạng thái tất cả tính năng

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Chat nhập giao dịch NLP | ✅ Live | Offline, không cần API key |
| Chat query số dư / ví / hóa đơn | ✅ Live | Từ clientSnapshot |
| Chat CFO Report | ✅ Live* | *Cần GROQ_API_KEY, có fallback |
| Chat phân tích & tư vấn | ✅ Live* | *Cần API key |
| Chat follow-up (hội thoại) | ✅ Live* | *Session 30 phút, cold start reset |
| Chat action commands (Phase 4A) | ✅ Live | Transfer, set budget, undo |
| Chat Earning Task planner | ✅ Live | earningDraft flow |
| Chat query rank / XP | ❌ Thiếu | Chưa có intent QUERY_RANK |
| Chat query quests | ❌ Thiếu | QuestStore chưa vào snapshot |
| Chat query wishlist | ❌ Thiếu | WishlistStore chưa vào snapshot |
| Chat export CSV | ❌ Thiếu | Chỉ có trên /report page |
| Overview Dashboard | ✅ Live | 15+ widget, real-time |
| Input Transaction (manual) | ✅ Live | Split tx, AI fallback parse |
| Ledger (sổ sách) | ✅ Live | 3 tab: Daily / Category / Bills |
| Goals & Milestones | ✅ Live | Confetti, anniversary deposits |
| Wishlist & Resist | ✅ Live | Cooling period, RESIST XP |
| Earning Tasks | ✅ Live | Sub-tasks, XP penalty system |
| Onboarding Quests (7 bước) | ✅ Live | Gated, deep-link actions |
| Daily Quests (3/ngày) | ✅ Live | Random từ pool, reset 0h |
| Weekly Challenges (4 chủ đề) | ✅ Live | Dynamic target theo income |
| Seasonal Events | ✅ Live | Hè 2026 active (01/05–31/08) |
| XP + Rank System | ✅ Live | 7 ranks, 11 action types |
| CFO /report page | ✅ Live | Export CSV, AI narration |
| SMS Webhook (banking) | ⚠️ Code có, tắt | 7 ngân hàng sẵn sàng, cần bật flag |
| MoneySync (multi-device) | ⚠️ Code có, tắt | Firestore sync, cần bật flag |
| Chat session persist | ❌ Thiếu | In-memory 30 phút, mất khi cold start |
| CFO card / follow-up buttons UI | ❌ Thiếu | Type định nghĩa, chưa render |
| Admin dashboard | ✅ Live | Ban, quota, user stats |

---

# 12. Tóm tắt nhanh

| | |
|---|---|
| ✅ **Điểm mạnh** | Kiến trúc chat Phase 1–5 hoàn chỉnh về code. moneyBrain engine tính deterministic, LLM chỉ diễn giải. 22 intent types. Action Protocol có confirm + undo. Gamification 4 lớp quest + 7 kỹ thuật dopamine. |
| 🔴 **Bug chính** | `safeToSpend` tính sai (B-01). `requestAuth` bỏ lỡ mobile (B-02). In-memory cache không bền vững trên serverless (B-03). |
| ⚠️ **Điểm mù lớn** | Chat chạy không có LLM thật nếu thiếu API key. UI không render CFO card / follow-up buttons. SMS webhook + MoneySync có code nhưng tắt. Chat không biết rank, quest, wishlist của user. |
| 🚀 **Ưu tiên #1** | Cấu hình `GROQ_API_KEY + OPENAI_API_KEY`, sửa B-01 và B-02. Chat thông minh ngay. |
| 🚀 **Ưu tiên #2** | Streaming response + render CFO card UI → trải nghiệm như chat thật. |
| 🚀 **Ưu tiên #3** | Upstash Redis cho conversation store + snapshot cache → follow-up ổn định trên serverless. |
| 🚀 **Ưu tiên #4** | Thêm quest / wishlist / rank vào snapshot → chat hiểu toàn bộ trạng thái user. |

---

*Báo cáo tổng hợp từ phân tích source code ManiCash · 14/06/2026 · Claude (Anthropic)*
