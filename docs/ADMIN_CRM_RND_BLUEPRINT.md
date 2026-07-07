# ManiCash — Blueprint Admin / CRM / R&D Hợp Nhất
### Tài liệu tư vấn tổng hợp (CTO/CPO) — v1.0 · 2026-07-07

> Tài liệu này gộp 5 phân tích chuyên gia (KTS hệ thống · Data/R&D · Growth/CRM · Tâm lý/Gamification · Product/IA) thành MỘT blueprint liền mạch để PO build "một admin quản gần như mọi thứ". Mọi tên collection / metric / event / module / công thức đều được giữ nguyên. Khi các chuyên gia mâu thuẫn, tôi nêu rõ và **phán quyết dứt khoát**.

---

## 0. TL;DR + Khuyến nghị lớn (đọc trong 60 giây)

**Câu hỏi của PO: gộp hay tách admin? → GỘP, nhưng KHÔNG gộp dữ liệu.**

Cả 5 chuyên gia đồng thuận tuyệt đối trên 4 điểm cốt lõi. Đây là xương sống của toàn bộ tài liệu:

| # | Phán quyết | Lý do 1 dòng |
|---|---|---|
| **1** | **MỘT admin hợp nhất** đặt trong repo ManiCash, dạng **BFF (Backend-for-Frontend)**, đọc cả 2 nguồn TẠI CHỖ | PO muốn "quản mọi thứ" từ 1 cửa; join tại tầng UI, không di dời dữ liệu |
| **2** | **KHÔNG gộp 2 database** (Firestore ⟷ CRM Postgres). KHÔNG dựng ETL/data-warehouse. Nối bằng **email chuẩn hoá + uid** | ETL 2 chiều là gánh nặng vận hành cho 1 người; mỗi hệ giữ vai source-of-truth riêng |
| **3** | **Pipeline telemetry/snapshot là MOVE ĐẦU TIÊN** — phải làm TRƯỚC mọi dashboard R&D/chữa lành | Offline-first: server hiện **không có 1 byte hành vi nào**. Time-series không hồi tố được — mỗi ngày trì hoãn = mất vĩnh viễn 1 ngày lịch sử "người tốt lên" |
| **4** | **KHÔNG bật full money-sync** (`NEXT_PUBLIC_MONEY_SYNC_ENABLED`) để làm R&D. Chỉ đẩy **chỉ số đã tổng hợp/ẩn danh**, KHÔNG đẩy giao dịch thô | 90% giá trị R&D với 10% rủi ro privacy/pháp lý; giao dịch tài chính nhạy cảm không rời máy |

**Ba việc TUYỆT ĐỐI KHÔNG làm** (đồng thuận 5/5, để khỏi phí sức của người làm một mình):
1. Gộp Firestore ↔ Postgres thành 1 DB.
2. Bật full ledger money-sync chỉ để làm analytics.
3. Xây "campaign/segment/rule engine" tổng quát hoặc dựng lại LMS/email trong ManiCash. Hệ CRM/LMS DuongQuang.Academy **đã có sẵn** — chỉ deep-link + đẩy tín hiệu sang.

**Con đường ngắn nhất tới cả doanh thu lẫn tầm nhìn:** dựng admin shell + 3 module vận hành sống còn (Overview / Tiền / User) → **bật pipeline snapshot NGAY** (dù UI R&D chưa xong) → nối định danh 2 hệ → dashboard R&D "người tốt lên" → cuối cùng mới tới Chữa lành.

---

## 1. Quyết định kiến trúc & mô hình hợp nhất 2 hệ

### 1.1. Ba mô hình đã cân nhắc — vì sao chọn BFF (join-on-read)

| Mô hình | Mô tả | Verdict |
|---|---|---|
| **A. Giữ 2 admin tách rời** | ManiCash `/admin` + CRM admin riêng | ❌ Giết tầm nhìn "quản mọi thứ" — không bao giờ join được "user ManiCash X có phải learner Y" |
| **B. Hợp nhất về 1 kho (ETL)** | ETL Firestore → Postgres hoặc ngược lại | ❌ Over-engineering. Pipeline stateful phải babysit, drift, double-write — 1 người không kham nổi |
| **C. BFF đọc 2 nguồn tại chỗ** ✅ | 1 lớp Next.js API gọi Firestore Admin SDK + CRM REST, **join on-read** trong bộ nhớ | ✅ **CHỌN**. 0 di dời dữ liệu; mỗi hệ vẫn là source-of-truth; dễ rollback; toàn bộ phức tạp nằm trong 1 lớp code stateless PO kiểm soát 100% |

**Chính kiến:** Ở quy mô một-người-làm với vài nghìn user, latency join-on-read **không phải vấn đề**, còn chi phí vận hành ETL thì **có thật và tăng theo thời gian**.

### 1.2. Hai nguồn sự thật — phân vai rõ ràng

| Nguồn | Công nghệ | Vai trò | Truy cập |
|---|---|---|---|
| **ManiCash** | Firestore (`users`, `payment_intents`, `payments_index`, `grant_events`, `trial_ledger`, `device_ledger`, `payos_webhook_events`, `admin_audit`, `account_deletion_requests`, ...) | **Nguồn tín hiệu hành vi + thanh toán Pro/pack + hệ điều phối real-time (in-app/push)** | Firebase Admin SDK trong Next.js API routes (KHÔNG cho client SDK đọc thẳng collection lớn) |
| **CRM/LMS DuongQuang.Academy** | Postgres, lộ qua bộ MCP `manicash_*` | **Hệ điều phối marketing/lifecycle + LMS + email drip + doanh thu khóa học** | REST facade mỏng (xem 1.4) |

### 1.3. MÂU THUẪN #1 — Gọi MCP `manicash_*` trực tiếp từ admin runtime?

- **Product/IA + KTS hệ thống:** ❌ KHÔNG. MCP là tool cho agent (Claude), không phải API backend cho production UI. Runtime không được phụ thuộc MCP.
- **Data/R&D + Growth/CRM:** dùng các hàm `manicash_*` như nguồn dữ liệu CRM (ngầm định gọi được).

**→ PHÁN QUYẾT: KHÔNG gọi MCP trực tiếp trong production runtime.** Viết một **REST facade mỏng** phía CRM (cùng số endpoint mà MCP đang bọc: `get_funnel_stats`, `get_revenue_chart`, `list_learners`, `get_customer_profile`, `list_refund_requests`, ...). Admin ManiCash gọi HTTP tới facade này. MCP vẫn để Claude/PO dùng khi vận hành thủ công. Lý do: MCP không có SLA/auth/retry của một API production; một admin đang xử lý tiền khách không được phụ thuộc vào tầng tool của agent.

### 1.4. Identity mapping — nối Firestore `uid` ↔ CRM `learner`

Đây là mấu chốt kỹ thuật để 2 hệ "nói chuyện". **Khóa nối = email chuẩn hoá (`email_norm` = lower+trim) làm khóa mềm + `uid`/`learner_id` bất biến làm khóa cứng.**

Bảng ánh xạ đặt ở **Postgres CRM** (nơi đã có SQL join thật):

```sql
CREATE TABLE identity_links (
  id            BIGSERIAL PRIMARY KEY,
  email_norm    TEXT NOT NULL,          -- lower+trim, KHÓA JOIN chính
  firebase_uid  TEXT UNIQUE,            -- từ Firestore users
  learner_id    BIGINT REFERENCES learners(id),
  linked_via    TEXT,                   -- 'email_exact' | 'manual' | 'payment_match'
  confidence    SMALLINT DEFAULT 100,   -- <100 = match mờ, cần super-admin duyệt
  linked_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email_norm)
);
CREATE INDEX idx_ident_email ON identity_links(email_norm);
```

Chiều ngược: trên `users/{uid}` thêm field `crmLearnerId` khi đã khớp. Hai hệ trỏ nhau bằng ID bất biến, không phụ thuộc email.

**Cơ chế đồng bộ (nhẹ, KHÔNG realtime):**
- **Trigger 1 — lúc thanh toán:** khi PayOS grant Pro thành công (đã ghi `payment_intents`/`grant_events`), POST email+uid sang CRM → upsert `identity_links`. Điểm nối tự nhiên vì cả 2 hệ cùng "chạm" user lúc mua.
- **Trigger 2 — nightly reconcile (cron `syncSignalsToCrm()`):** quét `users` chưa link → match `learners.email` → upsert. Đồng thời đẩy sang CRM (qua `manicash_add_customer_interaction`, type `signal_update`) các label: `{lifecycleStage, healthScore, stressFlag, segments[]}` để CRM trigger email drip đúng người.

**Chính kiến (đồng thuận):** **Ép `confidence=100` mới auto-link.** Email lệch (Google email ≠ email mua khóa) → `confidence<100` → đẩy vào hàng chờ super-admin duyệt tay ở `/admin/academy`. **Data R&D bẩn vì auto-link sai còn tệ hơn thiếu link.** KHÔNG làm two-way realtime sync — one-way daily push là đủ 95% giá trị.

### 1.5. Nguyên tắc degrade mềm

BFF phải chịu lỗi: nếu CRM facade down, màn admin vẫn hiện phần Firestore, chỉ báo "CRM tạm ngắt". Một hệ chết **không được kéo sập cả admin**.

---

## 2. Nơi đặt & cách thêm Admin vào ManiCash

### 2.1. Route group — `(admin)` riêng, KHÔNG nhét vào `(app)`

```
src/app/
  admin/                       ← trang /admin CŨ (ban IP/uid + test account) — GIỮ, migrate dần
  (admin)/                     ← route group MỚI, layout riêng (AdminShell + sidebar theo role)
    dashboard/page.tsx         ← M0 Overview
    revenue/                   ← M1 Tiền & Doanh thu
      reconcile/page.tsx       ← Đối soát PayOS
    users/                     ← M2 Người dùng
      [uid]/page.tsx           ← Customer 360
    academy/                   ← M3 Học viên & Khóa học (deep-link CRM)
    rnd/                       ← M4 R&D hành vi
    marketing/                 ← M5 Marketing (deep-link CRM)
    retention/                 ← M6 Giữ chân & Chữa lành
    config/                    ← M7 Nội dung & Cấu hình
    audit/                     ← M8 Nhật ký & Bảo mật
  api/
    admin/                     ← BFF endpoints (server-only, requireAdminRole)
      metrics/route.ts
      crm/[...proxy]/route.ts  ← proxy sang REST facade CRM
    telemetry/                 ← ingest snapshot + event (public-auth, không cần admin)
      capacity/route.ts
      events/ingest/route.ts
```

### 2.2. MÂU THUẪN #2 — Subdomain `admin.manicash.*` hay path `/admin`?

- **KTS hệ thống:** khuyến nghị **subdomain** `admin.manicash.app` — cô lập cookie/session admin, cho phép siết WAF/Firewall + rule Firestore riêng, dễ tách deploy về sau.
- **Product/IA:** mặc định dùng **path `/admin`** dưới cùng origin cho gọn.

