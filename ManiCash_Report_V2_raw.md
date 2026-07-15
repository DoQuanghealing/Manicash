**🏦 ManiCash**

**BÁO CÁO KỸ THUẬT TOÀN DIỆN V2**

*Tính năng Chat · 5 Trang Chính · Gamification · CFO Report*

Tháng 6 · 2026 · Vietnamese Personal Finance App

**PHẦN 1 --- TÍNH NĂNG CHAT: LIÊN KẾT & CHƯA LIÊN KẾT**

Trang Chat (/chat) là trung tâm thần kinh của app --- nơi người dùng nhập liệu bằng ngôn ngữ tự nhiên, truy vấn số liệu, ra lệnh AI và nhận báo cáo CFO. Dưới đây là bức tranh đầy đủ về những gì đã và chưa được kết nối với hệ thống chat.

**1.1 Các tính năng ĐÃ liên kết với Chat**

**A. Nhập giao dịch qua ngôn ngữ tự nhiên**

*Intent: LOG\_TRANSACTION · Xử lý: Client-side parseInput() → DraftCard confirm UI*

-   Người dùng nhập: \"mua trà sữa 50k\" → app phân tích cú pháp → hiện card xác nhận gồm danh mục, số tiền, loại giao dịch

-   Xác nhận → lưu vào useFinanceStore → trao XP (EXPENSE\_LOGGED +10, INCOME\_LOGGED +15\~65)

-   Kết nối trực tiếp với: useFinanceStore, useBudgetStore, useAuthStore (XP)

-   Hoạt động hoàn toàn offline --- không cần API key

**B. Truy vấn số dư**

*Intent: QUERY\_BALANCE, QUERY\_WALLET · Handler: handleQueryBalance, handleQueryWallet*

-   \"Tôi còn bao nhiêu tiền?\" → trả về số dư 3 ví (Chính, Dự phòng, Quỹ hóa đơn) từ clientSnapshot

-   \"Quỹ dự phòng của tôi\" → thông tin cụ thể từng ví

-   Tất cả số liệu từ clientSnapshot --- không cần gọi Firestore hay AI

**C. Hỏi về hóa đơn**

*Intent: QUERY\_BILLS · Handler: handleQueryBills*

-   \"Tiền điện đóng chưa?\" → kiểm tra danh sách fixedBills trong snapshot

-   \"Hóa đơn nào sắp đến hạn?\" → lọc theo dueDate gần nhất

**D. Lệnh chuyển tiền & đặt ngân sách (Phase 4A)**

*Intent: ACTION\_REQUEST · Server tạo actionRequest → client confirm → execute với undo*

-   \"Chuyển 500k vào quỹ dự phòng\" → tạo transfer transaction + trừ ví chính

-   \"Đặt ngân sách ăn uống 3 triệu\" → cập nhật categoryBudgets

-   Full undo trong 30 giây sau khi thực hiện

**E. Lên kế hoạch nhiệm vụ kiếm tiền**

*Intent: PLAN\_EARNING\_TASK · earningDraft flow*

-   \"Tôi muốn freelance thiết kế\" → chat hỏi chi tiết → tạo EarningTask + sub-tasks

-   Kết nối với useTaskStore.addTask()

**F. Báo cáo CFO (AI)**

*Intent: CFO\_REPORT · Requires GROQ/OPENAI API keys + AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED=true*

-   Phân tích toàn diện: healthScore, cashflow, categories, goals, tasks, anomalies

-   Output: 3-part markdown (Tình hình / Vấn đề chính / Hành động đề xuất)

-   Fallback deterministic khi không có API key

-   Có quota system: free (3 CFO/tháng), Pro (unlimited)

**G. Phân tích chi tiêu & tư vấn**

*Intent: ANALYZE\_FINANCE, ADVICE\_CUT\_SPENDING, ADVICE\_INCOME*

-   \"Tôi tiêu nhiều nhất vào gì?\" → phân tích categories từ snapshot

-   \"Làm sao cắt giảm?\" → gợi ý dựa trên cutSimulation 10/20/30%

-   \"Cách kiếm thêm tiền?\" → đề xuất dựa trên earningTasks hiện có

**H. Hội thoại follow-up (AI)**

*Intent: FOLLOW\_UP · Session TTL 30 phút, MAX\_TURNS=8*

-   Nhớ ngữ cảnh trong cùng session (lịch sử hội thoại)

-   Lord Diamond nhận ra \[profile: \...\] tag → lưu vào useAiMoneyMemoryStore

-   \"Giải thích thêm về điểm X\" → không cần gửi lại snapshot

**I. Báo cáo nhanh theo chip**

*5 quick chips: Nhập thủ công, Báo cáo trưa, Tổng kết tối, Đối chiếu số dư, Lịch sử thao tác*

-   \"Báo cáo trưa\" → snapshot nhanh chi tiêu buổi sáng

-   \"Tổng kết tối\" → tóm tắt ngày, so sánh với ngân sách

-   \"Đối chiếu số dư\" → reconciliationForm để user nhập số dư thực từ ngân hàng

