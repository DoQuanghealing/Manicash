# Kế hoạch chi tiết — Hệ thống Quest ManiCash

> Tài liệu này tổng hợp đầy đủ **30 quest** đang có (7 onboarding + 9 daily + 4 weekly + 10 seasonal chapters) cùng UX flow + roadmap implementation.

---

## 1. Tầm nhìn UX cốt lõi

Mỗi quest là **1 con đường rõ ràng**:

```
┌─────────────────────────────────────────────────────────────┐
│  CARD QUEST (overview)                                      │
│  💸  Ghi 2 chi tiêu hôm nay         [+30 XP]  [Làm ngay →] │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ click "→"
┌─────────────────────────────────────────────────────────────┐
│  DESTINATION WINDOW                                         │
│  /input?type=expense                                        │
│  ┌─ Floating hint bar trên cùng ────────────────────────┐  │
│  │ 📍 Nhiệm vụ: Ghi 2 chi tiêu (0/2)                    │  │
│  │ Tiến độ: ▓▓▓░░░░░░░       ← updates realtime         │  │
│  └───────────────────────────────────────────────────────┘  │
│  [Form ghi chi tiêu]                                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ đạt target (user ghi đủ 2 chi tiêu)
┌─────────────────────────────────────────────────────────────┐
│  COMPLETION POPUP                                           │
│  🎉 confetti                                                │
│  Đã hoàn thành: Ghi 2 chi tiêu hôm nay!                     │
│  +30 XP  +  Sound Pack Tiền Xu                              │
│  ┌─────────────────────┐  ┌──────────────┐                  │
│  │  ✨ Nhận thưởng     │  │  Để sau      │                  │
│  └─────────────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ click "Nhận thưởng"
              [Toast +30 XP] → quay về overview, card chuyển "✓ đã claim"
```

---

## 2. Kiến trúc kỹ thuật cần thêm

### 2.1 Mở rộng `QuestAction.kind`

Hiện có: `navigate | highlight | checkin | openWishlist | openMoney`

**Thêm:**

| Kind | Mục đích | Implementation |
|------|----------|----------------|
| `focusModal` | Mở 1 modal scoped (không rời overview) | target = modal ID, dispatch event mount modal |
| `guidedFlow` | Tour nhiều bước với highlight + tooltip | target = flow ID, mount Joyride-style overlay |
| `splitTransfer` | Mở giao dịch transfer split (cho weekly saver) | navigate /input + auto chọn tab transfer |
| `taskCreate` | Mở /money + auto-trigger TaskFormModal | navigate /money?action=new-task |

### 2.2 Quest Hint Bar (NEW)

Banner thường trực trên destination window khi user đang làm 1 quest:

- Vị trí: sticky-top dưới header, slide-in từ trên
- Nội dung: quest icon + name + progress (current/target) + close button
- Logic: `useQuestStore.activeQuestContext` lưu `{ questId, type, returnPath }` khi user bấm "Làm ngay"
- Clear khi: quest complete HOẶC user navigate ra trang khác > 30s

### 2.3 Completion Popup Host (NEW)

- Mount ở `(app)/layout.tsx` (single instance)
- Subscribe `xpEvents` + check quest store diff
- Khi 1 quest từ `in-progress` → `completed` (chưa claim) → render popup
- Queue: nếu nhiều quest complete cùng lúc → hiện lần lượt

### 2.4 Bổ sung metric tracking thiếu

**Đang thiếu hoặc không chính xác (theo memory):**

| Metric | Vấn đề hiện tại | Cần fix |
|--------|------------------|---------|
| `resist_today` | Luôn = 0 | Thêm `resistEventsByDate` trong useAuthStore |
| `subtask_today` | Tổng từ trước, không theo ngày | Thêm `completedAt` cho SubTask type |
| `budget_viewed` | Luôn = 0 | Hook `usePageVisitTracker('ledger')` đã có — đọc từ store |
| `wishlist_viewed` | Luôn = 0 | Tương tự như trên |
| `saved_this_week` | Chưa có | Tính từ `transactions.filter(t.kind==='split' && weekKey)` |
| `event_*` (5 metrics) | Chưa có | Tương tự daily nhưng filter từ event.startDate |

---

## 3. Inventory đầy đủ — 30 Quest

### Onboarding (7) — gated linear

