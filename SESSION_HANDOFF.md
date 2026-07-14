# ManiCash — Handoff phiên (2026-07-09) — Hardening + Overview redesign + PV-2

> **✅ ĐÃ PUSH `origin/main` = `5e74d75`** (Vercel auto-deploy). Tree sạch. 3 commit phiên này:
> `44befdd` rate-limit /api/chat · `7900e4a` redesign Tổng quan (Số dư khả dụng) · `5e74d75` PV-2 đề xuất chủ động.
> Verify mọi bước: `tsc` sạch · `npm run build` ✓ · lint sạch · test mới đều PASS. PO xem trên web.

## Đã làm phiên này
1. **Rate-limit `/api/chat`** (`44befdd`) — `lib/rateLimit.ts` sliding-window per-uid (12/10s + 40/phút), 429+Retry-After. LLM routes (parse/cfo-narration) đã có credit-quota sẵn. Env chỉnh: `RATE_LIMIT_CHAT_MAX_0/1`. Test 7/7.
2. **Redesign Tổng quan — "Số dư khả dụng"** (`7900e4a`) — bỏ "−0đ đỏ lòm". Card **navy**, mặc định GỌN (số dư nổi + tình trạng), xổ ra ĐẦY ĐỦ (breakdown bấm-từng-dòng + lý do + action). Che số mặc định (nút mắt, `settings.hideBalance`). **4 trạng thái** `accountStatus.ts` (xuatsac/tot/trungbinh/canhbao) + drill-down `balanceBreakdown.ts` (đều pure, test 10/10). Nút Thanh toán→`/ledger?tab=bills` (LedgerContent giờ đọc `?tab=`). **Chưa có mô hình "nợ" thật** — suy từ số dư âm.
3. **PV-2 Đề xuất chủ động** (`5e74d75`) — Phú Vương "sống". `coach/suggestionEngine.ts` (7 tín hiệu→gợi ý xếp ưu tiên) + `CoachSuggestionCard` (block Tổng quan, **chỉ sovereign**, 1 gợi ý/lần, action=điều hướng KHÔNG tự đổi tiền, bỏ qua=cooldown 3 ngày) + `useCoachSuggestionStore` (clear account-boundary). Test 6/6.
4. **Roadmap chi tiết** `docs/PHU_VUONG_BUILD_ROADMAP.md` (PV-1..PV-6) + spec `docs/FINANCIAL_DNA_SPEC.md` + `docs/ETHICS_CHARTER.md` (từ phiên trước, nay commit).

## 🔜 MAI TIẾP TỪ ĐÂY — PV-3 Financial DNA
Bài test năng lực+thói quen+**tâm lý tiền** → persona (5 money-script) → giải pháp+nâng tư duy. Chi tiết: `FINANCIAL_DNA_SPEC.md`. Lấp `growthOrientation` (đang để 50) = Oracle.
**CHỜ PO CHỐT 3 điều trước khi code (ghi cuối `PHU_VUONG_BUILD_ROADMAP.md`):**
1. Duyệt **bộ câu hỏi** (Claude soạn nháp Phần A + 3 câu viết → PO chỉnh).
2. **Lưu raw phần viết** hay chỉ lưu bản phân tích (an toàn hơn)?
3. Bản đầy đủ: Free tốn 1 credit/lần hay khoá hẳn sau **Pro Plus**?
> Việc kế đã hứa PO: Claude soạn **bộ câu hỏi nháp PV-3** để duyệt.

## Việc treo khác
- **PV-4 money sync per-user** — chờ PO bàn kỹ (dữ liệu nhạy cảm) + câu chữ consent tầng 3.
- **`/api/feedback`** — chưa có (nên làm trước khi mở test rộng).
- Hydrate `butlerTier` từ server (hiện per-device) · mô hình "nợ" thật · che số ra cả ô Thu/Chi.
- Demo Phú Vương: tạm hạ `STREAK_GATE` trong `SovereignInvite.tsx`.

---

# ManiCash — Handoff phiên (2026-07-08b) — Phú Vương 🐉