**1.2 Các tính năng CHƯA liên kết với Chat**

**A. Gamification / XP / Rank**

-   Chat không thể query rank hiện tại, XP còn lại hay điều kiện rank-up

-   Không có intent QUERY\_RANK hoặc GAMIFICATION\_STATUS

-   → Tiềm năng: \"Tôi còn bao nhiêu XP để lên Vàng?\" nên được hỗ trợ

**B. Quest System (Onboarding / Daily / Weekly / Seasonal)**

-   useQuestStore hoàn toàn không được đưa vào clientSnapshot

-   Chat không biết user đang làm quest nào, tiến độ ra sao

-   → Tiềm năng: \"Nhiệm vụ hôm nay của tôi là gì?\" --- query từ QuestStore

**C. Wishlist**

-   useWishlistStore không có trong snapshot --- chat không đọc được Wishlist

-   \"Wishlist của tôi có gì?\" sẽ trả về UNKNOWN intent

-   → Cần: thêm wishlist vào clientSnapshot.wishlistItems

**D. Rewards / Cosmetics / Hall of Fame**

-   useRewardStore, hệ thống zodiac, theme unlocks --- chat không biết

-   Không có intent nào để query phần thưởng hay mở khóa cosmetic

**E. SMS Webhook**

-   /api/sms-webhook nhận SMS ngân hàng, tạo pending transaction --- hoàn toàn tách biệt với chat flow

-   Chat không thể query \"tin nhắn ngân hàng gần nhất\" hay xác nhận pending từ SMS qua chat

-   → Cần: thêm pendingWebhookTransactions vào snapshot

**F. MoneySync (Multi-device)**

-   useMoneySyncStore quản lý đồng bộ Firestore đa thiết bị --- chat không tương tác được

-   Chat không thể trigger sync thủ công hay báo cáo conflict

**G. Lịch sử 3 tháng chi tiết**

-   clientSnapshot có expenseHistory 3 tháng nhưng chỉ dạng tổng theo category

-   Không thể query chi tiết từng giao dịch của tháng trước qua chat

-   → Cần: intent QUERY\_HISTORY\_TRANSACTIONS với date filter

**H. Báo cáo Export (CSV)**

-   buildMonthlyReportCsv() + downloadCsv() chỉ accessible từ CfoReportContent

-   Chat không thể lệnh \"xuất báo cáo tháng này ra file\" qua chat

**PHẦN 2 --- 5 TRANG CHÍNH VÀ CÁC TRANG PHỤ**

App ManiCash được tổ chức theo route group (app) với bottom navigation 5 tab. Mỗi trang chính có các trang phụ, modal và panel con.

**2.1 Trang Overview (/overview) --- \"Tổng quan tài chính\"**

Dashboard chính hiển thị toàn bộ sức khỏe tài chính trong ngày. Render theo layout 1-2-3 (IncomeBlock → ExpenseBillBlock → FundsBlock) với nhiều lớp widget thông minh.

**Các khối chính**

  -------------------------- -----------------------------------------------------------------------------------------
  **Khối**                   **Mô tả**
  SafeToSpendCard            Số tiền có thể tiêu hôm nay (cốt lõi của app). Tính: Budget - Chi đã tiêu - HĐ đến hạn.
  IncomeBlock                Thu nhập tháng, top 3 nguồn, CTA ghi thu nhập mới.
  ExpenseBillBlock           Chi tiêu vs hóa đơn cố định. Chia 2 cột.
  FundsBlock                 Ba quỹ: Chính / Dự phòng / Hóa đơn. Chia 3.
  BudgetWarningBanner        Cảnh báo khi chi tiêu vượt ngưỡng category.
  PendingTransactionBanner   Hiển thị pending tx từ SMS webhook chờ confirm.
  IdleMoneyBanner            Cảnh báo tiền nhàn rỗi trong ví, gợi ý chuyển vào Goals.
  WishlistPopup              Tự xuất hiện sau 7 ngày cooling, hỏi \"Bạn còn muốn mua không?\"
  SeasonalEventBanner        Banner sự kiện mùa (Hè 2026 đang active)
  UpcomingHolidayHint        Gợi ý tiết kiệm cho dịp lễ gần nhất (âm/dương lịch)
  OnboardingQuestPanel       7 nhiệm vụ tân thủ gated theo ngày (tự ẩn khi hoàn thành)
  DailyQuestCard             3 nhiệm vụ hàng ngày reset 0h (random từ pool 10+)
  WeeklyChallengeCard        Thử thách 7 ngày xoay vòng 4 theme
  MissionChecklist           Legacy 3-mission checklist (backward compat với MissionStore)
  WellnessCard               Tin nhắn wellness theo giờ trong ngày + age-group vibe
  MonthlyReportModal         Auto-popup báo cáo tháng từ Lord Diamond (lần đầu xem)
  BankSyncReminder           Nhắc cài SMS webhook (chỉ show khi isSmsWebhookEnabled)
  -------------------------- -----------------------------------------------------------------------------------------

**Trang phụ của Overview**

