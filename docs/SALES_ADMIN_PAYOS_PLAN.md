# ManiCash — Plan v2: Trang bán hàng + Admin Dashboard + PayOS + Chat history

> Trạng thái: **DRAFT chờ PO duyệt** · v2 (đã qua panel phản biện 5 reviewer, kiểm chứng trên code) · 2026-06-14 · Branch nền: `codex/ai-money-chat`
> Nguyên tắc: tái dùng hạ tầng sẵn có · **server là nguồn-sự-thật** cho cấp Pro & doanh thu & quota · mọi thứ sau kill-switch · **tiền bạc + PII phải chính xác và an toàn**.

---

## 0. Cái gì đã có sẵn (tái dùng) — đã kiểm chứng trên code

| Mảng | Đã có | File:line |
|------|-------|-----------|
| Tier engine | `resolveTier`, `getProStatus`, `computeProExpiry` (stacking), kill-switch, `PRO_PRICE_VND=49000`, `PRO_PERIOD_DAYS=30` | `src/lib/monetization/entitlement.ts` |
| Cấp Pro | `grantProToUser` idempotent theo `orderId`, stacking | `src/lib/monetization/grantPro.ts:60` |
| Auth server | `getVerifiedRequestUid` — **yêu cầu CẢ cookie LẪN Bearer**, **vứt claims** | `src/lib/requestAuth.ts:9` |
| Admin | `/admin` (KHÔNG server-guard) + `/api/admin/bans` gác bằng **static key + `?key=` query** (lỗ hổng) | `src/app/admin/`, `api/admin/bans/route.ts:6` |
| Proxy | `proxy.ts` rate-limit/ban theo IP; `SKIP_RATE_LIMIT_PREFIXES` chỉ có `/api/admin`; `/admin` **không** trong `PROTECTED_PREFIXES`; chỉ đọc cookie uid thô | `src/proxy.ts` |
| Quota | `aiQuotaPolicy` (per-day, client localStorage) **vs** `quotaCore`/`quota.ts` (per-month, Firestore) — **hai engine chưa thống nhất** | `src/lib/aiMoneyChat/` |
| Charts | SVG tay + framer-motion (không lib) | `src/app/(app)/money/_components/` |
| Export | CSV builder + `window.print()` | `src/lib/aiMoneyChat/reportExport.ts` |
| Persist | Zustand `persist`→localStorage (mẫu: `useActionAuditStore`) | `src/stores/persistConfig.ts` |
| Firestore | per-uid owner-only; field nhạy cảm chỉ Admin SDK ghi; admin-only = `if false` | `firestore.rules` |
| Account deletion | `permanentlyDeleteAccount` recursiveDelete `users/{uid}` | `src/lib/accountDeletion.ts:157` |
| UserProfile | đã có `birthDate`, `yearOfBirth`, `tier/plan/isPremium/premiumExpiresAt/billingProvider/billingOrderIds` | `src/types/user.ts` |

---

## 1. ✅ Quyết định đã chốt (PO duyệt 2026-06-14)

> **Bối cảnh kinh doanh:** bộ đếm/metrics phục vụ **đăng ký doanh nghiệp R&D tài chính** (giải pháp cho người thu nhập thấp–trung) → miễn thuế các năm đầu + gọi vốn. ⇒ Số liệu doanh thu/người dùng/hoạt động phải **chính xác, bất biến, xuất được**. Giá gói **chủ yếu bù chi phí API key** ⇒ **quota limit per-tier là then chốt**, không thả ga.