> **✅ ĐÃ PUSH `origin/main` = `d6ce825`** (Vercel auto-deploy). Bao gồm cả 5 commit cũ (admin S0-S4 + telemetry + butler onboarding) + 2 commit mới phiên này. Tree sạch.
> Verify: `tsc` sạch · `npm run build` ✓ · lint chỉ 1 warning (setState-in-effect, giống `ButlerOnboarding`). **Chưa smoke tài khoản thật** — PO đang lên web check.

## Đã làm phiên này (Phú Vương = tier quản gia thứ 3)
**Thiết kế + 3 doc:** `docs/BUTLER_PHU_VUONG_SCRIPT.md` (kịch bản+copy KHOÁ) · `docs/ETHICS_CHARTER.md` (3 tầng consent, NĐ 13/2023) · `docs/PHU_VUONG_BUILD_ROADMAP.md` (P1/P2/P3). Artifact HTML mô phỏng mở rộng AI: https://claude.ai/code/artifact/5a029bfc-6600-41dc-911e-f020810c6cf2 (bản repo: `docs/AI_EXPANSION_RESEARCH.html`).

**Code P1 (commit `d6ce825`):** `ButlerTier += 'sovereign'` · `useSovereignInviteStore` · consent route thêm scope `sovereign` (ghi `sovereignConsent`) · `lib/butler/sovereignArchetype.ts` (kỹ năng→nhóm nghề) · `SovereignInvite.tsx`+css (modal 3 bước, tái dùng `CapacitySurveyCard`) · `ButlerSettingsCard` 3 trạng thái · mount `(app)/layout`. **Tự mở:** tier=Thông thái & streak≥14 & chưa sovereign & cooldown 14 ngày. Đã xóa file mồ côi `AnalyticsConsentToggle.tsx`.

**Quyết định PO chốt:** Phú Vương **mở cho cả Free** (FOMO) → sau tách năng lực cao cấp lên **Pro Plus**. Teaser Bước 2 **KHÔNG số thu nhập** (thu nhập cao đọc "15-25tr" là toạch) — chỉ nhóm nghề + điểm mạnh.

## Việc còn treo — Phú Vương
1. **PO test trên web** (deploy xong): tài khoản streak≥14 + tier Thông thái → lời mời tự hiện. Để demo dễ, có thể tạm hạ `STREAK_GATE` trong `SovereignInvite.tsx`.
2. **P2 (chờ PO chốt money sync):** bật money sync per-user khi sovereign (gate = env flag AND sovereignConsent) + hàng đợi card đề xuất chủ động (`earningPlanner` sẵn) + hydrate tier từ server (hiện per-device).
3. **P3:** Oracle 4 phần (GPT-4o-mini, credit) · CV PDF · Coach handoff · tách gói Pro Plus.
4. Cho nhóm người test xin feedback (PO nói).

---

# ManiCash — Handoff phiên (2026-07-08a) — Admin S0-S4

> **(Đã push — xem block trên.)** Verify: `tsc` sạch · `npm run build` ✓ · lint sạch phần mới.

## Đã làm phiên 2026-07-08 (theo `docs/ADMIN_BUILD_ROADMAP.md`)

**S0–S4 admin (đóng):**
- Route group `src/app/(admin)/` + **AdminShell** sidebar (`useAdminGate`, `src/lib/adminClient.ts`), park khỏi mobile export. `/admin` cũ (ban) → `/admin/security`.
- `/admin` Tổng quan (KPI doanh thu/Pro/DAU + hàng đợi) · `/admin/money` (biểu đồ doanh thu + **đối soát 3 nhóm lệch** + bảng đơn + grant tay) · `/admin/users` (danh bạ **Firebase Auth ⨝ Firestore** + Customer 360 + grant/revoke/ban/test + deletion list) · `/admin/audit`.
- Libs: `src/lib/admin/{directory,overview,audit}.ts` + `src/lib/monetization/reconcile.ts`. API: `/api/admin/{payments,grant,users,overview,audit}`.

