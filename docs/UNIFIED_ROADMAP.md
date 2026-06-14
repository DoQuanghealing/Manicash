# ManiCash — Unified Roadmap (Master Plan)

> Hợp nhất 2 nguồn: `docs/SALES_ADMIN_PAYOS_PLAN.md` (bán hàng/admin/PayOS/chat) + bộ ~16 spec "Lord Diamond / Năng lực" (folder *quản gia có não*). Đã qua đối chiếu code thật (20 agent) + chốt quyết định PO 2026-06-14.
> Trạng thái: **DRAFT chờ PO duyệt**. Branch: `codex/ai-money-chat`. Thực thi: **full Claude**.

---

## 0. TL;DR — ManiCash là HAI sản phẩm

| | **SP1 — ManiCash core** | **SP2 — Lord Diamond / Năng lực** |
|---|---|---|
| Nội dung | Quản lý tiền + gamification + bán hàng/admin/PayOS/chat | Đánh giá năng lực (4 chỉ số) → hướng nghiệp → CV → Coach |
| Plan nguồn | `SALES_ADMIN_PAYOS_PLAN.md` (Phase A–J) | bộ spec Lord Diamond (Phase A–E của họ) |
| Trạng thái | ~70% nối hạ tầng sẵn có | gần như net-new, ~3–4 tuần, phụ thuộc activity tracking |
| Vị trí roadmap | **M1–M3** | **M4** (tách riêng — PO chốt) |

---

## 1. Quyết định đã chốt (PO 2026-06-14)

| # | Chốt |
|---|------|
| Q1 | **SP2 = M4 riêng**, làm sau M1–M3 (tránh scope creep). |
| Q2 | **Coach = cả hai**: AI Coach trong app (credit/Pro) + cấp cao **hứng lead** sang coach người thật của PO (nút gửi báo cáo + dẫn link/đăng ký; app KHÔNG xử lý thanh toán coach). |
| Q3 | **Pricing pack (PO giao em chốt theo lãi tối ưu):** xem §3. |
| Q4 | **Hạ tầng = Firestore trước** (session/cache/quota lưu Firestore; **KHÔNG** Upstash/Redis giai đoạn đầu — 0 chi phí mới). |
| Q5 (suy ra) | **LLM routing:** Groq Llama-3.3-70B = intent/parse/câu dễ (nhanh, rẻ); GPT-4o-mini = CFO narration/tư vấn sâu/follow-up/oracle (suy luận). Code đã chạy đúng — chỉ cần ghi rõ. |

---

## 2. Code đã có (TÁI DÙNG) + Bug phải fix

### 2.1 Tái dùng (đã xác minh)
- `/api/chat` trả `ChatReply { message, ui:{kind}, meta, actionRequest }` — **ui.kind hiện có:** `confirm-transaction | cfo-card | follow-up-buttons | none`. (Tài liệu đề xuất thêm `transaction-draft`/`capacity-report-card` — sẽ **mở rộng enum**, không viết lại.)
- CFO narration + cache 2 tầng (localStorage + Firestore per-month), health score deterministic, fingerprint cache.
- Quota: `aiQuotaPolicy`(client) + `quotaCore`/`quota.ts`(Firestore per-month). **Cần hợp nhất + server-enforce per-day** (đã ghi ở SALES plan Phase C).
- Undo 30s skeleton (`useActionAuditStore`), LLM hybrid (`llmClient` Groq+OpenAI), entitlement/grantPro, requestAuth, firebaseAdmin.

### 2.2 Bug CÓ THẬT (tài liệu Lord Diamond nhắc, đã xác minh trên code) → fix trong M1
| Mã | Bug | Sửa ở |
|----|-----|-------|
| **B-01** | `safeToSpend` tính sai | M1 (foundation) |
| **B-02** | Auth mobile: `getVerifiedRequestUid` cần CẢ cookie LẪN Bearer → mobile cross-origin 401 | M1 (cho Bearer-only khi thiếu cookie) |
| **B-03** | `conversationStore` in-memory `globalThis` → **chết khi serverless cold-start / multi-instance** | M1: chuyển session/conversation sang **Firestore** (Q4) |
| **B-05** | Chưa rate-limit `/api/chat` | M3 (Firestore-based throttle, không Upstash) |

---