| # | Quyết định |
|---|-----------|
| **D1** | 3 **khung lựa chọn**, 2 **mức quyền**: Base=free · Pro=trả phí · Dùng thử = cấp Pro 30 ngày miễn phí. |
| **D2** | **Có gói năm + 6 tháng.** Giá: **Tháng 49k · 6 tháng 280k · 12 tháng 539k** (539k = 11 tháng trả, tặng 1 tháng; tách khỏi 1 tháng dùng thử). Khung Pro có **bộ chọn kỳ hạn** (Tháng/6 tháng/Năm). `payments_index.plan ∈ {monthly, half_year, yearly}` đưa vào NGAY từ đầu. |
| **D3** | PII tối thiểu + consent (NĐ 13/2023). IP/UA chỉ lúc tạo TT, **ẩn danh sau 90 ngày**. SĐT lấy từ `buyerPhone` PayOS. **Ngày sinh ĐỂ TRỐNG** (cột admin "—") — sau này tính năng "bói toán" sẽ popup/nhiệm vụ cho user tự điền. Bảng admin **mask + audit khi xem**. |
| **D4** | **Firebase Custom Claims** (`admin:true`), verify server-side ở MỌI `/api/admin/*` + server-guard `admin/layout.tsx`. **Xóa hẳn** backdoor static key `?key=`. |
| **D5** | Chia Base/Pro theo §2.2. Lịch sử chat 7 ngày = cho tất cả (không gate). |
| **D6** | **LÀM Phase activity** (đếm thật `users/{uid}/activity/{dateKey}` qua Admin SDK) → nguồn "tần suất/ngày" + "mức độ hào hứng". |
| **D7** | Chống lách trial = **hash email + vân tay thiết bị nhẹ** (deviceId random lưu local + IP, **băm** lại, KHÔNG thu thông tin phần cứng sâu để hợp luật). Lưu `trial_ledger/{emailHash}` + `device_ledger/{deviceHash}`; check cả hai. Khai báo trong Privacy Policy. |
| **Start** | **M1: A→B→C (+I)**, khởi đầu **Phase A**. |

---

## 2. Mô hình gói

### 2.1 Ba khung (modal "cửa sổ" — framer-motion, tông cam `#F97316`)
- 3 khung: **Base (0đ)** · **Pro** · **Dùng thử Pro 1 tháng (0đ)**.
- Khung **Pro** có **bộ chọn kỳ hạn** (segmented): **Tháng 49k · 6 tháng 280k · 12 tháng 539k** (hiện "tiết kiệm X%"/"tặng 1 tháng" ở gói năm).
- Khung user đang ở → **xanh lá `#22C55E`** + nhãn "Đã kích hoạt" / "Đang dùng thử · còn N ngày".
- Nút "Dùng thử" **disable khi** user **đang Pro (bất kể provider)** HOẶC `trialUsedAt`/email-ledger/device-ledger đã có (chặn cả ghi-đè-provider — finding R4).
- **Giữ `/upgrade` (URL thật, deep-linkable)** + modal là shortcut, **chung 1 component nội dung** (khỏi lệch giá). `ProGate` vẫn trỏ `/upgrade`.

### 2.2 Bảng tính năng (D5) — quota là then chốt vì bù tiền API
| Tính năng | Base (0đ) | Pro (49k/th · 280k/6th · 539k/năm) |
|-----------|:--:|:--:|
| Quản lý tiền thủ công + gamification + báo cáo CFO tóm tắt + lịch sử chat 7 ngày | ✅ | ✅ |
| AI Money Chat | 1 lượt/ngày | 20 lượt/ngày |
| Báo cáo CFO AI viết riêng | 1 lượt/ngày | 3 lượt/ngày |
| SMS tự ghi giao dịch · Ưu tiên tính năng mới | ❌ | ✅ |

> **SKU:** `manicash_pro_monthly`(49000/30d) · `manicash_pro_6month`(280000/180d) · `manicash_pro_yearly`(539000/365d). Giữ `PRO_PRICE_VND`/`PRO_PERIOD_DAYS` cũ cho gói tháng; thêm bảng SKU cho 6 tháng/năm.

### 2.3 Phân loại user — ⚠️ ĐẾM TỪ LỊCH SỬ BẤT BIẾN, không từ `billingProvider` scalar
> `grantProToUser` **ghi đè** `billingProvider` mỗi lần → đếm theo scalar bị TRÔI (verified `grantPro.ts:92`). Mọi con số doanh thu/phân loại tính từ **`payments_index` (append-only)** + **`grant_events` (append-only)** + `trialUsedAt`.