**S4 metric_snapshots — ĐÃ BẬT (PO duyệt):**
- `analyticsConsent` + `/api/telemetry/{consent,snapshot}` (chặn nếu chưa consent/test) + `MetricSnapshotCollector` (1 lần/ngày, mount `(app)/layout`) + xóa snapshot khi xóa tài khoản.
- **Consent được reframe = chọn cấp "Thông thái" của quản gia** (KHÔNG dùng chữ "theo dõi/gửi dữ liệu" — PO yêu cầu). `docs/DATA_FOR_GROWTH.md` = cơ sở câu chữ.

**Làm quen quản gia (M3-ish, commit `95a4b9b`):**
- `ButlerOnboarding` wizard (nhập vai → danh xưng cô/cậu/tổng tài/custom → tên quản gia + gợi ý → **cấp độ Bình dân|Thông thái** → hướng dẫn). Mount global, tự mở khi `!butlerOnboarded`.
- Thông thái + xác nhận = bật consent; Bình dân = off. Nút "quản gia cần thông thái hơn" ở Hồ sơ (`ButlerSettingsCard`, `useButlerWizardStore` mode 'tier').
- `useSettingsStore` thêm `honorific/butlerTier/butlerOnboarded`.
- Lệnh `/cfo` → mở `/report` + lưu lệnh trong chat (`AiMoneyChatContent` + `prismSuggestions`).

**Hệ sinh thái:** `src/data/ecosystemLinks.ts` + mục "Hệ sinh thái" trong Hồ sơ (deep-link Academy, mở tab mới, KHÔNG đụng Academy). **PO sẽ điền URL video thật.**

## Việc còn treo / PO cần làm
1. **Push khi PO cho deploy** (4 commit trên). Sau deploy: đăng nhập kiểm tra wizard + `/admin`.
2. **Xóa file mồ côi** `src/app/(app)/profile/_components/AnalyticsConsentToggle.tsx` (đã thay bằng ButlerSettingsCard) — CHỜ PO OK.
3. **Điền URL video/khoá Academy** vào `ecosystemLinks.ts`.
4. PO quyết money sync (dữ liệu hành vi Customer 360) — "bàn kỹ trước khi bật".
5. CRM deep-link trong admin (xem hồ sơ Academy) — PO bảo "sau".

## Đề xuất tiếp
Thiết kế thẻ `/báo cáo` nhanh trong chat · thêm capacity (FDS/TAS/IPS/MMS) vào snapshot · S5 nối định danh / S6 R&D dashboard / M1.4 refund.

---

# ManiCash — Handoff phiên (2026-07-06 → 07-07)

Tóm tắt để **chuyển sang phiên/cửa sổ mới**. Mọi việc dưới đây **đã commit + push lên `origin/main`** (Vercel auto-deploy, đã live trên `www.manicash.org`). Tree sạch, `main` == `origin/main`.

---

## 0. PHIÊN 2026-07-07 — ĐÃ PUSH LÊN origin/main (Vercel auto-deploy)

**3 commit của phiên này (đã push):**
| Commit | Nội dung |
|---|---|
| `fe6166c` | M2 gác admin bằng Firebase Custom Claims + `adminAudit` + `grant-admin.mjs`; gỡ debug `admin_test` (M1 đóng); blueprint + audit doc |
| `a575cb8` | Khóa cứng admin về **đúng 1 email** + nút "Trang quản trị" trong Profile + roadmap doc |

### Đã làm
1. **M1 ĐÓNG HOÀN TOÀN:** gỡ nhánh debug `admin_test`; webhook đã xác nhận end-to-end (giao dịch 10k thật → app tự cấp Pro).
2. **M2 bảo mật admin XONG:** thay static key `MANICASH_ADMIN_KEY` → **Firebase Custom Claims**. `src/lib/requireAdmin.ts` (Bearer ID token + `admin===true` + `checkRevoked`) + `src/lib/adminAudit.ts` (ghi `admin_audit`). Áp cho `admin/bans`, `admin/test-account`, `payos/confirm-webhook`. Client `AdminDashboardContent.tsx` gác theo claim.
3. **Khóa cứng đúng 1 email admin** = `doduongquang8686@gmail.com` (3 lớp: Custom Claim + allowlist `src/lib/adminEmails.ts` + `email_verified`). Chặn mọi email khác kể cả khi bị set nhầm claim. **Nút "Trang quản trị"** ở Profile chỉ hiện với email admin. `grant-admin.mjs` từ chối cấp cho email ngoài allowlist.
4. **Blueprint + Roadmap:** `docs/ADMIN_CRM_RND_BLUEPRINT.md` (hội đồng 5 chuyên gia + phản biện) + `docs/ADMIN_BUILD_ROADMAP.md` (8 sprint S0→S7+). Artifact trực quan: https://claude.ai/code/artifact/afd76e88-fb87-45ca-a9ef-a8e73ae50ffd