-   Profile (/profile) --- chỉnh hồ sơ, năm sinh, rank, zodiac

-   Settings (/settings) --- cài đặt app, vibe, ngôn ngữ, SMS webhook

-   Upgrade (/upgrade) --- màn hình mua Pro

-   Admin (/admin) --- dashboard quản trị (ban user, quota, stats)

**2.2 Trang Input (/input) --- \"Nhập giao dịch\"**

Màn hình nhập liệu thủ công. Thực chất là wrapper mỏng quanh component TransactionInput --- toàn bộ logic ở component này.

**TransactionInput Component**

-   Tab chi tiêu / thu nhập / chuyển quỹ

-   Chọn danh mục từ grid icon (30+ danh mục expense, 10+ income)

-   Input số tiền với keyboard VND

-   Optional: note, date picker, split transaction (chia thành nhiều phần)

-   Submit → useFinanceStore.addTransaction() → XP award → confetti nếu thu nhập lớn

-   Deep-link từ quest: /input?type=expense hoặc /input?type=income

**Tính năng nâng cao**

-   Split Transaction: 1 khoản tiền chia ra nhiều danh mục (vd: bill 500k = 300k ăn + 200k giải trí)

-   AI fallback parse: câu nhập mập mờ → /api/ai-money-chat/parse → Groq phân loại

-   Recurring bills: đánh dấu giao dịch là hóa đơn cố định hàng tháng

**2.3 Trang Ledger (/ledger) --- \"Sổ sách\"**

Lịch sử giao dịch và quản lý ngân sách. Có 3 tab: Chi tiêu, Danh mục, Bill cố định.

**Tab 1: Chi tiêu (Daily)**

-   Danh sách giao dịch nhóm theo ngày

-   Bộ lọc: Tất cả / Thu / Chi + lọc theo ngày qua CalendarModal

-   Tap vào giao dịch → TransactionDetailSheet (xem, sửa, xóa)

-   Flagged transactions: highlight vàng giao dịch bị BudgetStore đánh dấu bất thường

-   Split transaction: có expand để xem chi tiết từng phần

**Tab 2: Danh mục (CategoryBreakdownPanel)**

-   Thanh tiến độ từng category so với ngân sách tháng

-   Color-coded: xanh (an toàn), vàng (cảnh báo), đỏ (vượt ngưỡng)

-   BudgetSettingsModal: đặt ngưỡng monthly limit cho từng category

**Tab 3: Bill cố định (FixedBillsPanel)**

-   Danh sách recurring bills với status Đã trả / Chưa trả

-   Tổng hóa đơn tháng, số đã đóng/chưa đóng

-   Xác nhận thanh toán → cập nhật paidMonths trong FinanceStore

**2.4 Trang Goals (/goals) --- \"Mục tiêu & Wishlist\"**

Hai tab: Mục tiêu lớn (tiết kiệm có mốc) và Wishlist (kiềm chế mua sắm). Là trung tâm của tư duy tài chính dài hạn.

**Tab 1: Mục tiêu lớn**

-   Tổng tiết kiệm / tổng target, thanh tiến độ gradient

-   GoalCard: tên, icon, số tiền đã tích lũy, deadline, progress bar, milestones

-   GoalFormModal: tạo/sửa goal --- tên, target amount, deadline, milestones tự generate

-   GoalDepositModal: nạp tiền vào goal → SAVINGS\_DEPOSIT XP (+20\~120 tùy số tiền)

-   GoalDetailModal: lịch sử deposits, confetti khi đạt milestone 25/50/75/100%

-   Memory bump: \"Cùng ngày này năm trước bạn đã nạp X vào goal Y\" → emotional hook

-   Anniversary deposit: tự detect deposit cùng ngày năm trước

**Milestone Celebration System**

-   4 mốc tự động: 25%, 50%, 75%, 100% → confetti + âm thanh

-   100% → levelUp sound + rankUp confetti particle

-   MilestoneCelebration component: popup với animation và CTA

**Tab 2: Wishlist**

-   Add item với tên, giá, cooling period (7/14/30 ngày)

-   Item locked trong cooling → không thể mua, chỉ xem đếm ngược

-   Sau cooling → popup \"Bạn còn muốn không?\" (WishlistPopup trên Overview)

-   Resist: bấm \"Không mua\" → RESIST\_SPENDING XP tính theo saved amount

-   Purchase: chuyển thành transaction expense tự động

-   Deep-link từ daily quest: /goals?tab=wishlist

**2.5 Trang Money (/money) --- \"Nhiệm vụ kiếm tiền & CFO\"**

Trang đôi vai quan trọng nhất: quản lý nhiệm vụ kiếm tiền (tab Money) và báo cáo AI (tab CFO). Đây là nơi kết hợp giữa hành động thực tế và phân tích chiến lược.

**Tab Money: Nhiệm vụ kiếm tiền**

-   Stats bar: Active / Completed / Overdue tasks

-   TaskCard: tên task, expected amount, deadline, sub-task progress bar, status badge