| Trục | Định nghĩa |
|------|-----------|
| **Active tier** (gating) | `resolveTier(profile, now)` → base/pro |
| **Phân loại hiện tại** | pro-active + nguồn = grant gần nhất (hiển thị) |
| **Lifetime status** | từ `payments_index`: chưa-mua / từng-mua-hết-hạn / đang-Pro |
| **Doanh thu** | `SUM(payments_index where status='paid') − SUM(refunded)` (tiền thực thu NET, **không đổi** khi Pro hết hạn) |
| **Số "nâng thủ công"** | COUNT distinct uid có ≥1 `grant_events.provider='admin'` (lifetime) |
| **Tỷ lệ mua** | tử = distinct uid có ≥1 payment `paid` (KHÔNG gồm trial/admin) ÷ mẫu = `COUNT(users WHERE accountStatus='active' AND uid NOT LIKE 'anon-%' AND email!=null)`. **Ghi công thức cạnh số** để khỏi hiểu nhầm. |

---

## 3. Mô hình dữ liệu

### 3.1 UserProfile thêm (`src/types/user.ts`)
```ts
trialUsedAt?: string;   // ISO — set khi kích hoạt trial (mirror sang trial_ledger)
phone?: string;         // từ buyerPhone PayOS hoặc user tự nhập (consent)
```
`BillingProvider` (grantPro.ts:11) mở rộng: `'google_play'|'mock'|'payos'|'trial'|'admin'`. **← task BLOCKING đầu Phase A, nếu không tsc fail.**

### 3.2 Firestore collections mới (docId = `String(orderCode)` ở mọi nơi)

| Path | Ghi | Đọc | Mục đích |
|------|-----|-----|----------|
| `payment_intents/{orderCode}` | Admin SDK | Admin SDK | map orderCode→{uid,amount,plan,status,checkoutUrl,createdAt,**ip,ua**}. **Tạo bằng `transaction.create()`** (fail nếu trùng) |
| `payments_index/{orderCode}` | Admin SDK (webhook) | Admin SDK | bảng phẳng doanh thu: uid, amount, **status∈{pending,paid,cancelled,failed,refunded}**, **plan∈{monthly,half_year,yearly}**, paidAt, periodDays |
| `grant_events/{autoId}` | Admin SDK (mỗi lần grant) | Admin SDK | append-only {uid, provider, periodDays, orderId, at} — nguồn đếm phân loại bất biến |
| `trial_ledger/{emailHash}` | Admin SDK | Admin SDK | chống lách trial qua xóa account (D7) |
| `device_ledger/{deviceHash}` | Admin SDK | Admin SDK | vân tay thiết bị nhẹ (hash của deviceId-local + IP) — chặn trial reinstall cùng máy (D7); KHÔNG thu phần cứng sâu |
| `users/{uid}/payments/{orderCode}` | Admin SDK | owner + Admin | lịch sử TT của user |
| `users/{uid}/activity/{dateKey}` | Admin SDK (API hiện có) | Admin SDK | **đếm hoạt động/ngày** (D6) — nguồn "tần suất" + "hào hứng" |
| `feedback/{id}` | **qua `/api/feedback`** (Admin SDK) | Admin SDK | đề xuất + sentiment (tính server) |
| `ai_hard_questions/{id}` | Admin SDK | Admin SDK | câu khó (đã scrub PII) |
| `payos_webhook_events/{id}` | Admin SDK | Admin SDK | raw webhook để replay tay khi cần |
| `users/{uid}/chat_sessions/{dateKey}` | (tùy chọn cloud) owner | owner | lịch sử chat — **admin KHÔNG đọc nội dung** |

**Rules** (siết, không để client tự do):
```
match /payment_intents/{c}      { allow read, write: if false; }
match /payments_index/{c}        { allow read, write: if false; }
match /grant_events/{id}         { allow read, write: if false; }
match /trial_ledger/{h}          { allow read, write: if false; }
match /device_ledger/{h}         { allow read, write: if false; }
match /payos_webhook_events/{id} { allow read, write: if false; }
match /ai_hard_questions/{id}    { allow read, write: if false; }
match /feedback/{id}             { allow read, write: if false; }   // ghi QUA /api/feedback (Admin SDK)
match /users/{uid}/payments/{c}  { allow read: if isOwner(uid); allow write: if false; }
match /users/{uid}/activity/{d}  { allow read, write: if false; }
match /users/{uid}/chat_sessions/{d} { allow read, write: if isOwner(uid); }
```
**Nguyên tắc cứng:** admin dashboard **KHÔNG đọc trực tiếp Firestore**; mọi số liệu/PII qua `/api/admin/*` (Admin SDK, sau `requireAdmin`). **Không bao giờ nới rule theo admin-uid.**