### ⚠️ PO LÀM 1 LẦN (sau khi Vercel deploy xong bản này)
1. `node scripts/grant-admin.mjs doduongquang8686@gmail.com` (chạy local, đọc `.env.local`).
2. Đăng xuất → đăng nhập lại app bằng chính `doduongquang8686@gmail.com`.
3. Vào Profile → thấy nút **"Trang quản trị"** → bấm vào `/admin` chạy được.
4. Xóa biến `MANICASH_ADMIN_KEY` trên Vercel (không còn dùng).

### 2 RÀNG BUỘC PO ĐÃ CHỐT (bất biến — xem blueprint §12)
- **(a) DuongQuang.Academy TUYỆT ĐỐI KHÔNG ĐỤNG.** Chỉ deep-link / read-only / clone. **CẤM gọi mọi tool `manicash_*`** (kể cả đọc) khi chưa hỏi PO — xem memory `feedback-never-touch-academy`.
- **(b) Firebase GIỮ NGUYÊN** cho lõi. Supabase chỉ cân nhắc cho tầng R&D/analytics MỚI, làm sau. Không migrate lõi.

### 🔜 PHIÊN MỚI TIẾP TỤC TỪ ĐÂY (theo `docs/ADMIN_BUILD_ROADMAP.md`)
**S0 còn lại:** route group `(admin)` + AdminShell (sidebar 9 module) + loại `(admin)` khỏi static export mobile (guard `next.config`, tránh vỡ build Android).
**S1 — M1 Tiền (khuyến nghị làm tiếp ngay):** bảng đơn (`payment_intents`+`payments_index`+`grant_events`) + grant Pro thủ công + **widget đối soát "đã trả chưa cấp Pro"** (quan trọng nhất — chống mất tiền khách). Data đã sẵn Firestore, không phụ thuộc quyết định nào.
**S4 song song (ưu tiên cao):** bật `metric_snapshots` — đồng hồ R&D "người tốt lên", không hồi tố được.
**Trước tầng chữa lành:** viết `docs/ETHICS_CHARTER.md` + consent 3 tầng (dữ liệu nhạy cảm, Nghị định 13/2023).

### Câu PO còn cần chốt (không chặn S0–S1)
1. Academy có endpoint đọc để read-only pull không? (nếu không → chỉ deep-link) — chặn S5.
2. Consent 3 tầng: nội dung + vị trí onboarding — chặn S4 (consent) & chữa lành.
3. Path `/admin` (mặc định) hay subdomain admin — chưa cần quyết bây giờ.

### Untracked KHÔNG thuộc phiên này (để nguyên, chưa commit)
`ManiCash_*Report*.md/.docx`, `ManiCash_Landing_Brief.md`, `docs/AI_CHAT_OVERVIEW.md`, `docs/P6_*.md`, `landing/`.

---

## 1. Đã làm trong phiên này (theo commit, cũ → mới)