| # | ID | Tên | Metric | Target | XP | Reward Item |
|---|----|-----|--------|--------|-----|-------------|
| 1 | `onb-1-profile` | Giới thiệu bản thân | profile_completed | 1 | 30 | title-newbie |
| 2 | `onb-2-expense` | Lần đầu ghi chi tiêu | expense_logged_count | 1 | 25 | — |
| 3 | `onb-3-income` | Ghi 1 khoản thu nhập | income_logged_count | 1 | 25 | sound-coin |
| 4 | `onb-4-wishlist` | Thêm 1 món vào Wishlist | wishlist_count | 1 | 30 | — |
| 5 | `onb-5-goal` | Đặt 1 mục tiêu lớn | goal_created | 1 | 40 | — |
| 6 | `onb-6-task` | Tạo 1 nhiệm vụ kiếm tiền | earning_task_created | 1 | 50 | effect-sparkle |
| 7 | `onb-7-streak` | Điểm danh 3 ngày | app_open_days | 3 | 80 | zodiac-ty |

### Daily (9) — pick 3/ngày từ pool

| ID | Tên | Metric | Target | XP | Weight |
|----|-----|--------|--------|-----|--------|
| `daily-expense-2` | Ghi 2 chi tiêu | expense_today | 2 | 30 | 3 |
| `daily-income-1` | Ghi 1 thu nhập | income_today | 1 | 25 | 2 |
| `daily-checkin` | Điểm danh | streak_advanced | 1 | 15 | 3 (luôn pick) |
| `daily-overview` | Kiểm tra số dư | overview_opened | 1 | 10 | 1 |
| `daily-resist-1` | Kiềm chế 1 lần | resist_today | 1 | 50 | 2 |
| `daily-subtask` | Hoàn thành 1 sub-task | subtask_today | 1 | 35 | 2 |
| `daily-transactions-3` | Ghi 3 giao dịch | transactions_today | 3 | 40 | 1 |
| `daily-wishlist` | Xem Wishlist | wishlist_viewed | 1 | 20 | 1 |
| `daily-budget` | Kiểm tra ngân sách | budget_viewed | 1 | 20 | 1 |

### Weekly (4) — rotation theo tuần

| ID | Tên | Metric | Target (dynamic) | XP | Reward |
|----|-----|--------|------------------|-----|--------|
| `weekly-saver` | Thử thách Tiết Kiệm | saved_this_week | 5% income (floor 500k, cap 5M) | 300 | effect-coinrain |
| `weekly-discipline` | Thử thách Kiềm Chế | resist_count_this_week | 2/3/5 theo bậc income | 350 | title-saver |
| `weekly-earner` | Thử thách Kiếm Thêm | tasks_completed_this_week | 1 | 400 | elearning-vitien |
| `weekly-wishlist` | Thử thách Tỉnh Táo | wishlist_rejected_this_week | 1 | 300 | elearning-thieuduc |

### Seasonal (3 events × ~4 chapters = 10)

#### Event 1: Hè Vàng 2026 (May–Aug)
| Chapter | Tên | Metric | Target | XP | Item |
|---------|-----|--------|--------|-----|------|
| 1 | Khởi động hè | event_app_days | 5 | 150 | theme-emerald |
| 2 | Cày Hè | event_task_completed | 2 | 250 | elearning-vitien |
| 3 | Tích Lũy | event_saved | 1M VND | 300 | — |
| 4 | Kỷ Luật Hè | event_resist | 3 | 350 | — |
| **Final** | | | | | title-saver + effect-coinrain + elearning-banlam |

#### Event 2: Trung Thu 2026 (Sep–Oct)
| Chapter | Tên | Metric | Target | XP | Item |
|---------|-----|--------|--------|-----|------|
| 1 | Quỹ Biếu | event_saved | 500k | 200 | — |
| 2 | Ghi nhận thu nhập | event_income_logged | 3 | 150 | — |
| 3 | Cam kết | event_app_days | 7 | 250 | — |
| **Final** | | | | | elearning-tamthuc-1 + sound-tet |

#### Event 3: Tết Bính Ngọ 2026 (Jan–Feb, đã qua)
| Chapter | Tên | Metric | Target | XP | Item |
|---------|-----|--------|--------|-----|------|
| 1 | Tổng kết năm cũ | event_income_logged | 5 | 200 | — |
| 2 | Quỹ Tết | event_saved | 2M | 400 | — |
| 3 | Khai bút đầu xuân | event_app_days | 3 | 300 | — |
| **Final** | | | | | theme-tet-2026 + butler-tet + elearning-tet2026 |