---

## 4. Roadmap theo Phase

### Phase A — Nền: tier + Dùng thử atomic + provider + SKU
- **(BLOCKING)** mở `BillingProvider` (+`payos/trial/admin`); thêm `trialUsedAt`, `phone`.
- **Bảng SKU** (`entitlement.ts`): `PRO_SKUS = { monthly:{amount:49000,periodDays:30}, half_year:{amount:280000,periodDays:180}, yearly:{amount:539000,periodDays:365} }`. Giữ `PRO_PRICE_VND`/`PRO_PERIOD_DAYS` cũ = gói tháng.
- **Hợp nhất tier-resolver:** 1 hàm dùng chung client+server, quy tắc `flag AND expiry!=null AND expiry>now`. Sửa `resolveAiMoneyPlan` (quotaCore): `premiumExpiresAt===null ⇒ KHÔNG Pro` (hiện coi là Pro-vĩnh-viễn — verified `quotaCore.ts:48`). Test bất biến: mọi đường cấp Pro đều set expiry.
- **`grantTrialAtomic(uid,email,deviceHash)`** — 1 `runTransaction` DUY NHẤT: đọc `users/{uid}` + `trial_ledger/{emailHash}` + `device_ledger/{deviceHash}`; nếu **bất kỳ** đã thử → 409; else set `trialUsedAt` + tier/plan/isPremium/`premiumExpiresAt`(+30d) + `grant_events` + `trial_ledger` + `device_ledger`. (KHÔNG lồng `grantProToUser` — nó tự mở transaction riêng → không atomic.)
- **deviceHash** = hash(`deviceId` random lưu localStorage + IP từ request) — **không thu phần cứng sâu** (hợp NĐ 13/2023).
- `/api/billing/trial`: auth → chặn nếu **đang Pro active** hoặc email/device đã thử → `grantTrialAtomic`.
- `getPlanCard(profile)` → trạng thái 3 khung + kỳ hạn Pro.

**Nghiệm thu:** 2 request /trial song song chỉ 1 thành công; xóa account rồi tạo lại (uid mới, **cùng email HOẶC cùng máy**) **không** thử lại được; tier-resolver client==server; `test:monetization` xanh.

### Phase B — Cửa sổ bán hàng 3 gói
Modal cam 3 khung + đổi xanh khi active (như §2.1). Base=đóng (no-op); Pro=→PayOS (Phase C); Trial=`/api/billing/trial`→reload entitlement. Giữ `/upgrade` URL thật. `trackEvent('upgrade_view')`.
**Nghiệm thu:** free→Base xanh; bấm Dùng thử→Trial xanh+30 ngày; đang Pro → nút Dùng thử khóa.

