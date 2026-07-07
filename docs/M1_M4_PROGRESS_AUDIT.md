# ManiCash — Audit tiến trình M1 → M4 (đối chiếu code thật)

> Kiểm chứng trực tiếp trên code ngày 2026-07-06 (không suy từ tài liệu plan). Nguồn kế hoạch: `docs/UNIFIED_ROADMAP.md` + `docs/SALES_ADMIN_PAYOS_PLAN.md`. Dùng file này làm nguồn sự thật thay cho % ước tính cũ trong 2 file plan trên (chúng đã lỗi thời).

---

## Tóm tắt nhanh

| Milestone | Nội dung | % thật (code) | Trạng thái |
|---|---|---|---|
| **M1** | Nền tảng & Bán hàng (tier, trial, PayOS, fix bug nền) | **100% code** | **Xong về code.** Việc còn lại là bật flag ở production (business decision, không phải code) |
| **M2** | Admin & Doanh thu | **0%** | Chưa bắt đầu |
| **M3** | Quản gia thông minh & Lắng nghe | **0%** | Chưa bắt đầu |
| **M4** | Năng lực & Hướng nghiệp (SP2) | **~50%** | Lõi tính điểm xong, phần xuất bản/thương mại hoá chưa |

**Điểm quan trọng nhất:** M1 đã đi xa hơn nhiều so với SESSION_HANDOFF.md gần nhất thể hiện — PayOS + trial + tier + cả 3 bug nền (B-01/B-02/B-03) đã code và fix xong, xác minh trực tiếp trên code ngày 2026-07-06 (đợt audit trước gắn nhãn "MỘT PHẦN" cho B-01/B-03 là quá thận trọng — đọc kỹ lại thì cả hai đều đã đúng thiết kế). M1 **không còn nợ code nào** — chỉ còn 1 quyết định vận hành: bật `NEXT_PUBLIC_MONETIZATION_ENABLED`/`NEXT_PUBLIC_PAYOS_ENABLED` ở Vercel production + nạp PayOS key thật. Xem mục "Việc còn lại của M1" cuối phần M1.

M2 và M3 **hoàn toàn chưa động tới** dù roadmap liệt kê chúng là bước tiếp theo ngay sau M1. M4 đã có lõi engine (đo năng lực) chạy độc lập trước cả M2/M3 — trái thứ tự roadmap gốc (roadmap ghi M4 "phụ thuộc M1-M2 activity tracking", nhưng activity tracking (M2) chưa làm nên M4 hiện chỉ tính điểm từ dữ liệu tài chính sẵn có, không có activity thật).

---

## M1 — Nền tảng & Bán hàng

**Logic tổng:** mở khóa bán Pro qua PayOS với 3 gói (tháng/6 tháng/năm) + trial 30 ngày miễn phí chống lách (khóa theo email-hash + device-hash), đồng thời vá 3 bug nền chặn thu tiền an toàn (safe-to-spend sai, auth mobile 401, session chat chết khi serverless cold-start).

| # | Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `PRO_SKUS` 3 gói (monthly/half_year/yearly, 49k/280k/539k) | ✅ CÓ | `src/lib/monetization/entitlement.ts:28-32` |
| 2 | `BillingProvider` mở rộng `payos\|trial\|admin` | ✅ CÓ | `src/types/user.ts:12` |
| 3 | `grantTrialAtomic` (1 transaction, chặn lách trial) + route `/api/billing/trial` | ✅ CÓ | `grantTrial.ts:44-117`, `api/billing/trial/route.ts` |
| 4 | Modal bán hàng 3 khung (Base/Pro/Trial) + bộ chọn kỳ hạn | ✅ CÓ | `src/components/pricing/PricingCards.tsx:45-150` |
| 5 | PayOS client + `/api/payos/create-link` + `/api/payos/webhook` (SDK `@payos/node` thật, không mock) | ✅ CÓ | `payosClient.ts`, `package.json:104` (`@payos/node@^2.0.5`), 2 route trên |
| 6 | Firestore ghi thật: `payment_intents`, `trial_ledger`, `device_ledger`, `grant_events` | ✅ CÓ | `create-link/route.ts:48`, `grantTrial.ts:59-60,107` |
| 7 | **Bug B-01** — safeToSpend dùng 1 nguồn `moneyBrain.getSafeToSpendBreakdown()` | ✅ CÓ (đã fix) | `useSafeBalance.ts:13,18` gọi thẳng `getSafeToSpendBreakdown` — docstring ghi rõ "Same numbers as the Chat engine — no more dual-source discrepancy". Cùng hàm được dùng ở `snapshotBuilder.ts`, `guardian.ts`, `handleQuerySafeToSpend.ts`, `cfoContextPack.ts`. Còn 1 formula đơn giản hoá riêng (`useBudgetStore.ts:121-127`) nhưng chỉ dùng nội bộ cho **báo cáo lịch sử tháng đã đóng** (rollover report), không hiển thị song song với số live → không gây "lệch số" cho user. |
| 8 | **Bug B-02** — auth mobile: `getVerifiedRequestUid` ưu tiên Bearer khi thiếu cookie | ✅ CÓ (đã fix) | `requestAuth.ts:12-25` — Bearer token là credential chính, cookie chỉ là lớp CSRF phụ khi có mặt |
| 9 | **Bug B-03** — `conversationStore` không còn phụ thuộc in-memory khi chạy production | ✅ CÓ (đã fix đúng thiết kế) | `conversationStore.ts:35,38-44,54-62` — Firestore (`ai_conversations`) là đường chính khi có Firebase Admin config (luôn đúng ở production vì cả app phụ thuộc Firebase Admin); Map in-memory **chỉ fallback khi thiếu hẳn Firebase env** (test/dev local) — đúng bản chất fix B-03, không phải nợ còn treo. |
| 10 | Chat history 7 ngày, tự xoá qua ngày 8 (Phase I) | ✅ CÓ | `useChatHistoryStore.ts:29-68` |
| 11 | Quota server-enforced per-day + per-month (chống lách bằng clear localStorage) — điều kiện BLOCKING trước khi bật `MONETIZATION_ENABLED` | ✅ CÓ | `quota.ts:44-92` — Firestore `runTransaction`, kiểm cả `evaluateQuota` (tháng) lẫn `readDailyUsage` (ngày) trước khi cho phép; `aiQuotaPolicy.ts` định nghĩa giới hạn free/pro theo ngày+tháng |
| 12 | Proxy bỏ qua rate-limit/ban cho webhook PayOS (tránh PayOS tự bị chặn) | ✅ CÓ | `src/proxy.ts:25` — `/api/payos/webhook` trong `SKIP_RATE_LIMIT_PREFIXES` |

**Kết luận: M1 không còn nợ code.** Toàn bộ 12 hạng mục kỹ thuật đã xác minh CÓ trên code thật.

### Việc còn lại của M1 — KHÔNG phải code, mà là quyết định vận hành

**Cập nhật 2026-07-06 (thực tế trên Vercel production, khác với `.env.example`):**
- `NEXT_PUBLIC_MONETIZATION_ENABLED=true`, `NEXT_PUBLIC_PAYOS_ENABLED=true`, đủ 3 key `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`/`PAYOS_CHECKSUM_KEY` **đã có sẵn trên Vercel Production** — app đang ở trạng thái có thể nhận thanh toán thật ngay bây giờ.
- ⚠️ **Phát hiện rủi ro:** webhook PayOS **chưa từng được đăng ký** (`payos.webhooks.confirm()` chưa gọi lần nào cho domain `www.manicash.org`). Nếu có người mua Pro lúc này, PayOS xử lý thanh toán xong nhưng không biết gửi thông báo về đâu → **hệ thống không tự cấp Pro dù khách đã trả tiền**.
- Đang trong quá trình đăng ký webhook: gọi `POST /api/payos/confirm-webhook` bị 403 do `MANICASH_ADMIN_KEY` trên Vercel khác giá trị local — PO đã sửa lại trên Vercel dashboard, đang chờ deploy mới áp dụng (Vercel yêu cầu tạo 1 deployment mới để đọc env đã đổi, không có nút "nhập key + Redeploy" trực tiếp).
- Chưa xác nhận 3 key PayOS đang là **sandbox hay live thật** — cần PO kiểm tra trên PayOS dashboard trước khi yên tâm để `MONETIZATION_ENABLED=true` cho user thật thấy.