### 2.3 Tối ưu kỹ thuật (Manus review — áp dụng khi code)
- **Firestore (thay Redis):** ghi activity bằng `writeBatch`/`bulkWriter`; `chat_sessions` là sub-collection dưới `users/{uid}`; **TTL/cron dọn** session cũ tránh phình DB.
- **Device fingerprint:** hybrid ledger = `deviceId` + `hashed_email` + `ip` (mask); **graceful rejection** ("Thiết bị đã dùng thử" + nút Nâng cấp), không chặn im lặng.
- **Quota/credit (M3):** Optimistic UI + **server truth** (Firestore transaction); cho **grace −1/−2 credit** tránh ngắt hội thoại do trễ mạng.
- **PayOS webhook:** idempotency lưu `webhook_id`/`orderCode` (collection `payos_webhook_events`); nhận lại webhook cũ → trả 200 ngay, không xử lại.
- **safeToSpend (B-01):** thay logic cũ bằng **một** nguồn `moneyBrain.getSafeToSpendBreakdown()` (single source of truth, không rải logic).
- **Auth (B-02):** `getVerifiedRequestUid` **ưu tiên Bearer**, thiếu mới tới cookie → web+mobile chung 1 logic, hết 401.
- **Activity schema (M2):** nhẹ nhất (chỉ key hành động + timestamp) — "vàng ròng" cho chấm điểm năng lực M4.
- **CV PDF (M4):** render **server-side** (`@react-pdf/renderer`/puppeteer) qua `/api/capacity/export-pdf`, cache Firebase Storage ~24h; tránh render mobile lỗi font tiếng Việt.
- **UI gói năm 539k:** nhãn "Tiết kiệm nhất / Tặng ~2 tháng".

## 3. Giá pack mua thêm lượt (CHỐT — lãi tối ưu)

Chi phí 1 lượt tư vấn sâu (GPT-4o-mini ~26đ, hoặc Groq 70B ~72đ, context lớn) → **planning ~100đ/lượt** (thận trọng). Phần đánh giá năng lực = **bộ câu hỏi bấm-chọn, 0 token**; chỉ lượt tổng hợp lời khuyên mới tốn.

| Gói | Giá | Số lượt | Đơn giá | Lãi (~100đ/lượt) |
|---|---|---|---|---|
| Nhỏ | **20k** | **40 lượt** | 500đ | ~80% |
| Phổ biến ⭐ | **40k** | **100 lượt** | 400đ | ~75% |
| Thả ga | **100k** | **fair-use ~300 lượt/tháng** | — | ~70% worst |
| **Pro tặng kèm** | (trong gói Pro) | **40 lượt tư vấn/tháng** | — | nằm trong giá Pro |

> Pack giữa = **40k** (KHÔNG 49k như 1 tài liệu — tránh trùng giá Pro tháng gây lẫn). Lượt mua thêm **cộng dồn**, không hết hạn; quota Pro + "thả ga" reset mỗi tháng. Margin thực tế cao hơn (GPT-4o-mini ~26đ → lãi ~90%+).

---

## 4. Roadmap hợp nhất

### M1 — Nền tảng & Bán được hàng  *(SALES A+B+C + Lord A + chat I)*
- **Foundation (SALES Phase A):** mở `BillingProvider` (+payos/trial/admin); `PRO_SKUS` (49k/30d · 280k/180d · 539k/365d); `grantTrialAtomic` (email+device ledger); hợp nhất tier-resolver; **giới hạn Free** (3 wishlist · 1 mục tiêu lớn · 3 nhiệm vụ kiếm tiền — chặn mềm → mở modal Pro).
- **Bán hàng (SALES Phase B):** modal cam 3 khung (Base/Pro/Trial), Pro có bộ chọn kỳ hạn; đổi xanh khi active.
- **PayOS (SALES Phase C):** create-link + webhook (verify chữ ký, `webhooks.confirm`, idempotent, amount khớp, 4xx/5xx/2xx đúng), `payments_index`/`grant_events`, trang success + an ủi, skip proxy ban cho `/api/payos`. **Quota server-enforce trước khi bật `MONETIZATION_ENABLED`.**
- **Kích hoạt LLM thật + fix bug (Lord A):** set `GROQ_API_KEY`/`OPENAI_API_KEY`, `LLM_PROVIDER`; bật `AI_MONEY_CHAT_AI_FALLBACK_ENABLED`; **fix B-01 safeToSpend, B-02 auth mobile, B-03 conversationStore→Firestore.**
- **Chat history (SALES I):** lưu 7 ngày theo local dateKey, tự xóa qua ngày 8, báo user.

