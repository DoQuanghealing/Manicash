# ManiCash — Handoff phiên (2026-07-06 → 07-07)

Tóm tắt để **chuyển sang phiên/cửa sổ mới**. Mọi việc dưới đây **đã commit + push lên `origin/main`** (Vercel auto-deploy, đã live trên `www.manicash.org`). Tree sạch, `main` == `origin/main`.

---

## 0. PHIÊN 2026-07-07 (chiều/tối) — ĐÃ COMMIT LOCAL, CHƯA PUSH

**Đã làm:**
1. **M1 đóng hoàn toàn:** gỡ sạch nhánh debug `admin_test` khỏi `create-link/route.ts`; webhook xác nhận end-to-end (giao dịch 10k thật → app tự cấp Pro).
2. **M2 phần bảo mật XONG:** thay static key `MANICASH_ADMIN_KEY` bằng **Firebase Custom Claims**. File mới `src/lib/requireAdmin.ts` (verify Bearer ID token + `admin===true` + `checkRevoked`) + `src/lib/adminAudit.ts` (ghi `admin_audit`). Áp cho `admin/bans`, `admin/test-account`, `payos/confirm-webhook`. Client `AdminDashboardContent.tsx` gác theo claim. Script cấp quyền `scripts/grant-admin.mjs`. tsc + build sạch.
3. **Blueprint Admin/CRM/R&D** (hội đồng 5 chuyên gia + phản biện): `docs/ADMIN_CRM_RND_BLUEPRINT.md` + Artifact trực quan. Xem memory `project-admin-crm-rnd-blueprint`.

**PO cần làm (khi push xong + Vercel deploy):** `node scripts/grant-admin.mjs doduongquang8686@gmail.com` (tài khoản admin — KHÔNG phải freshlife1381) → đăng xuất/đăng nhập lại → xóa biến `MANICASH_ADMIN_KEY` trên Vercel.

**2 ràng buộc PO chốt:** (a) **DuongQuang.Academy KHÔNG ĐỤNG** (chỉ deep-link/read-only/clone; cấm gọi tool `manicash_*`); (b) **Firebase GIỮ NGUYÊN**, Supabase chỉ cân nhắc cho tầng R&D/analytics mới.

**MAI TIẾP TỤC — chọn 1:**
- **Việc ngay #1 khuyến nghị:** M1 Tiền (bảng đơn + grant thủ công + đối soát "đã trả chưa cấp Pro") — quick win, data sẵn Firestore.
- Hoặc bật pipeline `metric_snapshots` (đồng hồ R&D — không hồi tố được, nên bật sớm).
- Trước khi làm tầng chữa lành: viết `docs/ETHICS_CHARTER.md` + consent 3 tầng (dữ liệu nhạy cảm, Nghị định 13/2023).
- **Chưa push** — chờ PO xác nhận push (Vercel auto-deploy từ main khi push).

**Untracked chưa commit (không thuộc phiên này, để nguyên):** `ManiCash_*Report*.md/.docx`, `docs/AI_CHAT_OVERVIEW.md`, `docs/P6_*.md`, `landing/`.

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