### Phase C — Thanh toán PayOS (phần rủi ro nhất — làm cẩn thận)
**SDK chính xác** (đã verify @payos/node v2.x):
```ts
import { PayOS } from '@payos/node';
const payos = new PayOS({ clientId, apiKey, checksumKey }); // object, KHÔNG positional
// tạo link:
const { checkoutUrl, paymentLinkId } = await payos.paymentRequests.create({ orderCode, amount, description, returnUrl, cancelUrl, buyerPhone? });
// webhook: verify ASYNC, nhận NGUYÊN object, chữ ký HMAC-SHA256 trên SORTED-KEYS của data (KHÔNG raw bytes → req.json() ĐÚNG):
const data = await payos.webhooks.verify(body);
// đăng ký 1 lần/môi trường:
await payos.webhooks.confirm(webhookUrl);
```
- `payosClient.ts`: init + **fail-fast nếu thiếu 3 env**. Pin version `@payos/node`.
- **`/api/payos/create-link`** (auth): nhận `plan∈{monthly,half_year,yearly}` từ client → **amount tra `PRO_SKUS` server-side (KHÔNG tin amount client)**; sinh `orderCode` = số ngẫu nhiên đủ rộng (~12–15 chữ số, ≤ `MAX_SAFE_INTEGER`), ghi `payment_intents` (kèm `plan`,`amount`,`periodDays`) bằng `transaction.create()` (trùng→sinh lại); chống double-create (intent PENDING gần đây→trả checkoutUrl cũ); lưu **ip+ua** (chống gian lận). Trả `checkoutUrl`.
- **`/api/payos/webhook`**:
  1. `const data = await payos.webhooks.verify(body)` trong try/catch → **chữ ký sai/payload hỏng = 4xx** (KHÔNG 2xx).
  2. Ghi `payos_webhook_events` (raw) trước khi xử.
  3. **Kiểm `body.success===true && body.code==='00'`** trước khi cấp (event test/cancelled → 2xx no-op).
  4. **transaction:** đọc `payment_intents/{orderCode}`; kiểm `status==='pending'`, `amount === intent.amount` **chính xác** (lệch→`status='amount_mismatch'`, flag admin, không cấp), `intent.uid` tồn tại; set `intent.status='paid'` + `grantProToUser(provider:'payos',orderId:String(orderCode))` + ghi `payments_index`/`payments`/`grant_events` **atomic** (idempotent theo `intent.status`, chống replay).
  5. **HTTP codes:** verify+xử xong (kể cả no-op) → **2xx**; lỗi tạm thời (Firestore down / intent chưa kịp ghi do race) → **5xx để PayOS RETRY**; chữ ký sai → 4xx. Intent null kéo dài → dead-letter `payment_orphans` + alert.
- **Webhook handle MỌI status** (cancelled/failed/refunded → cập nhật `payments_index`). Refund → cờ admin (cân nhắc thu hồi Pro). Doanh thu = NET.
- **Lưới đối soát:** `/payment/success` gọi server `paymentRequests.get(orderCode)` xác nhận PAID → cấp idempotent nếu webhook trễ; cron quét intent PENDING quá N phút.
- **proxy.ts:** thêm `/api/payos` vào `SKIP_RATE_LIMIT_PREFIXES` + bỏ khỏi ban-check (verify bằng chữ ký, KHÔNG IP allowlist) — **nếu không PayOS bị auto-ban → cấp Pro chết im lặng** (verified).
- **Trang:** group mới `(public)/payment/success` + `(public)/payment/cancel` (layout tối giản, không bottom-nav, không AuthGuard, **prerender được cho mobile static export** — không dùng searchParams server-side). Success = chúc mừng + nút "Về trang chính" + client reload entitlement. Cancel = **trang an ủi** ("Ổn thôi, mình vẫn ở đây đồng hành cùng bạn 💛 Cho mình 30 ngày tới giúp bạn kiểm soát dòng tiền nhé" + nút quay lại).
- **Mobile (Capacitor):** mở `checkoutUrl` bằng `@capacitor/browser`; returnUrl/cancelUrl = App Links/deep-link `manicash://payment/...`; listener `appUrlOpen` đóng browser + reload entitlement. Client mobile **KHÔNG** tin returnUrl để cấp quyền (webhook lo). Kiểm `android/` có intent-filter App Links.
- **Auth mobile:** `getVerifiedRequestUid` cần CẢ cookie LẪN Bearer (verified `requestAuth.ts:9`) → mobile cross-origin có thể thiếu cookie → 401. **Sửa: cho phép Bearer-only** khi không có cookie (verifyIdToken là đủ tin). Test create-link/trial từ Capacitor.
- **Quota server-enforced (HARD dependency, không "hardening sau"):** thêm đếm **per-day server-side** (`users/{uid}/ai_usage` theo dayKey), engine kiểm cả perDay lẫn perMonth; đặt free=1/ngày qua env; `aiUsageStore` chỉ còn để hiển thị optimistic. **Phải xong trước khi flip `MONETIZATION_ENABLED=true`** — nếu không, clear-storage reset lượt (đúng nỗi lo). Test: clear localStorage không reset lượt server.
- Cờ `NEXT_PUBLIC_PAYOS_ENABLED`; cập nhật `.env.example` + `.env.mobile.example`.