**Việc vừa hoàn thành (2026-07-06):** dọn dead code `getCFONarrative`/`getFallbackNarrative`/`buildUserPrompt` + toàn bộ helper riêng (`groqClient.ts`) — không còn ai gọi (đã bị thay bằng `aiMoneyChat/cfo/` từ trước), giữ lại 3 type (`CFOPayload`/`WatchedCategoryDetail`/`FlaggedTransactionDetail`/`CFOInsight`) vẫn đang dùng thật ở `useCFOSnapshot`/`useCFOReport`/`CFOInsightCard`. Đã verify: `tsc --noEmit` sạch, `npm run test:ai-all` toàn bộ PASS.

**Việc còn lại (không phải code, chờ PO xác nhận trên Vercel/PayOS dashboard):**
1. Deploy lại để Vercel đọc `MANICASH_ADMIN_KEY` mới (đang chờ — có thể trigger bằng bất kỳ commit+push nào, kể cả push không liên quan tới PayOS).
2. Gọi `POST /api/payos/confirm-webhook` (admin key) để đăng ký webhook — 1 lần duy nhất/môi trường.
3. Xác nhận key PayOS đang sandbox hay live trên PayOS dashboard.
4. Test 1 luồng thanh toán thật/sandbox → xác nhận webhook cấp Pro đúng 1 lần trước khi yên tâm để mở bán rộng.

---

## M2 — Admin & Doanh thu

**Logic tổng:** khóa `/admin` bằng Firebase Custom Claims (thay static key), dựng dashboard đo doanh thu NET/tỷ lệ mua/số nâng tay từ dữ liệu bất biến (`payments_index` + `grant_events`), và bắt đầu ghi nhận hoạt động người dùng mỗi ngày (`activity/{dateKey}`) làm nguồn dữ liệu "tần suất dùng" — đây cũng là input bắt buộc cho công thức năng lực ở M4 (chỉ số TAS, MMS).

| # | Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `/api/admin/*` gác bằng Firebase Custom Claims + `requireAdmin` | ✅ CÓ (2026-07-07) | `src/lib/requireAdmin.ts` verify Bearer ID token + `admin===true` + `checkRevoked`. Áp cho `admin/bans`, `admin/test-account`, `payos/confirm-webhook`. Đã XÓA hẳn static key `MANICASH_ADMIN_KEY` + fallback hardcode + nhánh `?key=`. Thêm `adminAudit.ts` ghi `admin_audit`. Script cấp quyền: `scripts/grant-admin.mjs`. |
| 2 | Gác client `/admin` | ✅ CÓ (2026-07-07) | `AdminDashboardContent.tsx` đọc claim từ tài khoản đăng nhập (`getIdTokenResult`), 4 trạng thái checking/anon/forbidden/admin — không phải admin thì không gọi được API (đã gác server). |
| 3 | `/api/admin/metrics` (doanh thu NET, tỷ lệ mua, #nâng tay) | ❌ KHÔNG | Route không tồn tại — chỉ có `/api/admin/bans` + `/api/admin/test-account` |
| 4 | Activity tracking `users/{uid}/activity/{dateKey}` qua Admin SDK | ❌ KHÔNG | Không tìm thấy đoạn ghi nào trong code |

**Kết luận (cập nhật 2026-07-07):** **Phần gác bảo mật của M2 XONG** — rủi ro static key đã đóng. Còn lại của M2 là 2 tính năng: `/api/admin/metrics` (đo doanh thu) và activity tracking (input cho M4). Việc PO cần làm: chạy `node scripts/grant-admin.mjs doduongquang8686@gmail.com` 1 lần + đăng nhập lại + xóa biến `MANICASH_ADMIN_KEY` trên Vercel.

---

## M3 — Quản gia thông minh & Lắng nghe

**Logic tổng:** nâng cấp trải nghiệm chat (streaming trả lời, transaction-draft UI, slash-command tư vấn sâu), mở gói mua thêm lượt (credit-pack 20k/40k/100k qua PayOS), thêm rate-limit chống lạm dụng `/api/chat`, và mở kênh thu thập feedback người dùng có chấm sentiment.

| # | Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `ChatReply.ui.kind` có thêm `transaction-draft` | ❌ KHÔNG | `types.ts:54-58` chỉ có `confirm-transaction \| cfo-card \| follow-up-buttons \| none` |
| 2 | Streaming response chat (ReadableStream) | ❌ KHÔNG | `/api/chat/route.ts` trả `NextResponse.json` đồng bộ |
| 3 | Credit-pack SKU (20k/40k/100k) qua PayOS | ❌ KHÔNG | Chỉ có `PRO_SKUS`, chưa có SKU pack lượt |
| 4 | Rate-limit `/api/chat` theo Firestore | ❌ KHÔNG | Không có logic rate-limit trong route |
| 5 | `/api/feedback` (kèm sentiment engine) | ❌ KHÔNG | Route không tồn tại |

**Kết luận:** M3 chưa bắt đầu. Đáng chú ý: `/api/chat` hiện **không có rate-limit riêng** — cùng với M2 chưa gác admin, đây là 2 khoảng trống bảo mật/chi phí cần ưu tiên trước khi mở rộng traffic trả phí.

---

## M4 — Năng lực & Hướng nghiệp (Sản phẩm 2)

**Logic tổng:** đo 4 chỉ số năng lực người dùng (FDS kỷ luật tài chính, TAS nhạy bén công nghệ, IPS tiềm năng thu nhập, MMS tư duy thịnh vượng) bằng Weighted Scoring 80% deterministic + 20% AI nhận xét → phân nhóm nghề → xuất CV PDF có QR public → dẫn lead vào gói Coach người thật.

| # | Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `prism/capacity/` — engine tính điểm | ✅ CÓ | `capacityEngine.ts`, `capacitySurvey.ts`, `buildCapacity.ts` |
| 2 | Tính đúng 4 chỉ số FDS/TAS/IPS/MMS theo Weighted Scoring | ✅ CÓ | `capacityEngine.ts:71-92` (`computeCapacity()`) |
| 3 | `useCapacitySurveyStore` — khảo sát năng lực hoạt động thật | ✅ CÓ | `useCapacitySurveyStore.ts:23-43` (lưu skills + free-time/tuần) |
| 4 | Xuất CV PDF (`/api/capacity/export-pdf`, `@react-pdf/renderer`) | ❌ KHÔNG | Route không tồn tại, lib chưa có trong `package.json` |
| 5 | Trang public CV slug ẩn danh (`/p/{slug}`) | ❌ KHÔNG | Không có route/layout nào cho việc này |
| 6 | Coach handoff / lead form | ❌ KHÔNG | Không tìm thấy |

**Kết luận:** phần "não" của M4 (chấm điểm năng lực) đã chạy được độc lập — đúng như [AI_CHAT_OVERVIEW.md](AI_CHAT_OVERVIEW.md) mô tả P5 "La Bàn Năng Lực" + P6a "Khảo sát năng lực" đã Live. Nhưng toàn bộ phần biến năng lực thành **tiền** (CV PDF, trang public để chia sẻ, form hứng lead cho Coach) — tức phần thương mại hóa mà M4 được thiết kế ra để phục vụ — **chưa có gì**. Vì M2 (activity tracking) chưa làm, công thức TAS/MMS hiện tại (theo `docs/CAPACITY_LOGIC_SPEC.md`) đang thiếu 1 phần input thật (activity counter), phải tạm suy từ dữ liệu tài chính có sẵn.

---

## Đề xuất thứ tự làm tiếp (dựa trên phụ thuộc thật, không phải thứ tự tài liệu)

1. **Chốt nốt 2 nợ kỹ thuật của M1** (B-01 audit lại nguồn safe-to-spend, B-03 bỏ in-memory fallback) — rẻ, rủi ro thấp, đóng hẳn M1.
2. **M2 Phase D (gác admin bằng Custom Claims)** — ưu tiên cao nhất về bảo mật vì tiền thật đã chảy qua PayOS mà admin vẫn dùng static key.
3. **M2 Phase activity (D6)** — mở khóa đồng thời cho M2 Phase E (đo tần suất) và M4 (TAS/MMS cần input thật).
4. **M3 rate-limit `/api/chat`** — chặn lạm dụng trước khi mở rộng traffic trả phí, tương đối độc lập, làm sớm được.
5. **M4 CV PDF + trang public + Coach handoff** — chỉ nên làm sau khi có activity tracking thật (bước 3), để công thức năng lực không phải "đoán tạm".

---

*File này ghi lại kết quả audit code thật ngày 2026-07-06. Cập nhật lại khi có tiến triển mới — đừng dựa vào % trong `UNIFIED_ROADMAP.md`/`SALES_ADMIN_PAYOS_PLAN.md` vì 2 file đó là kế hoạch gốc (2026-06-14), không phản ánh trạng thái code hiện tại.*