---

## 4. Spec chi tiết từng quest

> Format chuẩn:
> - **Đích đến** (destination URL hoặc modal)
> - **Thao tác cần làm** (user actions)
> - **Điều kiện hoàn thành** (detection logic)
> - **Sau khi hoàn thành** (popup + reward grant)

### 4.1 ONBOARDING (7 quest)

---

**ONB-1: Giới thiệu bản thân**
- 🎯 Đích: `/profile?edit=1` → tự mở **ProfileEditModal**
- 🛠️ Thao tác:
  1. Nhập **tên hiển thị** (không trống)
  2. Nhập **năm sinh** (1900–năm hiện tại)
  3. Bấm "Lưu thay đổi"
- ✅ Điều kiện: `user.displayName.trim().length > 0 && user.yearOfBirth` (cả 2 cùng có)
- 🎁 Sau khi xong:
  - Popup: "🎉 Bạn đã chính thức gia nhập ManiCash"
  - Reward: **+30 XP** + Title `🌱 Tân Binh`
  - Bonus phụ: nếu nhập yearOfBirth → tự unlock **con giáp mệnh chủ** + **theme-banmenh** (chưa active, user phải vào Tủ Sưu Tầm chọn)

---

**ONB-2: Lần đầu ghi chi tiêu**
- 🎯 Đích: `/input?type=expense`
- 🛠️ Thao tác:
  1. Chọn category (Ăn uống / Đi lại / ...)
  2. Nhập amount > 0
  3. Bấm "Thêm chi tiêu"
- ✅ Điều kiện: có ≥1 transaction `type='expense'` trong store
- 🎁 Sau khi xong:
  - Popup: "✨ Bước đầu tiên! Mỗi chi tiêu được ghi là 1 lần não bộ nhận thức được tiền đi đâu."
  - Reward: **+25 XP** + +10 XP từ EXPENSE_LOGGED engine (auto)

---

**ONB-3: Ghi 1 khoản thu nhập**
- 🎯 Đích: `/input?type=income`
- 🛠️ Thao tác:
  1. Chọn category thu nhập (Lương / Freelance / Quà / ...)
  2. Nhập amount
  3. Bấm "Thêm thu nhập"
- ✅ Điều kiện: có ≥1 transaction `type='income'`
- 🎁 Sau khi xong:
  - Popup: "💰 Tiền vào ví bạn rồi. Giờ là lúc quyết định: tiêu, để dành, hay đầu tư?"
  - Reward: **+25 XP** + base 15 XP từ INCOME_LOGGED (+ bonus theo amount) + Sound Pack 🔔 **Tiền Xu Cling**

---

**ONB-4: Thêm 1 món vào Wishlist**
- 🎯 Đích: `/goals?tab=wishlist`
- 🛠️ Thao tác:
  1. Bấm "+ Thêm wish"
  2. Nhập tên món, giá, lý do, chọn cooling period (24h–168h)
  3. Bấm "Thêm vào danh sách"
- ✅ Điều kiện: `wishlist.items.length >= 1`
- 🎁 Sau khi xong:
  - Popup: "🧊 Đặt vào tủ đông! Sau X giờ, bạn sẽ quyết định nên mua hay không. 90% bạn sẽ thấy mình không cần nữa."
  - Reward: **+30 XP**

---

**ONB-5: Đặt 1 mục tiêu lớn**
- 🎯 Đích: `/goals` (tab Goals — default)
- 🛠️ Thao tác:
  1. Bấm "+ Mục tiêu mới"
  2. Nhập tên, target amount, deadline
  3. (Tùy chọn) thêm milestones
  4. Bấm "Tạo mục tiêu"
- ✅ Điều kiện: `goals.length >= 1`
- 🎁 Sau khi xong:
  - Popup: "🎯 Bạn có lý do để giữ tiền rồi! Tiền không bay đi nữa vì giờ nó có địa chỉ."
  - Reward: **+40 XP**

---