-   Expand task → chi tiết sub-tasks với checkbox, timestamp hoàn thành

-   Complete task → CompleteModal nhập actual amount → TASK\_COMPLETE XP

-   Overdue → TaskOverdueDialog: chọn lý do (Không phù hợp / Hoãn / Đổi kế hoạch)

-   Income celebration: confetti khi mark complete

-   HallOfFame: top 3 completed tasks cao nhất (trophy visualization)

**Charts trên Tab Money**

-   StackedBarChart: so sánh chi tiêu 4 tuần gần nhất theo category

-   SavingsLineChart: đường tăng trưởng tiết kiệm 6 tháng

-   Link → /report: báo cáo CFO đầy đủ

**Tab CFO: Báo cáo AI**

-   CFOInsightCard: summary từ AI, healthScore, suggestions

-   HealthScoreGauge: gauge 0-100 màu gradient (đỏ→vàng→xanh)

-   Auto-fetch khi data thay đổi (cacheKey tracking)

-   Force refresh button: gọi lại API ngay lập tức

-   Link đến /report cho báo cáo chi tiết đầy đủ

**Trang phụ: /report --- CFO Report đầy đủ**

-   CfoReportContent: bản phân tích chi tiết với healthScore gauge lớn

-   Top 5 category chi tiêu, budget stats, goal progress

-   AI narration từ /api/ai-money-chat/cfo-narration (có fingerprint cache)

-   Export CSV: buildMonthlyReportCsv() → tải file .csv tháng này

-   ProGate: chức năng nâng cao yêu cầu Pro tier

**PHẦN 3 --- LOGIC TÍNH NĂNG NHIỆM VỤ**

ManiCash có 4 lớp nhiệm vụ khác nhau, mỗi lớp phục vụ một mục tiêu tâm lý riêng biệt.

**3.1 Nhiệm vụ kiếm tiền (Earning Tasks)**

*Store: useTaskStore · Types: EarningTask, SubTask, XPPenalty*

**Vòng đời của một Earning Task**

  ---------------- ---------------------------------------------------
  **Trạng thái**   **Điều kiện**
  pending          startDate \> now --- task chưa bắt đầu
  active           startDate ≤ now ≤ endDate --- đang trong thời hạn
  overdue          now \> endDate và chưa completed --- quá hạn
  completed        completedAt có giá trị --- đã hoàn thành
  ---------------- ---------------------------------------------------

**XP Formula cho Task**

-   TASK\_COMPLETE: max(20, floor(earnedAmount/500k)×10 + daysEarly×5)

-   Ví dụ: task 3tr, xong sớm 2 ngày → max(20, 6×10 + 2×5) = max(20, 70) = 70 XP

-   TASK\_OVERDUE: -15 XP (penalty cứng)

-   Penalty multiplier: hoàn thành task trễ → 3 task tiếp theo nhận 70% XP thay vì 100%

**Sub-task system**

-   Mỗi task có checklist sub-tasks (1-6 bước)

-   Sub-task tick → completedAt timestamp lưu lại

-   completeTask() → tự tick ALL sub-tasks

-   undoCompleteTask() → khôi phục đúng sub-task state + XP penalties trước đó

**5 Seed Tasks mặc định (Demo)**

  ------------------------- ------------ ------------------------------
  **Task**                  **Amount**   **Status**
  Freelance thiết kế logo   3,000,000đ   active (2/5 sub-tasks done)
  Bán hàng online Shopee    1,500,000đ   pending (chưa bắt đầu)
  Dạy kèm tiếng Anh         2,000,000đ   overdue (1/2 sub-tasks done)
  Viết bài blog công nghệ   800,000đ     completed (toàn bộ xong)
  Chụp ảnh sự kiện          5,000,000đ   pending (7 ngày nữa)
  ------------------------- ------------ ------------------------------

**3.2 Nhiệm vụ tân thủ (Onboarding Quests)**

7 quest gated theo thứ tự --- quest N+1 chỉ mở khi quest N hoàn thành. Tự ẩn khi user hoàn thành hết.

  ---------------------------- ------------------------- ---------------------------- --------
  **Quest**                    **Mục tiêu**              **Metric**                   **XP**
  \#1 Giới thiệu bản thân      Điền tên + năm sinh       profile\_completed ≥ 1       30
  \#2 Lần đầu ghi chi tiêu     Ghi 1 expense             expense\_logged\_count ≥ 1   25
  \#3 Ghi khoản thu nhập       Ghi 1 income              income\_logged\_count ≥ 1    25
  \#4 Thêm vào Wishlist        Add 1 item wishlist       wishlist\_count ≥ 1          30
  \#5 Đặt mục tiêu lớn         Tạo 1 Goal                goal\_created ≥ 1            40
  \#6 Tạo nhiệm vụ kiếm tiền   Tạo 1 EarningTask         earning\_task\_created ≥ 1   50
  \#7 Điểm danh 3 ngày         Mở app 3 ngày khác nhau   app\_open\_days ≥ 3          80
  ---------------------------- ------------------------- ---------------------------- --------