**Nghiệm thu:** sandbox: confirm webhook → trả tiền → cấp Pro đúng 1 lần; webhook đến trước intent → 5xx→retry→cấp đúng; amount lệch → không cấp + flag; cancelled → no-op; chữ ký sai → 4xx; ban giả IP → webhook vẫn cấp; luồng mobile end-to-end; clear-storage không reset quota.

### Phase D — Admin: gác quyền + doanh thu
- **Gác (verified bất khả thi ở proxy):**
  - `getVerifiedAdminClaim(req)` mới (verify ID token + trả `decoded.admin`); `requireAdmin(req)`→403 nếu `!admin`. Wrapper `withAdmin(handler)`.
  - **Mọi `/api/admin/*` gọi `requireAdmin`** (defense-in-depth) — mỗi route 1 test "non-admin→403".
  - `admin/layout.tsx` Server Component guard (verify claim → redirect nếu không admin) — chặn render UI.
  - **XÓA** nhánh `?key=` + default key hard-code + key nhúng client ở `/api/admin/bans` & `AdminDashboardContent`. proxy chỉ thêm `/admin` vào `PROTECTED_PREFIXES` để chặn user chưa đăng nhập (UX).
  - Script set claim cho 2 email (chạy 1 lần); gỡ admin = `revokeRefreshTokens` + xóa claim. `ADMIN_EMAILS` **chỉ** cho script seed, **không** so email runtime.
  - Nút "Admin" ở `AppHeader` render khi đọc `admin` từ ID token claims.
- **`/api/admin/metrics`:** tổng hợp từ `payments_index`+`grant_events`+`users`: #mua Pro, doanh thu NET, tỷ lệ mua (công thức §2.3), #nâng thủ công (đếm riêng).
- **Chart** doanh số theo tháng + ngày (SVG tay `AdminBarChart`, aggregate **server-side**). Gói năm: **cash-basis** (1 cột tại ngày mua); nếu cần deferred thì chart phụ riêng — không trộn.

**Nghiệm thu:** chỉ 2 email vào được; non-admin gọi mọi API admin→403; số khớp data test.

### Phase E — Admin: danh sách người mua + R&D + nâng thủ công
- **Phạm vi bảng = user có ≥1 `payment_intent`** (mới có IP/UA). Cột: tên · `uid` · IP(mask) · SĐT(mask) · UA · email · ngày sinh(mask) · phân loại · loại TT(tháng/năm) · ngày ĐK · số tiền · status · **active-tier + lifetime-status** (2 cột). PII **mask mặc định**, hiện full + **audit** khi xem.
- **"Tần suất dùng/ngày"** từ `users/{uid}/activity/{dateKey}` (Phase activity D6) — KHÔNG suy từ streak. Nếu chưa làm activity → cột ghi rõ "cần Phase activity".
- **Bấm tên → R&D dashboard:** rank/XP/streak + **số lần** nhập thu/chi, chia ví, #mục tiêu, #nhiệm vụ, tiền kiếm (task `actualAmount`) — chỉ đếm, không nội dung. **Nguồn server:** chỉ user đã bật cloud-sync (`users/{uid}/money/state`) hoặc `finance_core` mới đủ; user local-only → "—". (Cân nhắc đẩy `questMetrics` tóm tắt lên doc server khi active.)
- **Nâng thủ công:** form → `grantProToUser(provider:'admin')` + `grant_events`. Tổng Pro +1, ô "nâng thủ công" đếm từ `grant_events` (bất biến, không trôi).

**Nghiệm thu:** phân loại đúng & bền theo thời gian (trial→payos không hụt đếm); nâng thủ công đếm từ grant_events; PII mask + audit khi xem.