| Commit | Nội dung |
|---|---|
| `4914a3d` | chore(cfo): xóa dead code `getCFONarrative`/`getFallbackNarrative`/`buildUserPrompt` trong `groqClient.ts` (đã thay bằng `aiMoneyChat/cfo/`); thêm `docs/M1_M4_PROGRESS_AUDIT.md` |
| `1fe5bd8` | fix(payos): thêm `GET` handler cho `/api/payos/webhook` trả 200 (PayOS confirm-webhook probe URL trước khi đăng ký) |
| `f5bedf0` | feat(payos): thêm SKU ẩn `admin_test` (10.000đ) trong `/api/payos/create-link` — chỉ gọi được với `x-admin-key`, để test end-to-end webhook |
| `8933874` | debug(payos): bọc `create-link` bắt mọi exception, lộ chi tiết lỗi qua đường admin_test |
| `7f909a3` | docs(firebase-admin): ghi lại sự cố thiếu `FIREBASE_ADMIN_PROJECT_ID` trên Vercel |
| `eeb52c2` | feat(ux): `/payment/success` auto-poll 3s (Pro tự kích hoạt không cần reload); giảm confetti nhiệm vụ điểm danh (chỉ text "Nhận +X"); popup `ProActivatedCelebration` trong app khi mua Pro xong |
| `6ee80df` | **feat(ui): redesign nền tảng + Tổng quan** — token mới, Nav/Header, gộp 5 banner → `AlertsInbox`, hero breakdown ẩn sau nút, lưới 2×2 `MoneyGrid`, **3 route mới** `/overview/{income,expenses,funds}` |
| `f8e9e8e` | **feat(ui): restyle Upgrade/Profile/Report/Input/Chat** — trang bán hàng `/upgrade` làm mới hoàn toàn; Profile + rank roadmap + toggle light-mode; `/report` đổi tông champagne + Playfair |

Verify mỗi bước: `tsc --noEmit` sạch · `npm run build` ✓ (đủ route mới) · `test:ai-all` **76 PASS/0 FAIL**.

---

## 2. PayOS — ĐÃ KÍCH HOẠT THẬT (điểm quan trọng nhất phiên này)

- **Flag production đã BẬT**: `NEXT_PUBLIC_MONETIZATION_ENABLED=true`, `NEXT_PUBLIC_PAYOS_ENABLED=true`, đủ 3 key PayOS trên Vercel. **App đang nhận thanh toán thật** (key MB Bank live, không phải sandbox).
- **Sự cố đã vá**: production thiếu `FIREBASE_ADMIN_PROJECT_ID` → mọi route dùng Admin SDK crash 500 (create-link, admin, quota, grantTrial). PO đã thêm biến này trên Vercel + redeploy → fix.
- **Webhook đã đăng ký**: URL `https://www.manicash.org/api/payos/webhook` khai trong PayOS dashboard (mục Kênh thanh toán → Webhook Url). ĐÃ test tạo link 10k thật thành công (order `17833182364391`, uid `paWktjkNZ4eXMzaixH3suNivChD3` = doduongquang8686@gmail.com).
- ✅ **ĐÃ XÁC NHẬN end-to-end (2026-07-07)**: giao dịch test 10.000đ thật → PO vào app thấy Pro **đã tự kích hoạt** qua webhook. Luồng thanh toán→webhook→cấp Pro chạy đúng. M1 đóng hoàn toàn (code + vận hành).
- ✅ Route `create-link` **đã gỡ sạch nhánh debug `admin_test`** (2026-07-07) — không còn SKU test ẩn, không còn đường lộ stack trace qua admin key. Route giờ chỉ nhận `PRO_SKUS` + bắt buộc Bearer như bình thường.

---

## 3. UI Redesign (19 màn từ Claude Design) — trạng thái trung thực

Nguồn: `Redesign Web App UI.zip` (giải nén ở scratchpad), brief gốc mình viết ở `docs/design/00-04_*.md`.

**Làm ĐẦY ĐỦ (divergence cao):**
- Design tokens + BottomNav (FAB Chat) + AppHeader
- **Tổng quan**: `AlertsInbox` (gộp 5 banner), hero Safe-to-Spend gọn, `MoneyGrid` 2×2 entry-tiles
- **3 route chi tiết mới** `/overview/{income,expenses,funds}` (chuyển từ modal → trang, `DetailPageHeader` chung) — logic/biểu đồ giữ nguyên từ `IncomeBlock`/`ExpenseBillBlock`/`FundsBlock`
- **/upgrade**: sales page mới (hero cảm xúc + rank-up, 3 lý do, FAQ accordion) bọc quanh `PricingCards` (giá/logic KHÔNG đổi); social-proof để placeholder
- **/profile**: + rank roadmap 7 hexagon + section cá nhân hoá (toggle light-mode chạy thật qua `useSettingsStore.toggleTheme`); giữ đủ badges/Bát Tự/legal/danger
- **/report**: recolor Emerald→champagne warm-neutral + Lora→Playfair Display (logic data giữ nguyên)