*Phần thưởng đặc biệt: title-newbie (quest 1), sound-coin (quest 3), effect-sparkle (quest 6), zodiac-ty (quest 7)*

**3.3 Nhiệm vụ hàng ngày (Daily Quests)**

3 quest ngẫu nhiên từ pool 10+ template, reset lúc 0h. Seed ngày → kết quả như nhau cho cùng ngày.

  ---------------------- -------------------------------------- --------
  **Quest ID**           **Mục tiêu**                           **XP**
  daily-expense-2        Ghi 2 chi tiêu hôm nay                 30
  daily-income-1         Ghi 1 thu nhập                         25
  daily-checkin          Điểm danh (ghi giao dịch đầu tiên)     15
  daily-overview         Kiểm tra Safe-to-Spend                 10
  daily-wishlist         Mở Wishlist                            15
  daily-3-transactions   Ghi 3 giao dịch bất kỳ                 40
  daily-resist-1         Kiềm chế 1 lần                         35
  daily-subtask-1        Hoàn thành 1 sub-task                  20
  daily-budget-check     Xem tab Danh mục                       10
  daily-streak           Duy trì streak (streak tăng hôm nay)   20
  ---------------------- -------------------------------------- --------

**3.4 Thử thách tuần (Weekly Challenges)**

4 chủ đề xoay vòng theo số tuần trong năm. Target tính động theo % thu nhập tháng trước.

  ------------- -------------- -------------------------------- -------------------------------- --------
  **Tuần %4**   **Chủ đề**     **Metric**                       **Target**                       **XP**
  0             🛡️ Tiết Kiệm   saved\_this\_week                5% thu nhập (min 500k, max 5M)   300
  1             🧊 Kiềm Chế     resist\_count\_this\_week        3--7 lần                         250
  2             ⚒️ Kiếm Thêm   tasks\_completed\_this\_week     1--2 task                        400
  3             🛍️ Wishlist    wishlist\_rejected\_this\_week   2--3 lần từ chối                 200
  ------------- -------------- -------------------------------- -------------------------------- --------

**3.5 Sự kiện theo mùa (Seasonal Events)**

Sự kiện có thời gian, 3-6 chương tuyến tính, mở khóa cosmetic limited. Event active hiện tại: Hè Vàng 2026 (01/05 -- 31/08/2026).

  ------------ --------------------- ------------------------ ------------ -----------------------------
  **Chương**   **Tên**               **Metric**               **Target**   **XP + Reward**
  C1           Khởi động hè          event\_app\_days         5 ngày       150 + theme-emerald
  C2           Cày Hè                event\_task\_completed   2 tasks      200 + effect-lightning
  C3           Tiết Kiệm Mùa Nóng    event\_saved             2,000,000đ   250
  C4           Chiến Binh Kiềm Chế   event\_resist            5 lần        300 + title-summer-warrior
  Final        Hoàn thành hè         Tất cả chương            ---          theme-summer-gold (limited)
  ------------ --------------------- ------------------------ ------------ -----------------------------

**3.6 Legacy Mission Checklist (MissionStore)**

Hệ thống mission đơn giản 3 bước --- vẫn hiển thị trên Overview qua MissionChecklist. Không còn phát triển nhưng không bị xóa vì backward compat.

-   3 mission ID cố định, tick/untick qua checkbox

-   completeMission() → idempotent XP grant 1 lần duy nhất (MISSION\_COMPLETE +50)

-   Không persist qua reload (in-memory only, không dùng zustand persist)

**PHẦN 4 --- CÁCH APP KÍCH THÍCH DOPAMINE NGƯỜI DÙNG**

ManiCash áp dụng 7 kỹ thuật gamification song song, được thiết kế có chủ ý để tạo vòng lặp thói quen tài chính tích cực.

**4.1 Hệ thống XP & Rank --- Tiến trình rõ ràng**

**XP Rewards chi tiết**

  ----------------------- ------------------ ---------------------------------------
  **Hành động**           **XP nhận được**   **Ghi chú**
  INCOME\_LOGGED          +15 đến +65        15 base + min(floor(amount/1M)×5, 50)
  EXPENSE\_LOGGED         +10                Cố định --- khuyến khích ghi đều
  RESIST\_SPENDING        +50 đến +150       (25 + min(saved/500k×10, 50)) × 2
  SAVINGS\_DEPOSIT        +20 đến +120       20 base + min(amount/1M×10, 100)
  TASK\_COMPLETE          +20 đến +100+      max(20, earned/500k×10 + daysEarly×5)
  DAILY\_STREAK 7 ngày    +10                Streak cơ bản
  DAILY\_STREAK 14 ngày   +15                Cần duy trì 2 tuần
  DAILY\_STREAK 30 ngày   +20                Cần duy trì 1 tháng
  STREAK\_BONUS ×7 ngày   +500               Milestone streak bội số 7
  BUDGET\_ON\_TRACK       +20                Ngân sách category đang kiểm soát
  MISSION\_COMPLETE       +50                Legacy mission checklist
  WEBHOOK\_CONFIRMED      +10                Xác nhận SMS ngân hàng
  TASK\_OVERDUE           -15                Penalty khi để task quá hạn
  ----------------------- ------------------ ---------------------------------------