### Phase activity (D6) — pipeline đếm hoạt động server-readable
Ghi `users/{uid}/activity/{dateKey}={count,lastAt}` qua Admin SDK ở các API hiện có (chat parse, input...). Nguồn cho "tần suất/ngày" (Phase E) + "mức độ hào hứng" (Phase H). **Đây là việc mới — D6 cần PO chấp nhận.**

### Phase F — Admin: đề xuất / feedback (sentiment server-side)
- UI gửi feedback **qua `/api/feedback`** (route handler → proxy rate-limit + sanitize + Admin SDK ghi; rule feedback `if false`). Admin UI render **text thuần (escape)** — chống stored XSS.
- **Sentiment engine deterministic (server):** lexicon VN (tích/tiêu/phủ định "không/chưa/tệ/lag/treo") → nhóm (góp ý/tích cực/tiêu cực/nâng cấp/báo lỗi) + điểm → **1–5 sao**; rất tiêu cực → ⚠️; tích cực có gợi ý → ⭐. Engine thuần test cố định; AI chỉ tùy chọn tóm tắt.
- Admin: list + lọc nhóm + badge + "đã xem".

**Nghiệm thu:** feedback tiêu cực→⚠️; tích cực→⭐+sao cao; engine có test; client không set được sentiment/status.

### Phase G — Admin: câu hỏi khó + ruler MỀM
- **scopeGuard MỀM (đúng ý PO "dùng cũng qua"):** câu rõ ràng vô quan → từ chối có duyên, không gọi LLM (tiết kiệm); câu **biên/người dùng nài** → vẫn cho AI qua. Không cứng nhắc.
- **Log câu khó** (fallback LLM / lặp nhiều) vào `ai_hard_questions` — **scrub số tiền/tên/SĐT** khỏi text (hoặc chỉ lưu intent+template) + retention; đưa vào consent nếu lưu raw.
- Admin: top câu khó + tần suất + nút "đã thành rule". (Tùy chọn: xem chất lượng câu AI đã trả để chấm.)

**Nghiệm thu:** câu vô quan ("thời tiết")→từ chối có duyên KHÔNG tốn lượt; câu biên vẫn qua; câu khó được log đã scrub.

### Phase H — Admin: xuất báo cáo tháng
7 mục: #user (học viên) · doanh thu NET · biểu đồ 12 tháng · 30 ngày · **mức độ hào hứng** (từ activity) · feedback (F) · câu khó (G). **Phụ thuộc cứng D+F+G** — nếu làm sớm thì bản rút gọn (D+E) + đánh dấu "feedback/câu khó có sau F/G", minh bạch với PO. Tái dùng `reportExport.ts` CSV + `window.print()`.

### Phase I — Chat: lưu theo ngày + tự xóa (làm SỚM được, độc lập)
- Thêm `createdAt` vào `ChatMessage`; `useChatHistoryStore` (Zustand+localStorage, mirror `useActionAuditStore`), gom theo `dateKey` **theo LOCAL** (đồng bộ fix timezone `e9299b9`, truyền `clientNow` — KHÔNG dùng UTC như quotaCore).
- **Ngữ nghĩa "ngày thứ 8":** giữ trọn **7 ngày-lịch gần nhất**; sang **đầu ngày thứ 8** xóa đoạn cũ nhất. `clearOlderThan` dựa mốc "đầu ngày, > 7 ngày" — test 2 biên 00:05 và 23:55 local cùng kết quả.
- **"Báo khách hàng" thật:** toast/dòng hệ thống khi mở chat nếu vừa dọn ngày cũ ("Đã dọn lịch sử cũ hơn 7 ngày") + nhãn "sẽ xóa sau N ngày" trên ngày sắp hết hạn — không chỉ banner tĩnh.
- (Tùy chọn sau) sync cloud `users/{uid}/chat_sessions/{dateKey}` (admin KHÔNG đọc nội dung).

**Nghiệm thu:** reload vẫn còn; >7 ngày biến mất đúng biên local; có thông báo dọn; test `clearOlderThan`.

---

## 5. Bảo mật & Quyền riêng tư