**→ PHÁN QUYẾT: MVP dùng path `/admin` (route group `(admin)`) cho nhanh; thiết kế sẵn để nâng lên subdomain khi cần siết bảo mật.** Với 1 người + vài nghìn user, subdomain là tối ưu hoá sớm. Nhưng phải đặt guard middleware (`src/proxy.ts`) ngay từ đầu để việc chuyển sang subdomain sau này chỉ là đổi routing, không phải refactor. **Đây là quyết định PO cần xác nhận (mục 10, #1).**

### 2.3. QUAN TRỌNG cho Capacitor — loại `(admin)` khỏi static export

Admin là **web-only, server-rendered**. Bản Android (`output: export`) **KHÔNG được bundle** route group `(admin)`. Thêm guard trong `next.config` hoặc tách bằng env `NEXT_PUBLIC_BUILD_TARGET=mobile` để skip. Đây là điểm dễ quên gây vỡ build mobile.

### 2.4. Phân quyền vai trò — Custom Claims (chi tiết ở mục 8)

Nâng `requireAdmin` (boolean) hiện có → `requireAdminRole(roles[])`. Xem ma trận đầy đủ ở **mục 8**.

---

## 3. Pipeline dữ liệu/telemetry — ĐIỀU KIỆN TIÊN QUYẾT

> **Đây là mục quan trọng nhất tài liệu.** 5/5 chuyên gia độc lập đều kết luận: **không có pipeline này thì M4 (R&D) và M6 (Chữa lành) là hộp rỗng.** Server hiện chỉ có `users` (scalar hiện tại, ghi đè liên tục, KHÔNG có lịch sử). Mọi engine Health Score / Safe-to-Spend / 4 chỉ số năng lực chạy CLIENT-SIDE, kết quả không rời máy.

### 3.1. Nguyên tắc thiết kế (đồng thuận 5/5)

1. **Tôn trọng offline-first + consent + ẩn danh.** KHÔNG upload giao dịch thô (số tiền tuyệt đối, mô tả). Chỉ upload **chỉ số đã tính / tín hiệu đã bucket hoá**.
2. **Snapshot chỉ số TRƯỚC, event stream SAU.** North-star "người tốt lên" nằm ở time-series chỉ số; event phục vụ funnel/retention/stress đến sau.
3. **Kho lưu MVP = Firestore, KHÔNG BigQuery.** BigQuery chỉ bật khi >~50k user (qua Firebase → BigQuery streaming export native, không code).

### 3.2. HỢP NHẤT tên collection (giải quyết trùng lặp giữa các chuyên gia)

Các chuyên gia đặt tên khác nhau cho cùng khái niệm. **Chuẩn hoá dùng chung toàn tài liệu:**

| Khái niệm | Tên chuẩn (dùng từ đây) | Các tên chuyên gia đã dùng |
|---|---|---|
| Snapshot chỉ số/ngày/user | **`metric_snapshots`** | `capacity_snapshots`, `wellbeing_snapshots`, `metric_snapshots` |
| Event hành vi | **`app_events`** | `analytics_events`, `events`, `app_events` |
| Log can thiệp chữa lành | **`intervention_events`** | (thống nhất) |
| Rule/nội dung chữa lành | **`interventions`, `healing_content`** | (thống nhất) |

### 3.3. `metric_snapshots` — time-series lõi (MVP-0, làm đầu tiên)

**1 document/user/ngày**, doc-id = `${uid}_${YYYYMMDD}` (upsert, chống trùng — 1 ngày không tính 2 lần). Client tính sẵn (engine đã có), POST khi app mở lần đầu trong ngày (theo `dateLocal`, KHÔNG UTC — tránh lặp bug timezone cũ).

**Schema hợp nhất** (gộp field của cả 3 chuyên gia đề xuất):

| Nhóm | Field | Nguồn (code đã có) |
|---|---|---|
| Định danh | `uid`, `dateLocal` (YYYY-MM-DD), `tz`, `schemaVersion`, `appVersion` | client |
| Health Score (7) | `hsTotal`, `hsCashflow`, `hsBillCoverage`, `hsEmergencyRunway`, `hsBudgetDiscipline`, `hsGoalProgress`, `hsIncomePipeline` | `HealthScoreBreakdown` |
| **Health liên tục** | **`hsContinuous`** (0-100 mượt, chỉ cho R&D) | công thức mới (xem 5.2) |
| Năng lực (4) | `fds`, `tas`, `ips`, `mms` | `CapacityScores` — **VÀNG cho R&D** |
| Phân nhóm | `capacityGroupId`, `isHybrid` | `classifyCapacity` |
| Safe-to-Spend | `safeToSpend`, `safeIsNegative`, `runwayMonths`, `emergencyFundMonths` | `getSafeToSpendBreakdown` |
| Hành vi | `daysLoggedLast30`, `streakDays`, `overBudgetCount`, `txnCount30d`, `savingsRate` | `CapacityRawSignals`, `getOverBudgetCategories` |
| Dòng tiền (bucket/tổng hợp) | `netCashflowMonth`, `expenseMonth`, `incomeMonth` | `financeMetrics` |
| Cảm xúc | `fesScore`, `fesBand`, `euphoricFlag`, `stressScore`, `componentBreakdown{5}` | `computeFesScore` (mới, xem mục 7) |
| Scalar `users` | `rank`, `xp`, `plan`, `tier`, `isPremium`, `resistCount`, `totalResistSaved` | `users` |

Tải: ~40 số/ngày/user. 10.000 user × 365 ngày = 3.6M docs/năm — Firestore chịu tốt.

### 3.4. `app_events` — event stream (MVP-1, sau `metric_snapshots`)

Client gom event vào **Dexie table `event_queue`** (offline-first, giống transactions), flush batch: khi online + queue ≥20 events HOẶC mỗi 5 phút HOẶC app background. Retry backoff; fail thì giữ queue (không mất).

**Server tự tính `pseudoId = sha256(uid + APP_SALT)` — KHÔNG tin client hash.** Verify Firebase ID token của user trước khi ghi.

**Schema:** `{ pseudoId, event, ts (clientNow), dateLocal, sessionId, props, schemaV, platform, appVersion, consent }`

**MÂU THUẪN #3 — bao nhiêu event lõi để khởi động?**
- KTS: 3 event (`txn_logged` bucketed, `health_score_snapshot`, `capacity_snapshot`).
- Data/R&D: 8 event. Growth: 8 event. Product/IA: 6 event.

**→ PHÁN QUYẾT: khởi động đúng 8 event lõi** (đủ trả lời NSM + funnel + stress, không phình). Danh sách chuẩn hoá:

| # | event | props (ẩn danh — dùng `amountBucket`, KHÔNG số thật) |
|---|---|---|
| 1 | `transaction_logged` | `type:income\|expense`, `categoryId`, `amountBucket`, `hourLocal`, `fromSms:bool` |
| 2 | `impulse_resisted` | `categoryId`, `savedBucket` (khớp `resistCount`) |
| 3 | `impulse_indulged` | `categoryId`, `amountBucket` — **tín hiệu stress/relapse cực giá trị** |
| 4 | `streak_broken` | `prevLen` |
| 5 | `budget_exceeded` | `categoryId`, `overByPct_bucket` |
| 6 | `tier_transition` | `from`, `to` — **khoảnh khắc thắng** (poor→fair→good) |
| 7 | `report_viewed` | `scrollDepth` — proxy investment mindset |
| 8 | `upgrade_clicked` / `paywall_viewed` | `plan`, `trigger` |

**`amountBucket` chuẩn:** `<50k / 50-200k / 200k-1tr / >1tr` (PO xác nhận dải — mục 10, #7). Event bổ sung (`safe_to_spend_viewed`, `quest_completed`, `chat_message_sent`{intent,sentimentBucket}, `podcash_played`, `app_open/session`) thêm dần khi có câu hỏi cụ thể.

### 3.5. Consent — bắt buộc pháp lý + đạo đức

Thêm flag `analyticsConsent` trong `users` + 1 câu onboarding ("Cho phép dùng dữ liệu ẩn danh để cải thiện app?"). `consent !== 'granted'` → **không enqueue, không snapshot**. Telemetry phải nằm trong phạm vi `exportUserData` + `account_deletion_requests` đã có. Khớp RULE PO "user mới thấy số 0" + tinh thần offline-first.

### 3.6. Aggregation — đọc rollup, không scan raw

Nightly cron ghi `analytics_daily_rollup/{date}`. Màn admin chỉ đọc rollup, KHÔNG scan raw events mỗi lần mở (tiết kiệm read Firestore). **Filter `WHERE isTestAccount=false AND accountStatus!=test`** trong MỌI query R&D.

---

## 4. BẢN ĐỒ MODULE DASHBOARD (phần dài & quan trọng nhất)

Sidebar cố định, 9 module M0–M8. Ưu tiên tổng:

| Ưu tiên | Module | Lý do |
|---|---|---|
| **MVP** | M0 Overview · M1 Tiền · M2 User | Vận hành sống còn: thu tiền, cấp Pro, xử lý khiếu nại, đối soát |
| **P1** | M4 R&D (pipeline + dashboard tối thiểu) · M8 Audit | R&D là lý do tồn tại DN; audit là compliance |
| **Sau** | M3 Academy · M5 Marketing · M6 Chữa lành · M7 Config | Đã có CRM riêng / cần data chưa có / nice-to-have |

---

### M0 — Overview (Trang chủ admin) · MVP

**Mục đích:** 30 giây nắm sức khoẻ business + thấy "việc cần làm hôm nay". Màn mở mỗi sáng. **"Việc cần làm" quan trọng hơn KPI đẹp — admin một-người sống bằng queue.**

| Widget | Nội dung / Công thức | Nguồn |
|---|---|---|
| **KPI hàng trên (4 ô)** | MRR · Doanh thu hôm nay · Pro active · DAU | dưới |
| MRR | Σ gói active quy về tháng: 49k×1, 280k÷6, 539k÷12 | `users`(plan,premiumExpiresAt) + `payments_index` |
| Doanh thu hôm nay | Σ amount `payments_index` status=paid, ngày=today (giờ VN) | `payments_index` |
| Pro active | count `users` isPremium=true AND premiumExpiresAt>now | `users` |
| DAU | count `users` lastActiveDate=today | `users` |
| **Việc cần làm (queue)** | 3 hàng đợi badge số: (a) deletion pending, (b) refund pending, (c) **paid-nhưng-chưa-grant** | `account_deletion_requests`, CRM `list_refund_requests`, `payos_webhook_events`+`grant_events` |
| **Cảnh báo hệ thống** | webhook fail 24h · payment_intent kẹt >30ph pending · tỷ lệ grant lỗi | `payos_webhook_events`, `payment_intents`, `grant_events` |
| **Biểu đồ doanh thu 30 ngày** | line/bar theo ngày | `payments_index` |
| **Tân binh 7 ngày** | user mới/ngày | `users`(createdAt) |

**Hành động:** click queue → deep-link tới màn xử lý có filter sẵn. Overview chỉ *điều phối*, không xử lý tại chỗ.
**Quyền:** mọi vai; `support` không thấy ô tiền (MRR/doanh thu).
**MVP:** 4 KPI + queue + biểu đồ doanh thu. Cảnh báo nâng cao = P1.

---

### M1 — Tiền & Doanh thu · MVP

**Mục đích:** thấy mọi đồng tiền vào, đối soát PayOS, **không để "khách trả tiền mà không lên Pro"**. PayOS live đã bật thật → đây là module chạm tiền thật.

**M1.1 — Đơn hàng (bảng chính)**

| Cột | Nguồn |
|---|---|
| Thời gian · email/uid · gói · số tiền · trạng thái (pending/paid/failed/expired) · mã PayOS · đã grant? | `payment_intents` + `payments_index` + `grant_events` |

- **Lọc:** trạng thái · gói (49k/280k/539k/pack 20k/40k/100k) · khoảng ngày · "đã trả chưa grant" · email.
- **Hành động:** xem timeline intent (tạo→webhook→grant) · **grant thủ công** · đánh dấu đã xử lý.

**M1.2 — Đối soát PayOS** (`/admin/revenue/reconcile`) — **widget quan trọng nhất toàn admin**

3 danh sách "Lệch":
1. `payos_webhook_events`=paid NHƯNG không có `grant_events` → **nguy hiểm nhất** (khách mất tiền chưa có Pro).
2. `payment_intents`=pending >30 phút (webhook rớt/bỏ giữa chừng).
3. `grant_events` không map được `payments_index` (grant lạ/thủ công).

Hành động: re-trigger grant · đóng intent thủ công · ghi chú.

**M1.3 — Biểu đồ doanh thu:** theo ngày/tuần/tháng, tách theo gói, MRR trend, tỷ lệ gia hạn (intent mới quanh `premiumExpiresAt` cũ).
**M1.4 — Refund:** đọc CRM `list_refund_requests` + link sang CRM xử lý (refund tiền thật ở CRM/PayOS, không tự động hoá trong MVP).

**Nguồn:** `payment_intents`, `payments_index`, `grant_events`, `payos_webhook_events`, `trial_ledger`, `device_ledger`; refund từ CRM.
**Quyền:** `owner`+`ops`. `support` không vào.
**MVP tối thiểu sống còn:** M1.1 + grant thủ công + M1.2 danh sách paid-chưa-grant. Biểu đồ MRR/renewal + refund = P1.

---

### M2 — Người dùng / Khách · MVP

**Mục đích:** tra cứu bất kỳ user, cấp/thu Pro thủ công, xử lý khiếu nại & yêu cầu xoá, chặn lạm dụng.

**M2.1 — Danh sách user (bảng)**

| Cột | Nguồn |
|---|---|
| email · uid · rank (iron→diamond) · plan/tier · isPremium · premiumExpiresAt · streak · xp · lastActiveDate · accountStatus · isTestAccount | `users` |

Lọc: plan · isPremium · rank · accountStatus · isTestAccount · active X ngày · hết Pro trong 7 ngày (chăm renewal).

**M2.2 — Customer 360** (`/admin/users/[uid]`) — màn quan trọng nhất module, join tại UI qua email/uid. 5 khối:

| Khối | Nội dung | Nguồn |
|---|---|---|
| **A. Định danh & tài khoản** | uid, email, tên, accountStatus, isTestAccount, createdAt, lastActiveDate | `users` |
| **B. Tài chính-hành vi** | rank, xp, streak, resistCount, **totalResistSaved** (tín hiệu vàng "đang tốt lên") + healthScore/5 thành phần + FDS/TAS/IPS/MMS (từ `metric_snapshots`) | `users` + `metric_snapshots` |
| **C. Thương mại trong app** | plan, tier, isPremium, premiumExpiresAt, `payments_index` theo uid, grant_events, trial_ledger → suy ra proStatus (never/active/expired/churned), proMRR, #pack | `users`+`payments_index`+`payment_intents` |
| **D. Học tập & khóa học** | có phải learner · khóa đã mua · avgCompletion · gifted access · refund history | CRM `get_customer_profile`, `get_user_orders`, `list_gifted_access`, `list_refund_requests` |
| **E. Tương tác & vòng đời** | email gửi/mở/click · interaction · lead source · timeline hợp nhất | CRM `get_customer_timeline`, `list_customer_interactions`, `get_email_stats` |

**Hành động (ghi audit):** grant/revoke Pro (ghi `grant_events`+`admin_audit`) · ban/unban IP+uid · đánh dấu isTestAccount · ghi chú nội bộ. **`support` phải nhập `reason` trước khi mở 360° view** (log audit).

**M2.3 — Yêu cầu xoá tài khoản:** bảng `account_deletion_requests` (pending/processing/done) + hạn xử lý (compliance) + xác nhận xoá/từ chối.
**M2.4 — Ban list:** kế thừa trang `/admin` cũ (ban IP/uid + tạo/xoá test account), gộp vào đây.

**Quyền:** `owner`+`ops` full; `support` xem 360 (có lý do) + deletion + ban spam, KHÔNG grant Pro/sửa tier.
**MVP:** M2.1 + tìm theo email + M2.2 (phần Firestore) + grant/revoke + M2.3 + M2.4. Ghép data học viên CRM = P1.

> **Chính kiến kỹ thuật:** KHÔNG cho client Firebase SDK query cả collection `users`. Phân trang + tìm kiếm qua API route server-side (Admin SDK). Tìm theo email cần field chuẩn hoá `emailLower` + index Firestore.

---

### M3 — Học viên & Khóa học · Sau (deep-link, KHÔNG dựng lại LMS)

**Chính kiến thẳng (đồng thuận):** hệ CRM/LMS DuongQuang.Academy **đã có đầy đủ** (learners, course parts, lessons, video/thumbnail, gifted access, orders). Xây lại = phí tháng công.

- **MVP module = trang "cổng":** KPI đọc từ CRM (`get_admin_stats`, `list_learners` count, `list_course_parts`) + nút deep-link sang admin CRM để thao tác thật.
- Đây cũng là nơi **duyệt tay `identity_links` confidence<100** (mục 1.4).
- Chỉ khi CRM chưa có admin UI mới cân nhắc facade REST + màn mỏng cho tác vụ hay dùng: `list_learners`, `grant_access`/`revoke_access`, `list_gifted_access`, `upsert_course_part`/`add_lesson`/`set_lesson_video`.

**Widget cổng:** tổng học viên · khóa đang bán · doanh thu khóa (`get_revenue_chart`) · refund pending · gifted access active.
**Quyền:** `owner`+`ops`.

---

### M4 — R&D Hành vi tài chính · P1 (CẦN pipeline trước)

**Mục đích:** trả lời câu hỏi cốt lõi của DN — **"người dùng có đang TỐT LÊN theo thời gian không?"** — và phân khúc để can thiệp. Đây là deliverable cho câu chuyện đăng ký DN R&D + gọi vốn + miễn thuế.

**Chặn cứng:** rỗng nếu chưa có `metric_snapshots` + `app_events` (mục 3). Widget (sau khi có pipeline):

| Widget | Loại | Nội dung / Công thức | Câu hỏi kinh doanh |
|---|---|---|---|
| **FWI Cohort Trajectory** | Line (X=tuần từ signup) | median FWI theo tuần-thứ-N kể từ onboarding, mỗi đường = 1 cohort tháng | Sản phẩm có làm người ta tốt lên thật không? (NSM #1) |
| **Tier-transition Sankey** | Sankey | poor→fair→good; đếm % thoát nhóm rủi ro, ai tụt hạng | Bao nhiêu % thoát rủi ro? |
| **% "tốt lên"** | Số | share user có (fds_now − fds_first)>0 trong 30/90 ngày | Tỷ lệ cải thiện |
| **FDS→IPS lag correlation** | Scatter/heatmap | cross-correlation lag giữa chuỗi FDS và IPS | Kỷ luật có kéo tiềm năng thu nhập tăng? (**proof cho pitch R&D**) |
| **Health Score trend theo plan** | Line | median healthScore theo thời gian, tách Pro vs Free | Pro có tốt hơn Free? (bằng chứng marketing) |
| **Streak Survival Curve** | Kaplan-Meier | X=độ dài streak, Y=% còn sống → tìm "điểm gãy" (thường ngày 3-5) | Đặt intervention ở đâu? |
| **Logging-regularity → Retention** | Grouped retention | chia user theo logging_rate tuần 1 (0-2/3-5/6-7) → retention D30 | Tuần đầu ghi mấy ngày thì giữ chân? → mục tiêu onboarding |
| **Segment distribution** | Stacked area | 5 khúc theo thời gian | Khúc nào phình? Stressed có tăng? (guardrail) |
| **Explorer 1 user** | Time-series | chọn uid → 4 chỉ số + healthScore (nối M2 360) | Soi ca cụ thể |
| **Data-honesty flag** | Table | user hsTotal cao nhưng daysLoggedLast30<5 (điểm đẹp giả) | Lọc nhiễu |

**Hành động:** export cohort CSV cho nghiên cứu · đẩy phân khúc sang M6/M5.
**Nguồn:** `metric_snapshots`, `app_events`, `analytics_daily_rollup`, join `users`.
**Quyền:** `owner`/`analyst` (analyst thấy `pseudoId`, KHÔNG thấy PII).
**MVP P1:** pipeline + 3 widget lõi (FWI Cohort Trajectory · % tốt lên · Pro↔tiến bộ). Còn lại = sau.

> **Chính kiến kép:** (1) Ghi snapshot chỉ số, TUYỆT ĐỐI không kéo raw giao dịch lên chỉ để làm dashboard. (2) Chỉ số đầu kỳ dễ nhiễu (user mới nhập lèo tèo) → chỉ tính "tốt lên" từ mốc user đã có ≥N ngày dữ liệu, nếu không cohort sẽ dối.

---

### M5 — Marketing & Chiến dịch · Sau (deep-link CRM)

**Chính kiến:** email engine đã có ở CRM → module này là **cổng đọc + deep-link**, KHÔNG dựng lại.

**Widget cổng:** funnel stats (`get_funnel_stats`) · email stats (`get_email_stats`) · list templates/steps (`list_email_templates`, `list_email_steps`) · tactics (`list_marketing_tactics`) · nút **gửi test email** (`send_test_email` — tác vụ duy nhất đáng nhúng trực tiếp).

**Điểm nối giá trị:** đẩy phân khúc từ M4/M6 vào audience CRM. **MVP = CSV export** danh sách email theo phân khúc → import CRM (không cần tích hợp API).
**Quyền:** `owner`+`ops`.

---

### M6 — Giữ chân & Chữa lành tài chính · Sau (chi tiết ở mục 7)

**Mục đích:** phát hiện user căng thẳng tài chính → can thiệp (podcash/mini-game/nội dung/ưu đãi) → đo hiệu quả.
**Chặn cứng:** phụ thuộc `app_events` + `metric_snapshots`. Không có nền M4 thì không phát hiện được stress.

**Màn & widget:**
- **Bảng user theo stress level** + xu hướng (đang xấu đi?).
- **Cấu hình intervention (rule đơn giản):** "IF stress=căng AND plan=Free → podcash X + ưu đãi khóa Y". Lưu `interventions` (rule) + `intervention_events` (đã bắn cho ai/khi nào/kết quả).
- **Thư viện nội dung:** podcash (audio), healing tips, mini-game — metadata + bật/tắt (`healing_content`).
- **Đo hiệu quả:** Δstress sau 7/14 ngày (so `metric_snapshots` trước/sau) · retention D7/D30 nhóm can thiệp vs holdout.

**Quyền:** `owner`. Chi tiết mô hình cảm xúc + thang can thiệp + đạo đức ở **mục 7**.

---

### M7 — Nội dung & Cấu hình · Sau (một phần P1)

| Widget | Nội dung | Nguồn |
|---|---|---|
| **Feature flags** | bật/tắt `NEXT_PUBLIC_MONEY_SYNC_ENABLED`, demo mode, flag runtime | `config_flags` (mới, có fallback về env nếu Firestore lỗi) |
| **Pricing** | xem/sửa giá gói + pack, hiệu lực từ ngày | `config_pricing` — chỉ `owner` |
| **Quest/Badge** | xem cấu hình daily/weekly quest, badge | đọc từ `src/data/`; sửa runtime = sau |
| **Seed/Demo gate** | trạng thái `NEXT_PUBLIC_DEMO_MODE`, kiểm "không rò seed vào prod" | env + kiểm tra |
| **Intervention Config** | ngưỡng band, bật/tắt can thiệp, variant, cooldown | `remote_config` |

**Chính kiến:** **Pricing MVP chỉ ĐỌC** (hiển thị giá hiện hành để đối chiếu). Sửa giá runtime nếu lệch PayOS/logic grant sẽ sinh đơn sai tiền → chỉ làm rất sau khi có test. Feature flag runtime đáng làm sớm hơn (P1) vì PO hay bật/tắt sync — nhưng phải có fallback env.
**Quyền:** `owner` duy nhất.

---

### M8 — Nhật ký & Bảo mật · P1

- **Admin audit log:** bảng `admin_audit` (đã có) — actor, action, target, ts, ip, before/after, reason?. Lọc theo actor/loại/ngày. **MỌI hành động ghi (grant, ban, delete, sửa config, link identity) BẮT BUỘC ghi audit — bất biến toàn admin.**
- **Quản vai trò:** danh sách admin + claim, cấp/thu quyền (set Custom Claims + `checkRevoked`).
- **Phiên đăng nhập:** phiên admin đang mở, revoke token (force re-login).
- **Webhook health:** `payos_webhook_events` gần đây + `webhook_tokens`/`recent_msgs`/`pending_transactions` (SMS ngân hàng auto-ghi).

**Nguồn:** `admin_audit`, Firebase Auth (claims/sessions), `payos_webhook_events`, `webhook_tokens`.
**Quyền:** `owner` quản vai+phiên; các vai xem audit của chính mình.
**MVP P1:** đọc `admin_audit`. Quản vai UI + revoke phiên = sau (MVP set claim bằng script).

---

## 5. Tầng R&D hành vi & cách đo "người tốt lên"

### 5.1. North-star metric + Guardrails

**NSM = `Weekly Financially-Improving Active Users` (W-FIAU):** số user trong tuần vừa (a) active ghi sổ ≥3 ngày/tuần VÀ (b) có `hsTotal` slope ≥0 qua 4 tuần.

**Vì sao không phải DAU/doanh thu:** sản phẩm hứa giúp người ta **tốt lên tài chính** → NSM phải khóa vào chính lời hứa đó, nếu không sẽ tối ưu nhầm sang addiction/vanity. Doanh thu là **hệ quả**, không phải NSM.

**Input metrics (đòn bẩy):** `logging_rate` (ngày ghi/7) · `resist_rate` (resistCount tăng / cảnh báo impulse) · `report_view_rate`, `safe_to_spend_view_rate` (proxy investment mindset).

**Guardrails (không được xấu đi khi đẩy NSM):**
- **Retention D7/D30** — chống tối ưu ngắn hạn giết dài hạn.
- **Streak-anxiety proxy** — % `streak_broken` → churn trong 3 ngày. Gamification tạo áp lực khiến người gãy streak bỏ luôn = đỏ.
- **Financial-stress rate** — % user tuần có ≥1 tín hiệu stress. NSM tăng mà stress tăng = tăng trưởng độc hại.
- **Refund/chargeback rate** (CRM + `payment_intents`).
- **Report-honesty proxy** — % user hsTotal cao nhưng `daysLoggedLast30<5` (điểm đẹp giả do engine default trung tính 40-50 khi "chưa đo").

### 5.2. Đo "Tiến bộ tài chính" — deterministic

**Định nghĩa "cải thiện"** (OLS slope cửa sổ trượt 4 tuần trên `hsTotal` cuối tuần):
```
slope_hs = OLS_slope(hsTotal[w-3..w])   // điểm/tuần
improving := slope_hs >= +1.0  (bền ≥3/4 tuần)
stable    := -1.0 < slope_hs < +1.0
declining := slope_hs <= -1.0
```

**Tier-transition** (dùng `getHealthTier()`: poor<40/fair 40-69/good≥70): ghi `poor→fair`, `fair→good` — "khoảnh khắc thắng" để (a) chúc mừng in-app, (b) làm testimonial, (c) trigger upsell đúng lúc.

**LỖ HỔNG đo lường phải vá — `hsContinuous`:** Health Score hiện là **bậc thang thô** (`cashflow` chỉ 0/12/25, `billCoverage` 0/10/20). User cải thiện thật nhưng chưa vượt ngưỡng → điểm đứng im → slope=0 → tưởng giậm chân. **Thêm `hsContinuous` (0-100) tính song song bằng công thức liên tục** (vd `cashflow_cont = clamp(net/income,0,1)*25`), CHỈ dùng cho R&D trajectory, KHÔNG thay điểm hiển thị (giữ bậc thang cho narrative Lord Diamond ổn định). Ghi cả 2 vào snapshot. **Bỏ qua điểm này thì cả hệ đo tiến bộ sẽ nhiễu.**

**Financial Wellbeing Index (FWI) — 1 con số cho PO nhìn:**
```
FWI = 0.50 * hsContinuous
    + 0.25 * clamp(runwayMonths/6,0,1)*100
    + 0.15 * min(logging_rate_30d,1)*100
    + 0.10 * resist_effectiveness
```
FWI vừa đo **trạng thái** vừa có **thành phần hành vi** (logging, resist) nên khó "ăn gian" bằng nhập số đẹp. **North-star trajectory chính = slope của FWI theo cohort.**

**Time-series 4 chỉ số năng lực:** câu chuyện R&D đắt nhất — **FDS (kỷ luật) tăng có kéo IPS (tiềm năng thu nhập) tăng theo sau N tuần không?** Đo bằng cross-correlation lag. Có = bằng chứng "app khiến người ta kiếm tiền tốt hơn" → pitch gọi vốn/DN R&D.

**Cohort trajectory chart:** X = "tuần thứ N kể từ đăng ký" (KHÔNG phải ngày lịch), Y = FWI trung vị cohort. Biểu đồ **duy nhất trả lời "sản phẩm có làm người ta tốt lên không"** không chối cãi được.

### 5.3. Điểm mù phải vá trước khi tin số
1. **Timezone** — snapshot theo `dateLocal`, KHÔNG UTC (đừng lặp bug UTC→local cũ).
2. **Loại test** — `WHERE isTestAccount=false` trong mọi query R&D.
3. **De-dup** — doc-id `uid_yyyymmdd` (upsert), 1 ngày không tính 2 lần làm lệch retention.
4. **Chỉ số đầu kỳ nhiễu** — chỉ tính "tốt lên" từ mốc ≥N ngày dữ liệu.

---

## 6. Tầng CRM & Growth

### 6.1. Customer 360
KHÔNG phải bảng mới — là **view hợp nhất theo uid** kéo từ 5 nguồn (đã mô tả ở M2.2). MVP = hàm `getCustomer360(uid)` gọi song song Firestore + CRM facade rồi ghép 5 card. 1-2 ngày công. KHÔNG đồng bộ toàn bộ `users` sang Postgres.

### 6.2. Lifecycle stages — state machine 8 trạng thái

| Stage | Định nghĩa | Tín hiệu chuyển (nguồn) |
|---|---|---|
| **S0 Visitor** | Vào landing, chưa đăng ký | `landing_view` (cần telemetry) |
| **S1 Signed-up** | Có `users/{uid}`, chưa nhập giao dịch | `createdAt` tồn tại |
| **S2 Activated** | ghi ≥5 giao dịch trong 3 ngày đầu HOẶC streak≥3 | `streak≥3` (users) hoặc `transaction_logged≥5` |
| **S3 Engaged** | dùng đều, streak sống, quay lại tuần 2+ | `lastActiveDate` trong 7 ngày + streak |
| **S4 Pro** | đang trả phí | `isPremium=true` & `premiumExpiresAt>now` |
| **S5 Course buyer** | mua khóa | CRM `get_user_orders` |
| **S6 Coach/High-ticket** | mua coach | order coach (CRM) |
| **S7 At-risk/Dormant** | sắp/đã rời | `lastActiveDate>14 ngày`, hoặc Pro sắp hết chưa gia hạn, hoặc streak gãy sau chuỗi dài |

**Chính kiến về Activation:** activation KHÔNG phải "đăng ký" mà là **khoảnh khắc thấy giá trị lần đầu** = nhập đủ giao dịch để Safe-to-Spend/Health Score có nghĩa. Chốt định nghĩa cứng (**≥5 giao dịch/3 ngày HOẶC streak 3**) và đo `CR_activation = S2/S1` — **chỉ số bắc cầu quan trọng nhất toàn phễu**.

Lưu `lifecycleStage` + `lifecycleUpdatedAt` vào `users/{uid}`, cập nhật bằng hàm thuần `computeLifecycleStage()` khi active hoặc cron ngày.

### 6.3. Segment — rule-based, KHÔNG ML

Viết như **hàm predicate thuần** (`isChampion`, `isProExpiringSoon`, `isStressed`) trong `segments.ts`. KHÔNG dựng segment-builder UI. Chỉ nghĩ k-means khi có ≥vài nghìn user active.

| Nhóm | Tín hiệu | Hành động |
|---|---|---|
| **RFM Champions / Loyal Pro / Big-spender ngủ đông / One-time pack** | R=ngày từ mua gần nhất · F=#đơn · M=tổng NET | upsell coach / nurture lên Pro |
| **Theo tier** | Free-active/dormant · Trial · Pro-active · Pro-sắp-hết (7 ngày) · Pro-churned | renewal/win-back |
| **Kỷ luật (Disciplined)** | `budgetDiscipline=15`+`overBudgetCount=0`+`logging_rate≥0.7`+`hsTotal≥70` | upsell Course/Coach + mời testimonial khi tier-transition |
| **Bốc đồng (Impulsive)** | `overBudgetCount≥2`+`netCashflow<0`+resist thấp | bật mạnh resist + Safe-to-Spend |
| **Theo NĂNG LỰC** | IPS thấp+TAS cao → khóa kiếm tiền số · FDS thấp đang cải thiện → mời Pro đúng đỉnh động lực · MMS cao+FDS cao → Coach+CV share · FDS cao+IPS thấp kéo dài → khóa tăng thu | nhắm sản phẩm theo chỉ số |
| **Căng thẳng (Stressed)** | composite stress (mục 7) | **chữa lành, KHÔNG upsell** |
| **Ngủ đông / Khai phá** | không snapshot ≥7 ngày / `capacityGroupId=general`+tuổi<14 ngày | win-back nhẹ / onboarding tiếp |

### 6.4. Campaign — 7 flow cụ thể, KHÔNG engine tổng quát

Kiến trúc: **Trigger → segment → kênh → nội dung → đo**. Tái dùng CRM email (`upsert_email_template`, `upsert_email_step`, ...).

**Phân kênh:** In-app (chủ lực, real-time, PO kiểm soát 100%) · Push (win-back/renewal, đừng spam) · Email drip qua CRM (nurture dài, app→academy) · Coupon (`grant_events`).

**Nguyên tắc chống chồng chéo: một event → một owner.** "Pro sắp hết hạn" → ManiCash lo (in-app+push); "chào khóa học" → CRM lo (email).

7 flow theo ROI: **(1) Onboarding activation** (S1→S2, quan trọng nhất) · (2) Pro paywall theo ngữ cảnh · (3) Win-back streak (3/7/14 ngày) · (4) Pro renewal (T-7/T-1/T+3) · (5) App→Academy bridge · (6) Stress-care flow (hoãn mọi chào bán) · (7) Refund save.

### 6.5. Phễu doanh thu đa tầng + KPI (công thức)

**Phễu:** Free → Activated → Pro → Credit pack → CV năng lực → Khóa học → Coach.

**Conversion:** `CR_activation = S2/S1` (north-star bắc cầu) · `CR_free_to_pro` · `CR_pro_to_course` · `CR_course_to_coach` · `CR_pack_attach`.

**Metric tiền:**
- **MRR** = Σ Pro quy về tháng (49k×1 · 280k→46.7k/th · 539k→44.9k/th). KHÔNG tính pack/khóa (one-time riêng).
- **ARPU** = NET/tổng active · **ARPPU** = NET/user trả tiền.
- **Doanh thu NET** = gross (`payments_index`+CRM orders) − refunds − phí PayOS. **Luôn báo NET, không gross.**
- **Churn Pro** = không gia hạn/kỳ; theo dõi **logo churn** + **revenue churn** riêng.
- **LTV** giai đoạn đầu = tổng NET TB/khách trả tiền theo cohort (ít giả định). **CAC** hiện ~0đ (organic) nhưng tạo field `leadSource` (`add_lead_source`) sẵn. **LTV:CAC ≥ 3** mới scale ads.

**Chính kiến về giai đoạn:** với 1 learner / 2 orders / 399k, **đừng ám ảnh LTV/cohort** — mẫu quá nhỏ, vô nghĩa. Chỉ đo **3 số:** `CR_activation`, `CR_free_to_pro`, **doanh thu NET tuyệt đối**. Cohort/dự báo để dành khi ≥vài trăm payer.

**Tín hiệu "sẵn sàng mua" (lead nóng):** đừng đo funnel như phễu tuyến tính cứng — bản chất là **flywheel giá trị**. User vừa có tier-transition tích cực + xem report ≥2 lần + resist thành công = **lead nóng cho Pro/Course**. Bắn đúng thời điểm này chuyển đổi cao hơn nhiều popup đại trà.

### 6.6. Growth loops (4 loop, tận dụng gamification + CV)

1. **CV năng lực chia sẻ (viral loop chính, ưu tiên cao nhất — khác biệt không ai copy được):** user tạo CV (PDF+slug+QR) hiện FDS/IPS/MMS đẹp + branding → share → người xem click slug → signup. Đo bằng `leadSource='cv_share'` + UTM. Chỉ mở CV "đẹp/đầy đủ" cho user đạt mốc → gamification nuôi viral.
2. **Referral gắn XP/rank:** mời bạn → cả 2 nhận XP/pack nhỏ. Chống gian lận bằng `device_ledger`.
3. **Milestone khoe:** đạt "kháng chi X triệu"/streak 30/lên rank → share card (`totalResistSaved` là nội dung khoe cực tốt).
4. **Content loop:** podcash công khai → thu hút người stress → CTA cài app → stress-care flow.

---

## 7. Tầng Giữ chân & Chữa lành tài chính

> **Cảnh báo nền:** tầm nhìn "phát hiện stress → can thiệp" chỉ khả thi khi telemetry (mục 3) đã chạy. Mô hình cảm xúc chính xác **phải chạy CLIENT-SIDE** (nơi có transaction thật), chỉ đẩy lên server **chỉ số tổng hợp đã ẩn danh** (stress/fes score + band), KHÔNG đẩy raw transaction, KHÔNG đẩy nội dung chat.

### 7.1. Mô hình Trạng thái Cảm xúc-Tài chính (FES) — 5 band + 1 cờ

`fesScore` (0-100, client-side, cập nhật mỗi giao dịch/mở app), phân 5 band:

| Band | Code | fesScore | Ý nghĩa | Màu Lord Diamond |
|---|---|---|---|---|
| An tâm | `serene` | 80-100 | Kiểm soát tốt | Xanh ngọc |
| Ổn định | `steady` | 60-79 | Bình thường | Xanh dương |
| Lo lắng | `anxious` | 40-59 | Chớm căng | Vàng hổ phách |
| Căng thẳng | `strained` | 20-39 | Áp lực rõ | Cam |
| Khủng hoảng | `crisis` | 0-19 | Nguy cơ cao | Đỏ (không rung, không confetti) |

**Cờ riêng thứ 6 — `euphoricFlag`** (hưng phấn tiêu xài, năng lượng cao + kiểm soát thấp — không nằm trên trục stress): `dailySpend_today > 2.5·mean(30d)` VÀ sentiment chat phấn khích VÀ runway chưa crisis.

**Công thức:**
```
fesScore = 100 − (0.30·Runway + 0.25·Volatility + 0.20·BudgetBreach + 0.15·ImpulseRate + 0.10·SentimentPenalty)
```
- **Runway** = từ Safe-to-Spend engine: `runwayDays = safeToSpend/avgDailySpend`; ≥45→0, ≤3→100.
- **Volatility** = hệ số biến thiên chi 14 ngày `stdev/mean`.
- **BudgetBreach** = `breachedCategories/totalBudgetedCategories·100` (moneyBrain).
- **ImpulseRate** = tần suất giao dịch bốc đồng 7 ngày (đêm 22h-3h hoặc category giải trí/mua sắm > ngưỡng cá nhân).
- **SentimentPenalty** = tín hiệu từ chat (7.2).

**Hợp nhất với Stress Score (Data/R&D + Product/IA):** `fesScore` (0-100, đảo chiều) và `stressScore` là 2 mặt của cùng một trục. Dùng **`stressScore` deterministic** để phân mức hành động, `fesBand` cho UI/tông giọng:
```
stressScore = 30·(safeIsNegative?1:0) + 20·clamp(overBudgetCount/3,0,1)
            + 15·(netCashflowMonth<0?1:0) + 15·clamp(unpaidBills/income,0,1)
            + 10·volatility_expense_14d + 10·negativeChatRatio_7d
```
Tín hiệu bổ sung mạnh: cụm `impulse_indulged` tăng vọt sau chuỗi resist (vỡ trận); ghi sổ đêm khuya 0-4h (lo âu); `streak_broken`+`safeIsNegative` cùng tuần.

**Lưu lên server (`metric_snapshots`):** chỉ `{fesScore, fesBand, euphoricFlag, stressScore, componentBreakdown{5}, source:'client'}`. KHÔNG message, KHÔNG số dư. **Ranh giới cứng.**

### 7.2. Sentiment từ chat — mỏ vàng đang bỏ phí

Lord Diamond đã đọc mọi tin nhắn. Thêm sentiment classifier vào system prompt Groq/OpenAI, trả JSON kèm mỗi lượt:
```json
{ "reply":"...", "emotionalSignal":{ "valence":-0.7, "arousal":0.6, "financialStressCues":["hết tiền","lo","vay","kẹt"], "confidence":0.8 } }
```
Bắt cụm tiếng Việt: *"hết tiền","cháy túi","vay tạm","lương chưa về","không đủ","stress","nợ","gồng"*. `SentimentPenalty` = EMA valence âm × arousal 7 ngày.

**Cảnh báo (Data/R&D):** sentiment tiếng Việt bằng lexicon rất noisy → weight thấp (10%), KHÔNG lệ thuộc. **Đừng gọi LLM chấm sentiment từng tin** (tốn credit, chậm) — dùng lexicon nhẹ đếm từ khóa; JSON kèm reply là cách rẻ vì tận dụng lượt LLM đã có.

### 7.3. Thang can thiệp (Intervention Ladder)

**Nguyên tắc vàng: can thiệp tỉ lệ NGHỊCH với sự phô trương.** Người khủng hoảng KHÔNG cần confetti/quest/"mua ngay" — cần hạ nhiệt trước, bán sau (hoặc không bán).

| Band | Can thiệp | Tông Lord Diamond | Chào bán? |
|---|---|---|---|
| `serene`/`steady` | Không can thiệp, chỉ củng cố (streak, badge) | Vui, tưởng thưởng | Được — upsell tự nhiên |
| `anxious` | Nudge nhẹ 1 câu trấn an + 1 hành động nhỏ; mở CalmBox nếu sắp chi lớn | Ấm, đồng hành | Rất nhẹ, chỉ podcash miễn phí |
| `strained` | Podcash + mini-game thở/tiết kiệm + no-spend 3 ngày; ẩn bớt gamification ồn | Chậm, vững, không phán xét | **KHÔNG bán trả phí** |
| `crisis` | **Tắt gần hết gamification**; "Thở cùng nhau"; đề nghị Coach người thật (nếu miễn phí buổi đầu) hoặc hotline; "kế hoạch 7 ngày sống sót" | Rất bình tĩnh, tối giản | **TUYỆT ĐỐI KHÔNG bán** |
| `euphoric_spending` | **CalmBox bắt buộc** trước giao dịch lớn + câu hỏi phản tư 24h | Vui nhưng kéo phanh | Không bán |

Cơ chế: hàm client `resolveIntervention(fesBand, euphoricFlag, context)` → mỗi action có `cooldown` (tối đa 1 can thiệp nặng/ngày) + `dismissible:true`. Ghi `intervention_shown/engaged/dismissed`.

### 7.4. Gamification giữ chân có chiều sâu

**Nguyên tắc bất di bất dịch:** **Thưởng cho hành vi TÀI CHÍNH TỐT (tiết kiệm, kháng chi, ghi đều), KHÔNG BAO GIỜ thưởng cho TIÊU nhiều.** Nếu XP tăng khi chi tiêu = dạy họ phá sản để lên hạng = ranh giới app chữa lành vs casino.

- **Streak = "ngày ghi nhận tài chính / kháng chi thành công"** (KHÔNG phải "mở app"). Thêm **streak freeze/tấm khiên** (1-2/tháng, Pro nhiều hơn) — giải độc loss-aversion (gãy chuỗi dài → nhiều người bỏ hẳn).
- **Variable reward** vào **hộp thưởng khi kháng chi** (XP/lời khen/hạt giống Cây Tiết Kiệm/mảnh badge hiếm). **KHÔNG áp vào việc mở ví/tiêu tiền.**
- **Endowed progress:** quest đầu hoàn thành sẵn 20% ("2/10 bước").
- **Bản sắc "Chiến binh tài chính":** chuyển "bạn làm nhiệm vụ" → "bạn LÀ người kỷ luật". Gắn 7 hạng iron→diamond + 4 chỉ số FDS/TAS/IPS/MMS như "chỉ số nhân vật RPG".
- **Social proof ẩn danh:** KHÔNG leaderboard tiền (độc hại). Thay bằng norm nhẹ "người cùng hạng Bạc tuần này kháng chi TB 8 lần — bạn 11 lần, top đầu" (chỉ khi user thắng).

**KHÔNG:** đếm ngược giả, popup "sắp mất hạng!", streak không phanh, thưởng chi tiêu, push dồn dập.

### 7.5. Mini-game & tính năng chữa lành (4 cái, theo ROI)

**Ưu tiên build: CalmBox → SavingsTree → Podcash → NoSpendArena → MoneyGratitude.**

1. **Hộp Bình Tĩnh (`CalmBox`) — ROI cao nhất, làm đầu.** Chắn giữa "muốn mua" và "đã mua" cho giao dịch >2× chi tiêu ngày TB: thở 10s + câu hỏi phản tư + nút "Chờ 24h" (đưa vào danh sách chờ Dexie). Rẻ build (1 modal + 1 list), tác động hành vi lớn nhất.
2. **Cây Tiết Kiệm (`SavingsTree`):** mỗi lần kháng chi/no-spend → cây lớn (nhiên liệu = `totalResistSaved` sẵn có); héo nếu bỏ bê nhưng **không chết hẳn** (tránh loss-aversion độc). Framer Motion.
3. **Podcash (podcast chữa lành):** MVP = 5 audio tĩnh (Firebase Storage) 5-10 phút ("Khi lương chưa về", "Hết tiền cuối tháng không phải thất bại"). 1 player đơn giản; Lord Diamond gợi ý theo band.
4. **Đấu trường No-Spend (`NoSpendArena`):** thử thách 3/7/30 ngày không chi giải trí/mua sắm, solo hoặc ghép cặp ẩn danh cùng hạng.
5. **Nhật ký Biết ơn Tiền bạc (`MoneyGratitude`):** 1 dòng/ngày, chống scarcity mindset, nuôi thẳng MMS.

### 7.6. RANH GIỚI ĐẠO ĐỨC (viết thành `docs/ETHICS_CHARTER.md`, ép trong code)

**Đồng thuận mạnh nhất giữa 3 chuyên gia — đây là tài sản kinh doanh, không phải mục cho có:**

1. **Không bán khi user ở `strained`/`crisis`.** Enforce cứng trong `resolveIntervention` — chặn mọi upsell/CTA trả phí. **Bán coach 4.99tr cho người khủng hoảng = dark pattern nghiêm trọng + rủi ro pháp lý.** Chỉ được đề nghị buổi đầu miễn phí; bán high-ticket chỉ khi về `steady`.
2. **Không thưởng XP cho chi tiêu.** Test: `earnXP` không được gọi từ luồng expense.
3. **Mọi can thiệp `dismissible` + có toggle tắt** ("Chế độ tối giản không gamification").
4. **Minh bạch:** trang giải thích "ManiCash đọc cảm xúc thế nào & để làm gì", nói rõ dữ liệu tài chính không rời máy.
5. **Không tạo lo âu giả** (đồng hồ đếm ngược giả, khan hiếm giả).
6. **Không nhắm người yếu thế bằng quảng cáo.** `crisis` chỉ nhận nội dung miễn phí/hỗ trợ.
7. **Có "van thoát":** luôn có chế độ "chỉ ghi chép, tắt hết game".

### 7.7. Đo hiệu quả can thiệp (`intervention_events` + A/B holdout)

`intervention_events`: `{uid(hash), ts, band, interventionType, action:shown|engaged|dismissed, variant}`.
**A/B gọn:** `variant = hash(uid)%2`. **Bắt buộc có holdout** (10% user `strained` KHÔNG can thiệp làm đối chứng — chuẩn vàng nhiều người quên). Đo: uplift retention D7/D30 (engaged vs holdout) · Δ`fesScore` T vs T+1 · engagement rate (`engaged/shown`).

### 7.8. Dashboard "Sức khoẻ Cảm xúc & Giữ chân" (widget M6)

1. **Phân bố FES band** (donut) — số `crisis` là đèn cảnh báo đạo đức.
2. **Đường "Tốt lên theo thời gian"** (line, cốt lõi tầm nhìn PO) — TB fds/tas/ips/mms + fesScore theo cohort/tuần.
3. **Uplift retention** (engaged vs holdout D7/D30).
4. **Phễu can thiệp** (shown→engaged→hạ band).
5. **Heatmap euphoric_spending** theo giờ/ngày (chèn CalmBox đúng lúc).
6. **Cohort chuyển band** (Sankey: `strained→steady` thắng vs `steady→strained` mất) — **KPI sức khoẻ thật, quan trọng hơn DAU.**
7. **Danh sách "cần chăm sóc"** (`crisis` ≥2 tuần) — để hỗ trợ, KHÔNG bán.

---

## 8. Phân quyền & bảo mật

### 8.1. MÂU THUẪN #4 — 5 vai trò hay 3 vai trò?

- **KTS hệ thống:** 5 vai (`super-admin`, `analyst`, `support`, `content`, `marketing`) với PII-anonymization.
- **Product/IA:** 3 vai (`owner`, `ops`, `support`) — "PO làm một mình, đừng dựng ma trận 10 vai".

**→ PHÁN QUYẾT: MVP triển khai 3 vai (owner/ops/support), NHƯNG dùng schema mảng `adminRoles[]` mở rộng được** để thêm `analyst`/`marketing` khi thực sự cần (lúc mở R&D dashboard hoặc thuê người ngoài xem data). Lý do: PO đang một mình → 3 vai đủ; nhưng `analyst` (chỉ thấy `pseudoId`, không PII) có giá trị thật khi đăng ký DN R&D / cho bên thứ ba xem — nên đừng khoá cứng ở boolean.

**Custom Claims schema (set qua Admin SDK, KHÔNG tự viết JWT):**
```ts
await admin.auth().setCustomUserClaims(uid, {
  admin: true,                    // giữ tương thích ngược
  adminRoles: ['owner'],          // mảng: owner|ops|support|analyst|marketing
  adminRoleVersion: 2,            // bump để force re-login khi đổi policy
});
```

### 8.2. Ma trận quyền hợp nhất

| Role | Tiền/Revenue | User/CRM | R&D behavior | Healing | User PII | Admin mgmt |
|---|---|---|---|---|---|---|
| `owner` (=super-admin) | RW | RW | R | RW | R (full) | RW |
| `ops` | R | RW | R | — | R (full) | — |
| `support` | — | R | — | — | R (**cần nhập lý do**) | — |
| `analyst` (mở rộng sau) | R | R | **RW** | R | **ẩn danh (pseudoId)** | — |
| `marketing` (mở rộng sau) | R (aggregate) | R | R | RW | ẩn danh | — |

**Chính sách PII (chính kiến, giúp ngủ ngon khi đăng ký DN R&D + Apple/Google/luật VN soi):** `analyst`/`marketing` **không bao giờ** thấy tên/email/uid thật ở màn R&D — chỉ `pseudoId` (hash). `support` thấy PII **có ràng buộc lý do** (bắt nhập `reason` trước khi mở 360° view → log `admin_audit`).

### 8.3. Guard tầng BFF
```ts
export const GET = withAdminRole(['analyst','owner'], async (req, ctx) => {...});
// verifyIdToken → checkRevoked → decoded.adminRoles ∩ required ≠ ∅
// MỌI call ghi admin_audit: { adminUid, roles, action, target, ts, ip, reason? }
```
- Client Firebase SDK KHÔNG đọc thẳng collection lớn — mọi thứ qua API route Admin SDK.
- Telemetry ingest (`/api/telemetry/*`) là public-auth (verify user ID token), KHÔNG cần admin.
- Consent + telemetry phải nằm trong phạm vi `exportUserData` + `account_deletion_requests`.

---

## 9. LỘ TRÌNH theo phase

Hợp nhất lộ trình 5 chuyên gia thành một dòng thời gian. **Thứ tự bất biến, không nhảy cóc.** "≈tuần" là ước lượng cho 1 người + Claude.

| Sprint | Phase | Làm gì | Kết quả | Phụ thuộc |
|---|---|---|---|---|
| **S0** | Shell | Route group `(admin)` + AdminShell sidebar + nâng `requireAdmin`→`requireAdminRole` (3 vai) + migrate `/admin` cũ + guard Capacitor loại `(admin)` khỏi export | Khung admin an toàn | — |
| **S1** | **A1 MVP Tiền** | M1.1 bảng đơn + grant thủ công + **M1.2 paid-chưa-grant** | Không mất tiền khách (quick win, data đã sẵn trên Firestore) | S0 |
| **S2** | **A2 MVP User** | M2.1 bảng + tìm email (`emailLower`+index) + M2.2 Customer 360 (Firestore) + grant/revoke + M2.3 deletion + M2.4 ban | Vận hành CSKH cơ bản | S0 |
| **S3** | Overview + Audit | M0 (4 KPI + queue) + M8 đọc `admin_audit` | Nắm business + compliance | S1,S2 |
| **S4** | **PIPELINE (điều kiện tiên quyết)** | `metric_snapshots` + client POST snapshot 1/ngày (consent gate) → NGAY. Sau đó Dexie `event_queue` + 8 event lõi + `/api/telemetry/*` | **Bắt đầu tích luỹ time-series — càng sớm càng nhiều lịch sử** | — (làm song song được, ưu tiên CAO) |
| **S5** | Identity bridge | REST facade CRM + `identity_links` + trigger link-lúc-thanh-toán + cron `syncSignalsToCrm()` nightly + `lifecycleStage` | "1 admin quản mọi thứ" thành hình; join 2 hệ | S2, facade CRM |
| **S6** | **A4 R&D dashboard** | Nightly rollup + M4: 3 widget lõi (FWI Cohort Trajectory · % tốt lên · Pro↔tiến bộ) + `hsContinuous` | Trả lời "người tốt lên?" (deliverable DN R&D) | S4 (≥vài tuần data) |
| **S7+** | Growth flows | 2 flow đầu (Onboarding activation + Pro paywall ngữ cảnh) + hot-lead board + CV share loop (`leadSource`) | Tăng activation + conversion | S4,S5 |
| **Sau** | M3/M5 cổng CRM · **A5 Chữa lành** (mục 7): FES + CalmBox + SavingsTree + Podcash + intervention ladder + A/B holdout · M7 Config · RBAC đầy đủ (analyst/marketing) | Mở rộng tầm nhìn | A5 cần S4 chạy ổn — **KHÔNG trigger mù khi chưa có telemetry** |

**Khuyến nghị đắt giá nhất (đồng thuận 5/5):** **Bắt đầu ghi `metric_snapshots` NGAY tuần này, kể cả khi UI R&D chưa làm.** Dữ liệu time-series không hồi tố — mỗi ngày trì hoãn là vĩnh viễn mất một ngày lịch sử "người tốt lên", chính là thứ cả tầm nhìn sản phẩm lẫn hồ sơ DN R&D phụ thuộc vào. Nếu phải làm 1 việc trước khi làm gì khác → làm S4 snapshot.

**Công cụ đề xuất (khi R&D scale):** Firestore → BigQuery streaming export (Firebase Extension, ~10 phút, không code) khi >~50k user → **Metabase** self-host (SQL mạnh, cohort/retention có sẵn, không khoá Google) nối BigQuery + Postgres, join dashboard-tầng. KHÔNG Airflow/dbt/data-warehouse. Chỉ tự build vài widget hot-lead/guardrail nhúng flow app.

---

## 10. Rủi ro & danh sách điều PO cần CHỐT

### 10.1. Rủi ro vận hành

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| 1 | **Firestore read cost khi R&D scale** | Rollup nightly, đọc raw chỉ trong cron; cảnh báo budget; >50k user → BigQuery export |
| 2 | **CRM facade là single point of failure** | BFF degrade mềm — CRM down thì admin vẫn hiện phần Firestore |
| 3 | **Identity mis-link** | Ép confidence 100% mới auto-link; phần mờ người duyệt; log `admin_audit` |
| 4 | **PII leak qua role** | Ẩn danh mặc định cho analyst/marketing; support cần lý do; test kỹ ma trận |
| 5 | **Consent/pháp lý** | Không consent = không telemetry; nằm trong phạm vi xoá/xuất dữ liệu |
| 6 | **Pricing runtime lệch PayOS** | MVP pricing chỉ đọc; sửa runtime rất sau khi có test |
| 7 | **Capacitor bundle nhầm `(admin)`** | Guard `next.config` loại `(admin)` khỏi static export mobile |
| 8 | **Bug timezone UTC→local lặp lại ở R&D** | Snapshot theo `dateLocal`, de-dup `uid_yyyymmdd`, filter `isTestAccount=false` |

**Chi phí:** ở quy mô hiện tại gần **0đ tăng thêm** (Firestore free tier + Vercel Cron). Chi phí thật chỉ xuất hiện ở R&D scale, có đường thoát rõ (BigQuery).

### 10.2. Danh sách PO cần CHỐT (không chốt thì không code tiếp được phần liên quan)

| # | Câu hỏi | Ảnh hưởng | Khuyến nghị của tôi |
|---|---|---|---|
| 1 | **Subdomain `admin.manicash.*` hay path `/admin`?** | Routing + bảo mật (mục 2.2) | MVP path `/admin`, thiết kế sẵn nâng subdomain |
| 2 | **Duyệt ma trận vai + chính sách PII** (mục 8.2) | Auth toàn admin | 3 vai MVP + schema mảng mở rộng, analyst ẩn danh |
| 3 | **CRM expose kiểu gì?** REST facade sẵn chưa, hay phải bọc quanh `manicash_*`? | Toàn bộ module CRM/join | Bọc REST facade mỏng; runtime KHÔNG gọi MCP |
| 4 | **Consent copy + vị trí** trong onboarding | Điều kiện pháp lý telemetry | Cần 1 câu; PO viết hoặc tôi đề xuất |
| 5 | **8 event lõi đủ chưa?** (mục 3.4) | Nền R&D | Đủ; thêm dần theo câu hỏi cụ thể |
| 6 | **Định nghĩa Activation cứng** (≥5 giao dịch/3 ngày HOẶC streak 3?) | `CR_activation` — chỉ số bắc cầu #1 | Chốt như đề xuất để đo được ngay |
| 7 | **`amountBucket` — dải phân khoảng** (0-50k/50-200k/200k-1tr/1tr+?) | Không bao giờ upload số tiền thật | Chốt như đề xuất |
| 8 | **Ngưỡng Stress + hành động Healing** (podcash nào? coupon %?) | Tầng chữa lành | Chốt sau S4, cần định hướng sớm |
| 9 | **Coach 1-1 giá + chính sách bán lúc stress** | Đạo đức + doanh thu | Chốt: KHÔNG bán khi `strained`/`crisis`, buổi đầu miễn phí |

**Khuyến nghị dứt khoát để bắt đầu HÔM NAY:** duyệt **S0 + S1 (không phụ thuộc quyết định nào trừ #1)** làm quick win money-admin trước, **song song bật S4 `metric_snapshots`** (chỉ phụ thuộc #4 consent + #7 bucket) để đồng hồ time-series bắt đầu chạy. Các quyết định #2/#3/#5/#6/#8/#9 chốt dần cho S5+.

---

*Hết blueprint v1.0. Toàn bộ chi tiết collection/metric/event/module/widget/công thức từ 5 phân tích đã được giữ nguyên và hợp nhất; 4 mâu thuẫn (gọi MCP runtime · subdomain vs path · số event lõi · 5 vai vs 3 vai) đã được phán quyết kèm lý do.*
---

## 11. PHẢN BIỆN ĐỘC LẬP & ĐIỀU CHỈNH KHUYẾN NGHỊ (bắt buộc đọc cùng mục 0–10)

> Một chuyên gia phản biện độc lập (fintech + growth + đạo đức sản phẩm) đã mổ xẻ blueprint trên. Kết luận: **hướng lớn đúng** (gộp admin, không gộp DB, pipeline trước) nhưng blueprint **ngộ nhận 3 điều** và **over-engineer cho quy mô một-người**. Mục này ghi lại các điều chỉnh có hiệu lực GHI ĐÈ lên mục 0–10 khi mâu thuẫn.

### 11.1. Ba ngộ nhận phải sửa

**(1) Dữ liệu R&D do client tự tính → KHÔNG audit được, mà lại định dùng để gọi vốn/đăng ký DN R&D.**
`metric_snapshots` (FDS/TAS/IPS/MMS, hsContinuous, fesScore) do client tính rồi POST. Offline-first ⇒ client có thể sửa số/chạy version cũ/bug. Server không giữ transaction thô để verify. Nhà đầu tư due-diligence hỏi "số này verify kiểu gì?" là bí.
→ **Sửa:** (a) ghi kèm `schemaVersion`+`appVersion`+`source` để sau lọc; (b) mọi con số R&D đối ngoại phải kèm **cỡ mẫu + phương pháp**, KHÔNG trình bày như sự thật đã kiểm định; (c) khi thật sự cần số audit-được cho gọi vốn → mở money-sync **có chọn lọc, có consent** cho một cohort tình nguyện để **server tự tính lại** (nguồn sự thật), thay vì tin client. Đây là việc về sau, nhưng phải biết trước giới hạn.

**(2) Tầng "chữa lành" chạm DỮ LIỆU SỨC KHỎE TÂM LÝ — không phải "analytics".**
Suy luận `crisis`/`strained`/`euphoric` + đọc cảm xúc từ chat = **profiling tình trạng tinh thần**. Theo **Nghị định 13/2023/NĐ-CP**, dữ liệu về tình trạng sức khỏe là **dữ liệu cá nhân nhạy cảm** → cần **đồng ý riêng, rõ ràng, theo từng mục đích** + nghĩa vụ đánh giá tác động. Một checkbox onboarding "cho phép dùng dữ liệu ẩn danh" KHÔNG hợp lệ.
→ **Sửa (ghi đè mục 3.5 & 7):** consent **phân 3 tầng tách biệt**: (a) analytics ẩn danh · (b) đọc cảm xúc từ chat · (c) nhận can thiệp chủ động. Mỗi tầng bật/tắt riêng, mặc định (b)(c) TẮT. Viết `docs/ETHICS_CHARTER.md` + disclaimer **"ManiCash không phải công cụ y tế/tâm lý"** + **link hotline hỗ trợ sức khỏe tâm thần thật** TRƯỚC khi code bất kỳ tính năng healing nào.

**(3) Quy mô một-người bị chôn dưới 9 module + 5 vai + 5 mini-game.**
→ **Sửa (ghi đè):** cắt mạnh — xem 11.3.

### 11.2. Các điểm CHƯA KHẢ THI + cách sửa (ghi đè kỹ thuật)

| Chỗ trong blueprint | Vấn đề | Điều chỉnh (có hiệu lực) |
|---|---|---|
| **`identity_links` trên Postgres + cron ManiCash ghi vào** (mục 1.4) | ManiCash KHÔNG nói chuyện được với Postgres; MCP bị cấm runtime; REST facade CHƯA tồn tại | **Đảo chiều sở hữu mapping**: lưu ở **Firestore `crm_links/{uid}`** (`{learnerId,email_norm,confidence,linkedVia}`) — nơi ManiCash toàn quyền. Đồng bộ CRM chỉ qua **1 webhook lúc thanh toán** (điểm ManiCash đã kiểm soát) hoặc để **CRM chủ động pull**. Bỏ cron nightly ghi-xuyên-hệ ở giai đoạn đầu. **CHỜ PO xác nhận: có sửa được code CRM để nhận webhook/expose REST không?** — câu này quyết định toàn bộ tầng identity. |
| **Customer 360 join API 2 hệ (S5)** | Facade REST + degrade + retry + auth là 1 dự án con | Giai đoạn đầu **KHÔNG join API**: 360 hiện phần Firestore + **nút "Mở hồ sơ CRM" (deep-link kèm email)**. Nhìn 2 tab, xấu hơn nhưng chạy tuần này, 0 code tích hợp. Build facade chỉ khi mở 360 >10 lần/ngày. |
| **Snapshot 1/ngày** (mục 3.3) | User không mở app ⇒ mất điểm ⇒ trajectory gãy | Thiết kế **sparse ngay từ đầu**: khi app mở, POST snapshot hôm nay **+ backfill** các mốc tính lại được từ dữ liệu local. Mọi widget R&D ghi rõ "dựa trên N user có ≥K điểm". Đừng bán "daily time-series" khi thực chất là "event-triggered snapshot". |
| **Multi-device / cài lại app** | Dexie ở 1 máy; đổi máy ⇒ gap/trùng snapshot; doc-id `uid_yyyymmdd` không xử được "2 máy 2 snapshot cùng ngày" | Chấp nhận gap; last-write-wins theo `updatedAt` + cờ `deviceId`; trajectory dùng last-known. Ghi rõ đây là dữ liệu **có nhiễu thiết bị**. |
| **cross-correlation lag FDS→IPS** (mục 5.2) | Vài chục–trăm user nhập tay ⇒ **spurious correlation gần như chắc chắn** ⇒ đưa vào pitch = rủi ro uy tín | **Bỏ khỏi mọi deliverable** tới khi có ≥ vài trăm user active ≥8 tuần. Giai đoạn đầu chỉ vẽ **1 đường: FWI median theo tuần-kể-từ-signup** + nói thẳng cỡ mẫu. |
| **Sentiment JSON mỗi lượt chat** (mục 7.2) | Ép model trả JSON structured mỗi lượt ⇒ tăng token/latency, **giảm chất lượng reply chính**; lexicon tiếng Việt noisy mà dùng để kích hoạt can thiệp khủng hoảng | Dùng **lexicon nhẹ đếm từ khóa**, weight thấp (≤10%), KHÔNG lệ thuộc; KHÔNG ép JSON mỗi lượt. |
| **`config_pricing` / feature-flag runtime Firestore** (mục 7 M7) | Pricing runtime lệch PayOS = đơn sai tiền; flag hiện là build-time env | Giữ flag ở **env**. Nếu cần nhanh, chỉ làm **kill-switch một chiều** (TẮT khẩn cấp). **Bỏ `config_pricing`** khỏi roadmap. |

### 11.3. Over-engineering PHẢI CẮT ở MVP (ghi đè mục 4, 8, 9)

| Cắt | Lý do | Còn lại ở MVP |
|---|---|---|
| **`app_events` + Dexie queue + retry/backoff** | Hạ tầng cho lượng dữ liệu chưa tồn tại; snapshot đã trả lời NSM "người tốt lên" | Chỉ **`metric_snapshots`**. Thêm event khi có câu hỏi funnel cụ thể snapshot không trả lời được. |
| **5 vai + anonymization tier + `adminRoleVersion`** | PO LÀ analyst duy nhất, sở hữu mọi PII | **2 vai: `owner` + `support`**. Giữ schema mảng `adminRoles[]` để mở rộng, nhưng không dựng ma trận giờ. |
| **`hsContinuous` song song hsTotal** | Hai hệ điểm = nợ kỹ thuật vĩnh viễn, sẽ drift | Làm **mượt chính công thức hiển thị**, HOẶC đo trajectory trên thành phần liên tục sẵn có (`runwayMonths`, `savingsRate`). Không đẻ chỉ số thứ hai. |
| **5 mini-game** | Mỗi cái là 1 sản phẩm con cần thiết kế+nội dung+maintain | Chỉ **CalmBox** (ROI rõ nhất). Còn lại là backlog tầm nhìn, không phải plan. |
| **cron đẩy signals sang CRM** (mâu thuẫn với "join-on-read") | Đó chính là ETL đổi tên | Cắt ở MVP. Hoặc join-on-read thật, hoặc thừa nhận đang sync nhẹ — không cả hai. |

### 11.4. Rủi ro đạo đức bị coi nhẹ (bổ sung mục 7.6)

- **Engine chấm sai:** cần (a) nút user "**Tôi KHÔNG căng thẳng, đừng can thiệp**"; (b) mục tiêu false-positive rate; (c) **escalation khi phát hiện dấu hiệu nghiêm trọng** (ý định tự hại vì nợ — có thật ở nhóm tài chính căng thẳng VN) → hiện hotline, KHÔNG để app đóng vai therapist.
- **Holdout đạo đức:** **KHÔNG bao giờ giữ lại nội dung hỗ trợ khủng hoảng** để làm đối chứng. Holdout chỉ áp cho can thiệp **mềm/tùy chọn**.
- **KPI healing ≠ retention:** đo can thiệp bằng retention D7/D30 biến "chữa lành" thành **giữ chân trá hình**. Nếu tốt nhất cho user là **rời app một thời gian**, hệ thống phải cho phép. Đo **kết quả wellbeing** (Δ band, thoát crisis), không chỉ retention.
- **CV năng lực công khai** = một **credit-score-lite không kiểm định** gắn tên người. Rủi ro phân biệt đối xử nếu nhà tuyển dụng/người cho vay dùng "IPS thấp". Cân nhắc: chỉ hiện điểm cho chính chủ, bản share ẩn/def điểm nhạy cảm.
- **"Đồng thuận 5/5"** trong mục 0–10 là **echo của cùng một quá trình sinh**, KHÔNG phải validation độc lập. Đối xử mọi giả định như **giả thuyết cần validate với user/thị trường thật**.

### 11.5. ✅ TOP 5 VIỆC NÊN LÀM NGAY (bản điều chỉnh cuối — ghi đè mục 9 cho giai đoạn đầu)

1. **Bật `metric_snapshots` tuần này — ghi ĐÚNG:** doc-id `uid_yyyymmdd`, theo `dateLocal`, filter `isTestAccount=false`, gate sau **consent riêng cho R&D** (không phải checkbox gộp), kèm `schemaVersion`+`appVersion`. Khi app mở: POST hôm nay **+ backfill** ngày tính được từ local. *Duy nhất không hồi tố được → làm trước mọi thứ.*
2. **Viết `docs/ETHICS_CHARTER.md` + consent phân 3 tầng + disclaimer "không phải công cụ y tế" + link hotline — TRƯỚC khi viết 1 dòng healing.** Đối chiếu Nghị định 13/2023. *1 ngày, chặn rủi ro pháp lý lớn nhất.*
3. **S0 + S1: admin shell + M1 Tiền** (bảng đơn + grant thủ công + **danh sách paid-chưa-grant**). PayOS live thật → chỗ mất tiền khách nếu webhook rớt. Data đã sẵn Firestore, không phụ thuộc quyết định nào. *Quick win cấp bách nhất.*
4. **M2 Customer 360 phiên bản Firestore-only + nút deep-link CRM** (KHÔNG build facade/`identity_links`/cron). Join thủ công qua email khi cần. **Chốt câu hỏi PO #3: có sửa được code CRM để thêm webhook/REST không?** — quyết định toàn bộ tầng identity. *Gỡ giả định nguy hiểm nhất.*
5. **Chốt 3 con số cần đo + bỏ phần còn lại:** `CR_activation` (định nghĩa cứng: ≥5 giao dịch/3 ngày HOẶC streak 3), `CR_free_to_pro`, **doanh thu NET tuyệt đối**. Bỏ FWI/cohort/FDS-IPS-lag/Sankey khỏi deliverable tới khi đủ mẫu. *Chi phí 0, chỉ là kỷ luật phạm vi.*

> **Một câu chốt:** Hướng lớn của blueprint đúng. Nhưng để nó không hại chính mình: (1) đừng dùng số client-tự-tính làm bằng chứng gọi vốn khi chưa audit được; (2) tầng chữa lành là **dữ liệu nhạy cảm** — làm consent/pháp lý/đạo đức tử tế trước; (3) cắt về **CalmBox + M1 Tiền + snapshot + đạo đức**, còn lại để backlog.

---

*Tài liệu hợp nhất bởi hội đồng 5 chuyên gia (KTS · Data/R&D · Growth/CRM · Tâm lý/Gamification · Product/IA) + 1 vòng phản biện độc lập. Ngày 2026-07-07. Mục 11 GHI ĐÈ mục 0–10 khi mâu thuẫn — dùng mục 11 làm kim chỉ nam cho giai đoạn đầu.*

---

## 12. RÀNG BUỘC PO XÁC NHẬN 2026-07-07 (GHI ĐÈ mọi mục liên quan)

### 12.1. DuongQuang.Academy — TUYỆT ĐỐI KHÔNG ĐỤNG

PO xác nhận: Academy là sản phẩm tâm huyết **đang chạy production**. **Không sửa, không xóa, không thêm code vào nó** (không webhook, không endpoint mới). Nếu cần đưa vào ManiCash thì **clone/copy ra và dựng lại trong repo ManiCash**.

**Hệ quả kiến trúc (ghi đè §1.3, §1.4, §11.2):**
- **Bỏ mọi phương án "thêm webhook/REST facade vào Academy".** Không khả thi theo ràng buộc.
- Tích hợp chỉ được phép ở dạng **CHỈ-ĐỌC** từ phía Academy, theo 3 mức tăng dần:
  1. **Deep-link (MVP — khuyến nghị):** admin ManiCash có nút "Mở hồ sơ CRM" → mở UI admin sẵn có của Academy ở tab khác. **0 tích hợp, 0 rủi ro.** Đây là mức nên làm trước.
  2. **Read-only pull:** nếu Academy đã có sẵn HTTP API đọc (thứ mà bộ MCP `manicash_*` đang bọc), ManiCash gọi **chỉ các endpoint đọc** (`get_admin_stats`, `list_learners`, `get_customer_profile`, `get_revenue_chart`...). Không gọi endpoint ghi. Điều này KHÔNG "đụng" code Academy — chỉ đọc.
  3. **Clone/rebuild:** copy dữ liệu + dựng lại phần LMS/CRM trong ManiCash — chỉ làm khi PO quyết **hợp nhất hẳn 2 sản phẩm**. Nặng, để sau.
- **Identity mapping do ManiCash sở hữu 100%** (Firestore `crm_links/{uid}`), populate bằng cách **đọc Academy theo email** (read-only) lúc thanh toán hoặc on-demand. Không ghi ngược vào Academy.

**→ Câu hỏi chốt Q1 cũ ("PO có sửa được code CRM?") đã có đáp án: KHÔNG.** Vậy tầng nối định danh giai đoạn đầu = **deep-link thủ công qua email**, mapping lưu ở ManiCash.

### 12.2. Firebase → Supabase: có nên chuyển?

PO hỏi: đang dùng Firebase, có cần chuyển Supabase không (sau này cũng sẽ chuyển).

**Phán quyết: KHÔNG chuyển lõi bây giờ. Nếu muốn bắt đầu dịch chuyển thì đặt TẦNG MỚI (R&D/analytics) trên Supabase, không đụng lõi.**

**Vì sao không migrate lõi ngay:**
- App **vừa live, tiền thật đang chảy**, admin **vừa siết bằng Firebase Custom Claims** (đầu tư hôm nay).
- Bề mặt phụ thuộc Firebase rất lớn: Auth + custom claims · Firestore **offline-first + Dexie** · Admin SDK · security rules · **Capacitor native auth** (`@capacitor-firebase/authentication`) · money-sync/grant/webhook. Chuyển sang Supabase = viết lại gần hết (RLS thay rules, PostgREST/JWT thay Firestore/claims, lớp offline mới) → **hàng tuần–tháng, rủi ro cao, 0 giá trị cho user.**
- Offline-first của ManiCash dựa trên Firestore/Dexie; Supabase **không offline-first native** — phải tự thêm lớp đồng bộ.

**Khi nào Supabase THẮNG thật sự:**
- **SQL cho R&D** (cohort, retention, funnel, join) — Firestore rất kém khoản này. Đây là lý do chính đáng DUY NHẤT để đưa Supabase vào.
- **Academy vốn đã là Postgres** → nếu hợp nhất lâu dài, **Postgres/Supabase là mẫu số chung** tự nhiên.

**Con đường khuyến nghị (dịch chuyển từ tầng mới, không phá lõi):**
1. **Giữ app lõi trên Firebase** — đừng đụng thứ đang chạy + kiếm tiền.
2. **Tầng R&D/analytics MỚI** → cân nhắc **Supabase Postgres làm kho phân tích**: `metric_snapshots` vẫn ghi Firestore (client offline-first), rồi cron/API đẩy sang Supabase để query SQL. Đây cũng là nơi **đổ read-only copy dữ liệu Academy (Postgres→Postgres)** để làm Customer 360 + join xuyên hệ **mà không đụng Academy**.
3. **MVP tối giản:** kể cả Supabase cũng CHƯA cần ngay — Firestore snapshot đủ trả lời "người tốt lên" giai đoạn đầu. Chỉ dựng Supabase khi thật sự cần SQL cohort (vài tuần dữ liệu sau). **Đừng chạy thêm 1 DB trước khi có dữ liệu.**
4. **Hợp nhất lõi về Supabase** (nếu vẫn muốn) = dự án lớn, làm có chủ đích **rất sau**, không phải bây giờ.

**Điểm đẹp:** Supabase làm **tầng đọc/analytics hợp nhất** vừa tôn trọng "không đụng Academy" (chỉ đọc/đổ bản sao từ Postgres của nó), vừa không phải bóc Firebase khỏi lõi đang chạy — đúng tinh thần "làm dần, đo thật".