**7 Bậc Rank với Perk riêng**

  ----------- ---------- ---------------- ----------------------------------------------
  **Rank**    **Icon**   **XP yêu cầu**   **Perk mở khóa**
  Sắt         🗡️         0                Tất cả tính năng cơ bản
  Đồng        🥉          500              Khóa học \"Quản lý chi tiêu 101\"
  Bạc         🥈          2,000            Khóa học \"Tư duy tiết kiệm\"
  Vàng        🥇          5,000            Khóa học \"Đầu tư cơ bản\" + AI CFO nâng cao
  Bạch Kim    💎          12,000           Khóa học \"Chiến lược thu nhập thụ động\"
  Lục Bảo     🟢          25,000           Khóa học \"Xây dựng mạng lưới kinh doanh\"
  Kim Cương   💠          50,000           MỞ KHÓA TẤT CẢ khóa học đầu tư cao cấp
  ----------- ---------- ---------------- ----------------------------------------------

**4.2 Variable Reward --- Phần thưởng biến đổi**

Daily Quests random mỗi ngày = không bao giờ biết trước sẽ nhận quest gì → não tiếp tục mong đợi (mechanism tương tự slot machine nhưng built around healthy habits).

-   Pool 10+ quest template, chọn ngẫu nhiên 3 quest/ngày theo date-seed

-   Weekly challenge xoay vòng 4 chủ đề → người dùng không bị nhàm

-   Seasonal event có thời hạn → FOMO (fear of missing out) kích thích hành động

-   Reward items: sound-coin, effect-sparkle, theme-emerald, zodiac limited\... không thể mua lại

**4.3 Streak System --- Chuỗi thói quen**

Streak tăng khi ghi giao dịch đầu tiên trong ngày mới. Mất streak nếu bỏ 1 ngày → tạo sợ mất mát (loss aversion) mạnh hơn là mong đợi nhận thưởng.

-   Streak 1-6 ngày: +10 XP/ngày

-   Streak 7 ngày: +15 XP + STREAK\_BONUS +500 XP (milestone reward)

-   Streak 14 ngày: +15 XP/ngày

-   Streak 30 ngày: +20 XP/ngày + STREAK\_BONUS mỗi bội số 7

-   Mất streak → visual feedback (icon fire tắt, số về 0) → tâm lý \"mất cái đã có\"

**4.4 Milestone & Celebration --- Khoảnh khắc chiến thắng**

-   Goal đạt 25%/50%/75%/100% → confetti particle + âm thanh khác nhau

-   Rank-up → popup celebration lớn với gradient glow của rank mới

-   Earning task complete → income confetti (màu vàng, dày hơn)

-   STREAK\_BONUS 500 XP → toast đặc biệt \"Chuỗi 7 ngày! Lord Diamond chúc mừng\"

-   MilestoneCelebration component: modal overlay với animation và câu quote

**4.5 Progress Bars & Social Proof**

-   XP bar trên header: % tiến độ đến rank tiếp theo luôn hiển thị

-   Sub-task progress bar: \"2/5 bước\" → partial completion thúc đẩy tiếp tục

-   Budget category bars: color-coded (xanh/vàng/đỏ) → visual cảnh báo tức thì

-   Goal progress bar với milestone markers → rõ ràng bao xa đến đích

-   HallOfFame: top 3 earning tasks cao nhất → \"trophy shelf\" tâm lý

**4.6 Personalization & Identity**

-   Lord Diamond gọi user là \"ngài\" --- cảm giác được tôn trọng, cao cấp

-   Vibe system theo tuổi (teen/young/adult/mature) → copy text cá nhân hóa

-   Zodiac integration: linh vật chạy trên header tương ứng bản mệnh

-   \[profile: \...\] tag từ AI → Lord Diamond nhớ sở thích, mục tiêu, hoàn cảnh

-   WellnessCard thay đổi theo giờ trong ngày → cảm giác app \"biết\" bạn

**4.7 Social Accountability & Loss Aversion**

-   IdleMoneyBanner: \"Bạn có X đang ngủ quên trong ví\" → gây khó chịu → hành động

-   WishlistPopup sau 7 ngày: \"Bạn còn muốn mua món đó không?\" → nhiều người chọn Không

-   Task overdue penalty -15 XP → mất nhiều hơn không làm được → motivation to finish

-   Memory bump Goal: \"Cùng ngày này năm trước bạn đã nạp 500k\" → nostalgia + tự hào

-   BudgetWarningBanner: đỏ khi vượt ngưỡng → sợ mất kiểm soát → tự điều chỉnh

**PHẦN 5 --- CƠ CHẾ BÁO CÁO CFO**

Hệ thống CFO gồm 2 đường song song: (A) Chat CFO\_REPORT intent và (B) Standalone /report page. Cả hai dùng chung engine phân tích nhưng khác nhau về giao diện và API path.

