# ManiCash — Handoff phiên (2026-07-06 → 07-07)

Tóm tắt để **chuyển sang phiên/cửa sổ mới**. Mọi việc dưới đây **đã commit + push lên `origin/main`** (Vercel auto-deploy, đã live trên `www.manicash.org`). Tree sạch, `main` == `origin/main`.

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
- **CÒN LẠI cần xác nhận**: PO chưa hoàn tất 1 giao dịch test end-to-end để xác nhận webhook thực sự cấp Pro đúng 1 lần. Nên test 1 lần trước khi yên tâm mở bán rộng.
- ⚠️ Route `create-link` còn nhánh debug `admin_test` (lộ stack trace qua admin key) — **nên gỡ** sau khi test xong (commit `8933874`/`f5bedf0`).

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

- **M1 gần xong** (`docs/M1_M4_PROGRESS_AUDIT.md`): PayOS/trial/tier/3 bug nền (B-01/02/03) đã code xong. Chỉ còn test webhook end-to-end + gỡ nhánh debug `admin_test`.
- **M2 = 0%** (rủi ro bảo mật): `/api/admin/*` vẫn dùng static key `MANICASH_ADMIN_KEY`, chưa có Custom Claims + `requireAdmin`, chưa có `/api/admin/metrics`, chưa có activity tracking — trong khi tiền thật đã chảy. **Nên ưu tiên khi quay lại backend.**
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