1. **Webhook PayOS:** verify chữ ký (4xx nếu sai) → check `success&&code==='00'` → transaction atomic (intent.status='paid' + grant + index) chống replay/double → 2xx; lỗi tạm thời 5xx (retry). Skip proxy ban/rate-limit cho `/api/payos`.
2. **Admin:** `requireAdmin` claim server-side ở MỌI route + `admin/layout` guard; **xóa backdoor static key**; nút header chỉ UX.
3. **PII (Nghị định 13/2023):** consent khi thu SĐT/ngày sinh; Privacy Policy liệt kê IP/UA/SĐT/DOB + mục đích + **retention** (ẩn danh IP/UA sau 90 ngày); bảng admin **mask + audit khi xem/xuất**; `exportUserData` + account deletion **bao gồm** payment_intents/payments/feedback; không log PII.
4. **Quota:** server-enforced trước khi bán (per-day+per-month ở Firestore); localStorage chỉ hiển thị.
5. **Feedback:** ghi qua API (sanitize + rate-limit), render escape, sentiment server.
6. **orderCode** ngẫu nhiên đủ rộng (không đoán được, không lộ volume); endpoint nhận orderCode từ client phải kiểm `uid===intent.uid`.
7. **Audit:** ban/nâng-tay/**xem-PII**/xuất ghi log ai-làm-gì-khi-nào.

---

## 6. Thứ tự & milestone

```
A (tier+trial+provider+quota-unify) ─► B (3 gói) ─► C (PayOS + quota server-enforce + proxy skip)
                                                      └─► payments_index/grant_events ─► D (gác admin + doanh thu) ─► E (người mua + R&D + nâng tay)
Phase activity (D6) ─► (nguồn cho E "tần suất" + H "hào hứng")
F (feedback) · G (ruler+câu khó) ─ độc lập ─► H (báo cáo tháng, cần D+F+G)
I (chat history) ─ ĐỘC LẬP, ưu tiên làm sớm
```
- **M1 (bán được hàng):** A → B → C (+I). Lưu ý: bật `MONETIZATION_ENABLED=true` ở M1 **bắt buộc** quota đã server-enforced.
- **M2 (quản trị):** D → E (+ activity).
- **M3 (lắng nghe & tối ưu):** F → G → H.

---

## 7. Env (cập nhật `.env.example` + `.env.mobile.example`)
```bash
# Public
NEXT_PUBLIC_MONETIZATION_ENABLED=true      # bật khi ra mắt (đang false)
NEXT_PUBLIC_PAYOS_ENABLED=false
NEXT_PUBLIC_PAYMENT_METHOD=payos           # payos | google_play
# Server-only (KHÔNG prefix NEXT_PUBLIC)
PAYOS_CLIENT_ID=... ; PAYOS_API_KEY=... ; PAYOS_CHECKSUM_KEY=...
ADMIN_EMAILS=doduongquang8686@gmail.com,freshlife1381@gmail.com   # CHỈ cho script seed claim
AI_QUOTA_FREE_CHAT_PER_DAY=1 ; AI_QUOTA_PRO_CHAT_PER_DAY=20       # server-enforced
```

## 8. Rủi ro còn lại (đã xử trong v2, ghi để theo dõi)
- **Trial-abuse tồn dư:** email mới = thử lại được (D7) — chấp nhận hoặc thêm device fingerprint.
- **R&D admin** chỉ đầy đủ cho user đã cloud-sync (flag đang OFF).
- **PayOS sandbox cần test thật:** shape `paymentRequests.create` trả về + payload webhook nên verify trên sandbox trước khi tin.

## 9. Test plan
A: trial 1-lần (qua xóa account), atomic, tier-resolver client==server · C: webhook (sig sai 4xx, replay, amount-mismatch, đến-trước-intent 5xx, cancelled no-op), proxy không ban PayOS, quota clear-storage không reset · D: requireAdmin non-admin 403 (mỗi route), doanh thu/tỷ lệ · E: phân loại bền + nâng-tay từ grant_events, PII mask · F: sentiment cố định · G: scopeGuard mềm · I: clearOlderThan biên local.

> Repo: npm + jiti (không pnpm). Mỗi phase thêm `tests/*.test.ts` + script `test:*` theo nếp hiện có.
</content>