**5.1 Architecture Overview**

  -------------- -------------------------------------- -------------------------------------------
                 **Chat CFO (handleCFOReport)**         **Standalone /report (CfoReportContent)**
  API Endpoint   /api/chat → CFO\_REPORT intent         /api/ai-money-chat/cfo-narration
  Trigger        User nhập \"báo cáo CFO\" trong chat   Tự động khi mở /report page
  LLM Provider   Groq / OpenAI (qua llmClient)          Groq (qua cfoNarrationClient)
  Cache          Session-level (30 phút)                Firestore fingerprint cache
  Quota          Charge CFO credit (free: 3/tháng)      Charge narration credit
  Output         Markdown 3-phần + actionable           Prose narrative + health gauge
  Fallback       deterministic từ moneyBrain            buildLocalCfoNarration()
  -------------- -------------------------------------- -------------------------------------------

**5.2 Pipeline CFO Report đầy đủ**

**Bước 1: Build Snapshot**

-   Client: buildClientSnapshot() đóng gói toàn bộ Zustand state

-   Gồm: transactions (tháng này), expenseHistory (3 tháng), budgets, goals, tasks, bills, userGamification

-   Gửi kèm POST body đến /api/chat

**Bước 2: Server validation & cache**

-   getFinanceSnapshot(uid, {clientSnapshot}) → invalidateSnapshotCache → buildFromClient()

-   CACHE in-memory 5 phút (bug B-03: mất khi serverless cold start)

-   toMoneySnapshotV1() → chuẩn hóa type MoneySnapshotV1

**Bước 3: moneyBrain computation**

-   buildCFOContextPack(snapshot) → CFOContextPackV1 đầy đủ

-   Executive summary: mode (stabilize/build\_cashflow/accelerate/protect\_capital)

-   Health Score: 6 thành phần có trọng số

-   CutSimulation: mô phỏng cắt 10/20/30% chi tiêu → tiết kiệm bao nhiêu

-   Anomalies: z-score phát hiện giao dịch bất thường

-   Goal metrics: atRisk goals, projected completion date

-   Behavior analysis: largestTransactions, unusualSpending, repeatedSmallLeaks, weekendSpending

**Bước 4: Health Score (6 thành phần)**

  ------------------ -------------- -----------------------------------------
  **Thành phần**     **Trọng số**   **Tính từ**
  Savings Rate       30%            monthlySavings / monthlyIncome
  Emergency Fund     20%            emergencyBalance / (monthlyExpense × 3)
  Budget Adherence   20%            categories on track / total categories
  Debt-to-Income     15%            1 - (totalDue / monthlyIncome)
  Goal Progress      10%            avg completion % của active goals
  Income Stability   5%             income consistency qua 3 tháng
  ------------------ -------------- -----------------------------------------

**Bước 5: LLM Generation**

-   buildLLMMessages(): system prompt + CFOContextPackV1 JSON + conversation history + user message

-   compactSnapshot(): strip IDs, compress JSON để giảm token count

-   generateLLMResponse(): primary provider → secondary nếu fail (cả 2 fail → throw)

-   LORD\_DIAMOND\_SYSTEM\_PROMPT: xưng \"ngài\", không emoji, không tự bịa số

**Bước 6: Output Format**

-   \#\# Tình hình: đánh giá tổng quan sức khỏe tài chính

-   \#\# Vấn đề chính: 2-3 điểm cần chú ý nhất (từ contextPack, không bịa)

-   \#\# Hành động đề xuất: 3 việc cụ thể user có thể làm ngay

-   Optional \[profile: \...\] tag cuối response → lưu vào AiMoneyMemoryStore

**5.3 Fallback Deterministic (khi không có API key)**

getFallbackNarrative() trong groqClient.ts phân loại theo healthScore:

  ---------- ----------------- ----------- -------------------------------------------------------------------
  **Tier**   **healthScore**   **Tone**    **Nội dung**
  Good       ≥ 70              Chúc mừng   \"Tài chính của ngài đang trong vùng xanh. Tiếp tục duy trì\...\"
  Fair       40-69             Tư vấn      \"Có một số điểm cần chú ý. Ngân sách tháng này\...\"
  Poor       \< 40             Cảnh báo    \"Ngài cần hành động ngay. Chi tiêu vượt ngưỡng an toàn\...\"
  ---------- ----------------- ----------- -------------------------------------------------------------------

**5.4 Quota System**

  ---------- ----------------------- ---------------------- ---------------------
  **Plan**   **CFO Reports/tháng**   **Narrations/tháng**   **Follow-up/tháng**
  Free       3                       5                      10
  Pro        Unlimited               Unlimited              Unlimited
  ---------- ----------------------- ---------------------- ---------------------

*Quota tracking: Firestore document users/{uid}/aiUsage/{monthKey} với Firestore transaction để tránh race condition.*

*Fingerprint cache: sha256(transactions + budgets + goals) → nếu data không đổi, trả cached narration từ Firestore, không charge credit.*

**5.5 Các điểm yếu cần chú ý (CFO Bugs)**