### M2 — Admin & Doanh thu  *(SALES D+E + Phase activity D6)*
- Gác admin: Firebase Custom Claims + `requireAdmin` mọi `/api/admin/*` + `admin/layout` guard; **xóa static key**; nút Admin header cho 2 email.
- `/api/admin/metrics`: doanh thu NET, #mua Pro, tỷ lệ mua, #nâng tay (đếm từ `grant_events` bất biến). Chart SVG tháng+ngày.
- Danh sách người mua + R&D per-user (đếm số lần, không nội dung); nâng thủ công (`provider:'admin'`).
- **Phase activity:** ghi `users/{uid}/activity/{dateKey}` qua Admin SDK → nguồn "tần suất/ngày" + "hào hứng" + **input cho M4 (chỉ số năng lực)**.

### M3 — Quản gia thông minh & Lắng nghe  *(Lord B+C+D + SALES F+G+H + credit packs)*
- **Butler UX (Lord B):** mở rộng `ChatReply.ui.kind` (+`transaction-draft`); nút inline follow-up; **message streaming** (ReadableStream) + typing indicator; markdown renderer (bảng, highlight tiền).
- **Slash-command (Lord 3.2):** `/tuvantaichinh` (tư vấn sâu), `/goicuoc` (gói/pack). Gợi ý câu hỏi dạng nút (đỡ tốn token).
- **Chat memory bền (Lord D, Q4):** session + 3–5 turn gần nhất lưu **Firestore** (thay in-memory), load khi mở app.
- **Pack mua thêm lượt + ruler mềm:** SKU credit-pack qua PayOS (mua 1 lần) + số dư credit server; `/api/feedback` sentiment (SALES F); log câu khó scrub PII (SALES G); báo cáo tháng (SALES H).
- **Rate-limit `/api/chat`** (B-05, Firestore-based).
- **Proactive insights** (Lord D): cảnh báo khi phát hiện bất thường tài chính.

### M4 — Sản phẩm 2: Năng lực & Hướng nghiệp  *(Lord E — spec chi tiết §5)*
Đánh giá 4 chỉ số → ma trận 4 nhóm nghề → recommendation → CV PDF → Coach (AI + hứng lead). **Tách riêng, phụ thuộc M1–M2 (activity + tier + quota).**

### M5 — Hardening
Cache/session bền (vẫn Firestore; cân nhắc Upstash chỉ khi scale thật), rate-limit nâng cao, đo lường, dọn nợ kỹ thuật.

---

## 5. M4 — Sản phẩm 2 (scope + công thức nháp, chốt chi tiết khi tới M4)

### 5.1 Bốn chỉ số (0–100) — **Weighted Scoring (ĐÃ CHỐT)** → `docs/CAPACITY_LOGIC_SPEC.md`
PO chốt: **không dùng ngưỡng cứng**, dùng hệ số trọng số (mỗi chỉ số = tổng các thành phần × trọng số, chuẩn hóa 0–100). 80% deterministic ở backend, 20% AI nhận xét. Phân nhóm theo **phân phối điểm** (có nhóm Hybrid, vd TAS75+MMS75 = "Nhà Khai vấn Công nghệ" — khách tiềm năng nhất cho gói Coach).

| Chỉ số | Thành phần (trọng số) | Nguồn |
|---|---|---|
| **FDS** Kỷ luật | Logging 40% · Budget 30% · Goal 20% · Streak 10% | ✅ finance/budget/goals/streak |
| **TAS** Công nghệ | AI Interaction 50% · Feature Exploration 30% · Onboarding Speed 20% | ⚠️ cần activity counter (M2/M3) |
| **IPS** Tiềm năng thu | Skill Diversity 40% · Earning Task 40% · Free Time 20% | ❌ cần field + **survey** |
| **MMS** Tư duy | Emergency Fund 40% · Investment Mindset 30% · Growth (AI) 30% | ⚠️ healthScore + counter |

> Bộ thu dữ liệu: M1–M2 gom raw (`activity_log` + finance), M3 thêm AI-interaction counter, M4 chạy script tính định kỳ (tuần) → `users/{uid}/capacity_report`. Chi tiết: `docs/CAPACITY_LOGIC_SPEC.md`.