**ONB-6: Tạo 1 nhiệm vụ kiếm tiền**
- 🎯 Đích: `/money` → tab "Nhiệm vụ kiếm tiền" → mở **TaskFormModal**
- 🛠️ Thao tác:
  1. Bấm "+"
  2. Nhập tên task, expected amount, startDate, endDate
  3. (Tùy chọn) thêm sub-tasks
  4. Bấm "Tạo nhiệm vụ"
- ✅ Điều kiện: `tasks.length >= 1`
- 🎁 Sau khi xong:
  - Popup: "⚒️ Bây giờ bạn không chỉ ghi tiền — bạn còn LẬP KẾ HOẠCH kiếm tiền. Bước nhảy lớn!"
  - Reward: **+50 XP** + Hiệu ứng nhập **✨ Lấp Lánh**

---

**ONB-7: Điểm danh 3 ngày**
- 🎯 Đích: **CheckInModal** (overlay)
- 🛠️ Thao tác:
  - Mở app + ghi ≥1 giao dịch trong **3 ngày dương lịch khác nhau**
- ✅ Điều kiện: `user.streak >= 3`
- 🎁 Sau khi xong:
  - Popup: "🔥 Streak 3 ngày = bạn đã hình thành thói quen mầm! Linh vật đã chọn bạn."
  - Reward: **+80 XP** + Zodiac **🐭 Tý — Chuột Vàng** (mặc định nếu chưa có mệnh chủ)

---

### 4.2 DAILY QUEST POOL (9)

---

**DQ-1: Ghi 2 chi tiêu hôm nay** (`daily-expense-2`)
- 🎯 Đích: `/input?type=expense`
- 🛠️ Thao tác: ghi 2 transaction expense trong ngày
- ✅ Điều kiện: `transactions.filter(t.type==='expense' && t.dateKey === today).length >= 2`
- 🎁 Sau khi xong: Popup "💸 Hai khoản đã ghi" + **+30 XP**

---

**DQ-2: Ghi 1 khoản thu nhập** (`daily-income-1`)
- 🎯 Đích: `/input?type=income`
- ✅ Điều kiện: ≥1 transaction income hôm nay
- 🎁 **+25 XP**

---

**DQ-3: Điểm danh hôm nay** (`daily-checkin`) — luôn được pick
- 🎯 Đích: **CheckInModal** (explainer + CTA dẫn `/input`)
- 🛠️ Thao tác: Modal hiện streak hiện tại + 3 quy tắc + nút "Ghi giao dịch để điểm danh"
- ✅ Điều kiện: `user.lastActiveDate === today` (advance streak)
- 🎁 **+15 XP** + base DAILY_STREAK XP từ engine

---

**DQ-4: Kiểm tra số dư có thể tiêu** (`daily-overview`)
- 🎯 Đích: scroll + pulse `#safe-to-spend-card` (ngay tại overview)
- 🛠️ Thao tác: card được highlight → user thấy số safe-to-spend
- ✅ Điều kiện: dispatch action xong → mark complete (đây là quest đơn giản, hoàn thành ngay sau action)
- 🎁 **+10 XP**

---

**DQ-5: Kiềm chế 1 lần chi tiêu** (`daily-resist-1`)
- 🎯 Đích: `/goals?tab=wishlist`
- 🛠️ Thao tác: với wishlist item đã hết cooling → bấm "Từ chối, không mua nữa"
- ✅ Điều kiện: `resist_today >= 1` (cần fix metric — thêm `resistEventsByDate`)
- 🎁 **+50 XP**

---

**DQ-6: Hoàn thành 1 sub-task** (`daily-subtask`)
- 🎯 Đích: `/money` → mở 1 earning task → check 1 sub-task
- ✅ Điều kiện: ≥1 sub-task có `completedAt === today` (cần fix — thêm field completedAt cho SubTask)
- 🎁 **+35 XP**

---

**DQ-7: Ghi 3 giao dịch** (`daily-transactions-3`)
- 🎯 Đích: `/input` (không pre-select type)
- ✅ Điều kiện: tổng income+expense hôm nay ≥ 3
- 🎁 **+40 XP**

---

**DQ-8: Xem lại Wishlist** (`daily-wishlist`)
- 🎯 Đích: `/goals?tab=wishlist`
- ✅ Điều kiện: `usePageVisitStore` record visit cho 'wishlist' hôm nay
- 🎁 **+20 XP**

---