**BUG B-01: safeToSpend sai**

*snapshotBuilder tính: safeToSpend = Budget - Expense - DueBills*

**Đúng phải là: safeToSpend = Budget - Expense - DueBills - GoalContributions + CarryOver**

Fix: thay inline formula bằng call tới moneyBrain.getSafeToSpendBreakdown()

**BUG B-03: In-memory cache mất khi cold start**

Cả conversation store (30 phút) lẫn snapshot cache (5 phút) đều in-memory. Vercel serverless cold start → mất tất cả context.

Fix: migrate sang Upstash Redis hoặc Vercel KV cho production.

**PHẦN 6 --- HƯỚNG DẪN KẾT NỐI API KEY**

Để chat AI (CFO Report, Phân tích, Follow-up) hoạt động đầy đủ, cần cấu hình các biến môi trường sau:

**6.1 .env.local tối thiểu để chạy Chat AI**

  -------------------------------------------- ----------------------------------------------------
  **Biến môi trường**                          **Giá trị / Ghi chú**
  **GROQ\_API\_KEY**                           sk-\... (từ console.groq.com)
  **LLM\_PROVIDER**                            groq (hoặc openai)
  **AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED**   true
  **MANICASH\_LICENSE\_KEY**                   bất kỳ string ≥ 8 ký tự (non-production pass luôn)
  **NEXT\_PUBLIC\_FIREBASE\_\***               6 biến Firebase từ Firebase Console
  **FIREBASE\_ADMIN\_\***                      Service account JSON cho server-side auth
  **OPENAI\_API\_KEY**                         sk-\... (optional, dùng làm secondary fallback)
  -------------------------------------------- ----------------------------------------------------

**6.2 Kiểm tra chat hoạt động**

-   Chạy: npm run dev

-   Vào /chat → nhập \"len bao cao CFO thang nay\"

-   Nếu thấy response 3 phần (\#\# Tình hình / \#\# Vấn đề / \#\# Hành động) = thành công

-   Nếu nhận text 1 đoạn không có heading = đang dùng fallback deterministic (kiểm tra log server)

-   Console error \"License invalid\" → thêm MANICASH\_LICENSE\_KEY vào .env.local

**PHẦN 7 --- BẢNG TÓM TẮT TOÀN DIỆN**

**7.1 Trạng thái tất cả tính năng**

  --------------------------------- ---------------- ---------------------------------------
  **Tính năng**                     **Trạng thái**   **Ghi chú**
  Chat nhập giao dịch NLP           **✅ Live**       *Offline, không cần API key*
  Chat query số dư/ví/hóa đơn       **✅ Live**       *Từ clientSnapshot*
  Chat CFO Report                   **✅ Live\***     *\*Cần GROQ\_API\_KEY, có fallback*
  Chat phân tích & tư vấn           **✅ Live\***     *\*Cần API key*
  Chat follow-up (hội thoại)        **✅ Live\***     *\*Session 30 phút, cold start reset*
  Chat action commands (Phase 4A)   **✅ Live**       *Transfer, set budget, undo*
  Chat Earning Task planner         **✅ Live**       *earningDraft flow*
  Chat query rank/XP                **❌ Thiếu**      *Chưa có intent QUERY\_RANK*
  Chat query quests                 **❌ Thiếu**      *QuestStore chưa vào snapshot*
  Chat query wishlist               **❌ Thiếu**      *WishlistStore chưa vào snapshot*
  Chat export CSV                   **❌ Thiếu**      *Chỉ có trên /report page*
  Overview Dashboard                **✅ Live**       *15+ widget, real-time*
  Input Transaction (manual)        **✅ Live**       *Split tx, AI fallback parse*
  Ledger (sổ sách)                  **✅ Live**       *3 tab: Daily/Category/Bills*
  Goals & Milestones                **✅ Live**       *Confetti, anniversary deposits*
  Wishlist & Resist                 **✅ Live**       *Cooling period, RESIST XP*
  Earning Tasks                     **✅ Live**       *Sub-tasks, XP penalty system*
  Onboarding Quests (7 bước)        **✅ Live**       *Gated, deep-link actions*
  Daily Quests (3/ngày)             **✅ Live**       *Random from pool, reset 0h*
  Weekly Challenges (4 chủ đề)      **✅ Live**       *Dynamic target theo income*
  Seasonal Events                   **✅ Live**       *Hè 2026 active (01/05--31/08)*
  XP + Rank System                  **✅ Live**       *7 ranks, 11 action types*
  CFO /report page                  **✅ Live**       *Export CSV, AI narration*
  SMS Webhook (banking)             **✅ Live**       *7 ngân hàng, pending confirm*
  MoneySync (multi-device)          **✅ Live**       *Firestore outbox sync*
  Admin dashboard                   **✅ Live**       *Ban, quota, user stats*
  --------------------------------- ---------------- ---------------------------------------

*Báo cáo này tổng hợp từ phân tích toàn bộ source code của ManiCash vào ngày 14/06/2026.*

Được tạo tự động bởi Claude · Anthropic