### 5.2 Thành phần M4
- **Khảo sát** 5–10 câu bấm-chọn (free) → `users/{uid}/capacity/{id}`; field mới: kỹ năng, thời gian rảnh, nguồn thu (consent NĐ 13/2023).
- **Engine chấm điểm** deterministic (0 token) → **Radar 4 chỉ số** (SVG tay, đồng bộ HealthScoreGauge — không thêm lib).
- **Ma trận 4 nhóm nghề:** Sáng tạo / Chuyên gia / Khai vấn / Vận hành → recommendation 3 tầng (free gợi ý → credit tư vấn sâu → Coach).
- **Báo cáo Oracle 4 phần** (Gương Thần / Điểm Chạm / Lộ trình 30 ngày / Lời mời) — GPT-4o-mini, tốn **credit** (Pro included quota).
- **CV PDF** (radar/badge/dự báo thu nhập/QR profile) — **cần thêm thư viện PDF** (đề xuất `@react-pdf/renderer` hoặc print-to-PDF nâng cấp). Badge từ metric thật.
- **Coach handoff (Q2):** nút "Gửi báo cáo cho Coach" → form lead → coach người thật của PO (ngoài app); AI coach cơ bản trong app.
- **Admin:** tab phân loại năng lực + click-tracking recommendation (R&D).

### 5.3 4 điểm M4 — ĐÃ CHỐT (PO 2026-06-14)
1. **Công thức 4 chỉ số:** Weighted Scoring (§5.1 + `CAPACITY_LOGIC_SPEC.md`). Bản chuẩn hóa cuối trình PO khi vào M4, dựa dữ liệu thực M1–M3.
2. **Khóa học = Hybrid:** Ưu tiên 1 nội bộ (Coach/E-learning của PO, lãi 100%); Ưu tiên 2 affiliate (Udemy/Coursera/Unica qua link). **Backend CMS đơn giản** để PO tự thêm/sửa link khóa học, không đụng code.
3. **CV public:** **slug ẩn danh** (vd `manicash.im/p/thinh-vuong-88`), TUYỆT ĐỐI không dùng Firebase uid. Toggle "Cho phép xem công khai ON/OFF" ở Profile; OFF → QR báo lỗi với người lạ.
4. **Dự báo thu nhập:** ghi "Tiềm năng thu nhập thị trường" dạng **Range** (vd 15tr–25tr/tháng) + disclaimer chân PDF: "Kết quả dựa trên phân tích năng lực và mặt bằng thị trường, không phải cam kết thu nhập."

---

## 6. Bảng giải quyết xung đột (tóm tắt)
| # | Xung đột | Giải quyết |
|---|----------|-----------|
| 1 | 2 roadmap (SALES A–J vs Lord A–E) | Hợp nhất M1–M5 (doc này) |
| 2 | SKU/giá: code chỉ 49k/30d | Thêm `PRO_SKUS` (M1) |
| 3 | Pack 20k/40k/100k vs 20k/49k/100k | Chốt **20k/40k/100k** (§3) |
| 4 | `BillingProvider` thiếu payos/trial/admin | Mở rộng (M1, BLOCKING) |
| 5 | Upstash/Redis | **Bỏ** — Firestore trước (Q4) |
| 6 | Custom claims / device fingerprint / undo | Đã trong plan — implement (M1/M2) |
| 7 | Capacity/Coach = SP2 | Tách **M4** (Q1) |
| 8 | conversationStore in-memory | → Firestore (M1, B-03) |
| 9 | streaming/typing nói nhưng chưa code | M3 (Lord B) |
| 10 | LLM "70B vs GPT" mơ hồ | Ghi rõ routing (Q5) |

---

## 7. Mô hình dữ liệu — collection mới (gộp)
M1–M2 (xem SALES plan): `payment_intents`, `payments_index`, `grant_events`, `trial_ledger`, `device_ledger`, `users/{uid}/payments`, `users/{uid}/activity/{dateKey}`, `feedback`, `ai_hard_questions`, `payos_webhook_events`.
M1 thêm (B-03): `users/{uid}/chat_sessions/{sessionId}` (session/conversation bền — thay in-memory).
M3: `credit_balance` (số dư lượt mua thêm, trong `users/{uid}` hoặc `ai_usage`).
M4: `users/{uid}/capacity/{id}`, `assessment_surveys`, `recommendation_events`, (CV export audit).

---

## 8. Thứ tự thực thi ngay
**M1 → bắt đầu Phase A (foundation).** Em làm full Claude, không commit/push tới khi PO duyệt từng mốc. Mỗi phase: code → test (jiti) → tsc/lint → báo cáo.

> Tham chiếu chi tiết M1–M2: `docs/SALES_ADMIN_PAYOS_PLAN.md`. Nguồn SP2: folder *quản gia có não* (16 spec). Doc này là **master index** — khi xung đột, doc này thắng.
</content>