**DQ-9: Kiểm tra ngân sách** (`daily-budget`)
- 🎯 Đích: `/ledger`
- ✅ Điều kiện: `usePageVisitStore` record visit cho 'ledger' hôm nay
- 🎁 **+20 XP**

---

### 4.3 WEEKLY CHALLENGE (4 rotation)

---

**WK-1: Thử thách Tiết Kiệm 7 ngày** (`weekly-saver`) — Tuần 0
- 🎯 Đích: `/input` (tab Transfer) hoặc `/goals` (split fund)
- 🛠️ Thao tác: chuyển tiền vào quỹ Dự phòng / Mục tiêu / Đầu tư
- ✅ Điều kiện: tổng amount transfer split tuần này ≥ target dynamic
  - Target = max(500k, min(income × 5%, 5tr))
- 🎁 Popup: "🛡️ Bạn vừa chứng minh: tiết kiệm KHÔNG phải may mắn — nó là kỷ luật."
- Reward: **+300 XP** + Hiệu ứng 🪙 **Mưa Tiền**

---

**WK-2: Thử thách Kiềm Chế 7 ngày** (`weekly-discipline`) — Tuần 1
- 🎯 Đích: `/goals?tab=wishlist`
- 🛠️ Thao tác: từ chối các wishlist item hết cooling
- ✅ Điều kiện: `resist_count_this_week >= target`
  - target = 2 (<10M income) / 3 (10–30M) / 5 (>30M)
- 🎁 Popup: "🧊 Khả năng nói KHÔNG là sức mạnh hiếm hoi."
- Reward: **+350 XP** + Title 🛡️ **Thợ Săn Tiết Kiệm**

---

**WK-3: Thử thách Kiếm Thêm 7 ngày** (`weekly-earner`) — Tuần 2
- 🎯 Đích: `/money` → hoàn thành 1 earning task
- 🛠️ Thao tác: tick xong tất cả sub-task + actualAmount > 0 → bấm "Hoàn thành"
- ✅ Điều kiện: ≥1 task có `completedAt` trong tuần
- 🎁 Popup: "⚒️ Side hustle = nguồn tiền 2. Càng nhiều nguồn càng an toàn."
- Reward: **+400 XP** + eLearning 📺 **Phong thủy ví tiền**

---

**WK-4: Thử thách Tỉnh Táo 7 ngày** (`weekly-wishlist`) — Tuần 3
- 🎯 Đích: `/goals?tab=wishlist`
- 🛠️ Thao tác: từ chối ≥1 wishlist item sau khi đã hết cooling period
- ✅ Điều kiện: `wishlist_rejected_this_week >= 1`
- 🎁 Popup: "🛍️ Cám dỗ ngắn hạn vs giấc mơ dài hạn — bạn đã chọn đúng."
- Reward: **+300 XP** + eLearning 📖 **Triết lý thiểu dục**

---

### 4.4 SEASONAL EVENTS (10 chapters)

> Mỗi chapter mở khóa khi chapter trước claim. Final reward khi tất cả chapters claim.

---

#### **EVENT 1: Hè Vàng 2026** (2026-05-01 → 2026-08-31)

**SM-1.1: Khởi động hè**
- 🎯 Đích: highlight Calendar (mở app daily)
- ✅ Điều kiện: 5 ngày unique mở app từ 01/05
- 🎁 **+150 XP** + Theme 💚 **Ngọc Lục**

**SM-1.2: Cày Hè**
- 🎯 Đích: `/money` (tạo + hoàn thành task)
- ✅ Điều kiện: 2 earning task complete từ 01/05
- 🎁 **+250 XP** + eLearning 📺 **Phong thủy ví tiền**

**SM-1.3: Tích Lũy**
- 🎯 Đích: `/input` transfer split
- ✅ Điều kiện: tổng saved ≥ 1tr từ 01/05
- 🎁 **+300 XP**

**SM-1.4: Kỷ Luật Hè**
- 🎯 Đích: `/goals?tab=wishlist`
- ✅ Điều kiện: 3 lần resist từ 01/05
- 🎁 **+350 XP**

**Final Hè**: Title **Thợ Săn Tiết Kiệm** + Effect **Mưa Tiền** + eLearning **Phong thủy bàn làm việc**

---

#### **EVENT 2: Trung Thu Đoàn Viên** (2026-09-01 → 2026-10-15)