**Chỉ tinh chỉnh NHẸ (cấu trúc cũ vốn đã gần khớp mock):**
- Sổ sách, Mục tiêu, Money, Input (chỉ bump amount 44px), Chat (chỉ Dynamic-Island header CSS)

**CHƯA làm sâu (rủi ro cao, cần quyết định nếu muốn tiếp):**
- Chat (file `AiMoneyChatContent.tsx` 1612 dòng): chưa restructure composer kiểu Telegram đầy đủ, chưa fuse Daily+Weekly quest thành 1 card liền như mock
- Chưa pixel-match từng chi tiết nhỏ mọi màn — **PO đang xem trực tiếp trên web để feedback**

**Lưu ý**: PO thích xem UI trực tiếp trên web (không cần Claude tự screenshot — preview local bị AuthGuard chặn). Chờ PO chụp màn feedback để chỉnh tiếp.

---

## 4. Việc backlog còn treo (ngoài UI)

- ✅ **M1 ĐÓNG HOÀN TOÀN** (`docs/M1_M4_PROGRESS_AUDIT.md`): PayOS/trial/tier/3 bug nền (B-01/02/03) code xong; nhánh debug `admin_test` đã gỡ (2026-07-07); webhook end-to-end đã xác nhận thật (giao dịch 10k → app cấp Pro). Không còn nợ gì.
- **M2 phần bảo mật XONG (2026-07-07)**: `/api/admin/*` + `confirm-webhook` giờ gác bằng Firebase Custom Claims (`requireAdmin` verify Bearer ID token + `admin===true` + `checkRevoked`), đã xóa hẳn static key `MANICASH_ADMIN_KEY` + fallback hardcode + nhánh `?key=`; thêm audit log `admin_audit`; client `/admin` gác theo claim. Cấp quyền: `node scripts/grant-admin.mjs doduongquang8686@gmail.com` (1 lần) + đăng nhập lại. **Còn lại M2**: `/api/admin/metrics` (doanh thu) + activity tracking — chưa làm.
- **M3 = 0%**: chưa có rate-limit `/api/chat`, chưa credit-pack, chưa `/api/feedback`.
- **M4 ~50%**: engine năng lực (FDS/TAS/IPS/MMS) chạy; chưa CV PDF, chưa trang public slug, chưa Coach handoff.
- **Mobile store**: Android code xong (chỉ cần PO tự làm máy/account); iOS chưa bắt đầu + cần chốt Apple IAP (PayOS sẽ bị Apple reject). Xem memory `project-mobile-store-readiness`.

---

## 5. Ràng buộc / quy ước (giữ nguyên)
- Shell = PowerShell (Bash tool có sẵn). Path alias `@ = src/`.
- **Không push remote mà không PO confirm**; commit message tiếng Anh ngắn.
- **Trước push BẮT BUỘC `npm run build`** (bắt lỗi bundle firebase-admin).
- User mới phải thấy số 0; mọi SEED gate sau `NEXT_PUBLIC_DEMO_MODE`.
- Không xóa/rename Zustand store bừa; không commit `.env.local`.
- Pattern UI: mỗi component 1 file `.css` cùng tên, dùng `var(--token)`, Tailwind v4 + Framer Motion + lucide-react. Không copy khối HTML từ file `.dc.html`.

## 6. Lệnh nhanh
- dev `npm run dev` · build `npm run build` · test AI `npm run test:ai-all` · tsc `npx tsc --noEmit`
- File thiết kế redesign: `docs/design/00-04_*.md`; zip gốc ở Downloads `ui manicash/Redesign Web App UI.zip`.