**SM-2.1: Quỹ Biếu**
- 🎯 Đích: `/input` split vào quỹ Mục Tiêu
- ✅ Điều kiện: saved ≥ 500k từ 01/09
- 🎁 **+200 XP**

**SM-2.2: Ghi nhận thu nhập**
- 🎯 Đích: `/input?type=income`
- ✅ Điều kiện: 3 income logged từ 01/09
- 🎁 **+150 XP**

**SM-2.3: Cam kết**
- 🎯 Đích: highlight Calendar
- ✅ Điều kiện: 7 ngày unique mở app từ 01/09
- 🎁 **+250 XP**

**Final Trung Thu**: eLearning **Bí mật thịnh vượng P1** + Sound Pack **Pháo Tết**

---

#### **EVENT 3: Tết Bính Ngọ 2026** (2026-01-15 → 2026-02-28)

**SM-3.1: Tổng kết năm cũ**
- ✅ 5 income logged từ 15/01 → **+200 XP**

**SM-3.2: Quỹ Tết**
- ✅ saved ≥ 2tr từ 15/01 → **+400 XP**

**SM-3.3: Khai bút đầu xuân**
- ✅ 3 ngày unique từ Mùng 1 Tết → **+300 XP**

**Final Tết**: Theme **Tết Bính Ngọ** + Butler **Quản gia Áo Dài** + eLearning **Kích tài lộc 2026**

---

## 5. Roadmap Implementation

> 5 phase. Mỗi phase commit + push độc lập.

### **Phase A — Completion Popup Host + Quest Hint Bar** ✅ DONE

- [x] `QuestCompletionPopup.tsx` — mount app shell, subscribe 4 store layers (onboarding/daily/weekly/seasonal), queue, confetti + sound 'levelUp', 2 buttons + 8s auto-dismiss timer bar
- [x] `QuestHintBar.tsx` — sticky-top dưới header, mini show button khi user ẩn, stale 30s timeout, computePreview cho 4 quest type
- [x] `useQuestStore.activeContext` + `setActiveContext` + `clearActiveContext` + `toggleHintBarHidden`
- [x] Wire vào DailyQuestCard, OnboardingQuestPanel, WeeklyChallengeCard, SeasonalEventBanner

### **Phase B — Fix Quest Metrics thiếu** ✅ DONE

- [x] `UserProfile.resistByDate` + `lastResistAt` — `incrementResist` ghi YYYY-MM-DD → count, trim last 30 days
- [x] `SubTask.completedAt?: string` — set khi tick (đã sẵn trong types/task.ts)
- [x] `questMetrics.ts`:
  - `resist_today` → `user.resistByDate[today]`
  - `subtask_today` → filter `st.completedAt` theo dateKey hôm nay
  - `budget_viewed` → `usePageVisitStore.visitedToday('ledger')`
  - `wishlist_viewed` → `usePageVisitStore.visitedToday('wishlist')`

### **Phase C — Weekly Challenge Engine + Card UI** ✅ DONE

- [x] `useQuestStore.weeklyInstance` + `ensureCurrentWeekly` + `evaluateWeekly(metrics, target)` + `claimWeekly`
- [x] `questMetrics.ts` collect weekly: saved_this_week / resist_count_this_week / tasks_completed_this_week / wishlist_rejected_this_week + lastMonthIncome
- [x] `WeeklyChallengeCard.tsx`: action button "Làm ngay" → setActiveContext + dispatchAction, progress, reward chips
- [x] `weeklyChallenges.ts` thêm `action` cho mỗi template (saver→input, discipline→wishlist, earner→money, wishlist→wishlist)

### **Phase D — Seasonal Event Engine** ✅ DONE

- [x] `useQuestStore.seasonalEventId` + `seasonalStartedAt` + `seasonalChapterInstances` + `seasonalFinalClaimedAt` + 4 actions
- [x] `seasonalMetrics`: `collectSeasonalDelta(startedAt)` đếm từ event start
- [x] `SeasonalEventBanner.tsx`: hero + chapter list sequential gating + final reward + **CTA mỗi chapter theo metric** (actionForMetric helper)

### **Phase E — Polish UX & Edge Cases** ✅ DONE (core)

- [x] Sound effect 'levelUp' khi popup show
- [x] Icon nhảy + sparkle rotate animation trên popup
- [x] Queue popup — show 1 tại 1 thời điểm
- [x] Hint bar timeout 30s → clear context
- [x] Hint bar có toggle Ẩn/Hiện (mini button quay lại)
- [x] Auto-dismiss 8s với timer bar visual feedback
- [x] Completion popup confetti khi mount + rankUp confetti khi claim

### **Phase F (optional) — Guided Flow cho onboarding** (2h)

🎯 Cho ONB-1 đặc biệt: thay vì chỉ mở modal → guided tour có tooltip "Đây là ô tên", "Đây là năm sinh", "Lưu vào đây".

- [ ] Component `<GuidedTour steps={...} />` (single instance trên app shell)
- [ ] Steps có `targetSelector`, `tooltip`, `placement`
- [ ] Backdrop tối + highlight ring quanh target

---

## 6. Bảng tổng XP & Reward Item

### Tổng XP có thể nhận

| Loại | Quest count | XP/quest | Tổng XP có thể |
|------|-------------|----------|----------------|
| Onboarding (1 lần) | 7 | 25–80 | **280 XP** |
| Daily (3/ngày × 30 ngày) | 90 | 10–50 | **~2,400 XP/tháng** |
| Weekly (4 rotation/tháng) | 4 | 300–400 | **~1,400 XP/tháng** |
| Seasonal (3 event/năm) | 10 + 3 final | varies | **~2,500 XP/event** |

→ User active rất chăm có thể đạt **~4,000 XP/tháng** → tới **Silver (2,000)** trong tháng 1, **Gold (5,000)** tháng 2.

### Tổng Reward Item

Từ catalog 35 items hiện có, **18 items** được unlock qua quest system (còn 17 từ rank/streak/badge).

---

## 7. Open questions cần user quyết

1. **Popup tự đóng sau bao lâu nếu user không tương tác?** Đề xuất: 8s. Auto-claim hay vẫn cần user bấm?
2. **Quest hint bar trên destination window**: hiện trên cả mobile bottom nav hay ẩn? Đề xuất: hiện cố định nhưng có nút "Ẩn" → user toggle.
3. **Sound effect khi complete**: dùng 1 sound chung cho tất cả, hay khác nhau theo quest type? Đề xuất: 1 sound chung "ding" + sound pack đã unlock thay thế.
4. **Có cho phép skip quest không?** VD user không muốn làm "daily-budget" hôm nay. Đề xuất: KHÔNG skip — quest hết hạn lúc 0h sáng mai, miss thì miss.
5. **Streak shield có dùng cho quest streak không?** Hiện shield chỉ bảo vệ `user.streak`. Có nên mở rộng để giữ progress weekly challenge nếu user bỏ lỡ 1 ngày? Đề xuất: KHÔNG — weekly là 7-day window, không có concept "streak" riêng.

---

## 8. Tham chiếu mã nguồn

| Concept | File |
|---------|------|
| Onboarding data | `src/data/onboardingQuests.ts` |
| Daily pool | `src/data/dailyQuestPool.ts` |
| Weekly templates | `src/data/weeklyChallenges.ts` |
| Seasonal events | `src/data/seasonalEvents.ts` |
| Reward catalog | `src/data/rewardCatalog.ts` |
| Quest store (engine) | `src/stores/useQuestStore.ts` |
| Reward store | `src/stores/useRewardStore.ts` |
| Metrics collector | `src/lib/questMetrics.ts` |
| Action dispatcher | `src/hooks/useQuestAction.ts` |
| XP engine | `src/lib/xpEngine.ts` |
| Daily card UI | `src/app/(app)/overview/_components/DailyQuestCard.tsx` |
| Onboarding panel UI | `src/app/(app)/overview/_components/OnboardingQuestPanel.tsx` |
| Weekly card UI | `src/app/(app)/overview/_components/WeeklyChallengeCard.tsx` |
| Seasonal banner UI | `src/app/(app)/overview/_components/SeasonalEventBanner.tsx` |
| Profile edit modal | `src/components/ui/ProfileEditModal.tsx` |
| CheckIn modal | `src/components/ui/CheckInModal.tsx` |
| Reward drawer | `src/components/ui/RewardCollectionDrawer.tsx` |

---

_Cập nhật lần cuối: 2026-05-22. Khi build từng Phase, đánh dấu `- [x]` vào checkbox tương ứng._
