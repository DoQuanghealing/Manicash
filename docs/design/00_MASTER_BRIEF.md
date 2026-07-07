# ManiCash — Master Design Brief (cho Claude Design)

> Bộ tài liệu này ghi lại **hiện trạng UI thật** của ManiCash (không phải mong muốn, không phải mockup) — dùng để một AI/designer khác **không đọc code** vẫn hiểu đủ để đề xuất thiết kế mới mà không làm mất chức năng nào. Đọc file này trước, rồi đọc các file trang cụ thể.

## 0. Bối cảnh sản phẩm

ManiCash là app quản lý tài chính cá nhân dạng chat cho người Việt, có gamification (XP/rank/streak) và trợ lý AI "Lord Diamond". App chạy trên web (Next.js PWA) + sắp có bản Android (Capacitor). Giao diện luôn mô phỏng khung điện thoại (mobile-first), kể cả khi xem trên desktop.

**Nguyên tắc cứng khi redesign — KHÔNG được vi phạm:**
1. **Không xóa chức năng.** Mỗi nút, mỗi modal, mỗi trạng thái conditional liệt kê trong các file `01`–`04` đều đang phục vụ một mục đích nghiệp vụ thật (tính toán tài chính, gamification, gating Free/Pro). Thiết kế mới phải giữ đủ, chỉ được đổi hình thức trình bày.
2. **Tôn trọng ràng buộc kỹ thuật** (mục 4 dưới đây) — thiết kế phải khả thi để code lại bằng stack hiện có, không cần thay đổi kiến trúc.
3. **Giữ tông màu tối (dark-first)** — đây là bản sắc thương hiệu hiện tại (nền gần đen, glass card, gradient tím-cam). Có thể tinh chỉnh nhưng không đổi hẳn sang nền sáng làm chủ đạo.
4. **Mobile-first, khung 430px** — mọi thiết kế phải fit trong khung điện thoại giả lập, không thiết kế cho desktop rộng.

---

## 1. Design tokens hiện tại (CSS variables, `src/app/globals.css`)

### Màu sắc

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--c-bg-primary` | `#0A0A12` | Nền chính, tối nhất |
| `--c-bg-secondary` | `#13111D` | Header, sidebar |
| `--c-bg-tertiary` | `#1C1930` | Nền card |
| `--c-bg-elevated` | `#231F38` | Modal, popup nổi |
| `--c-text-primary` | `#F4F4F5` | Chữ chính (gần trắng) |
| `--c-text-secondary` | `#A1A1AA` | Chữ phụ (xám) |
| `--c-text-muted` | `#52525B` | Chữ mờ nhất |
| `--c-text-accent` | `#A78BFA` | Chữ nhấn (tím sáng) |
| `--c-success` | `#22C55E` | Thu nhập, hoàn thành, an toàn |
| `--c-warning` | `#F59E0B` | Cảnh báo, cẩn thận |
| `--c-danger` | `#EF4444` | Nguy hiểm, vượt ngưỡng, lỗi |
| `--c-info` | `#3B82F6` | Thông tin |
| `--c-income` | `#22C55E` | Xanh lá — mọi thứ liên quan thu nhập |
| `--c-expense` | `#F97316` | Cam — mọi thứ liên quan chi tiêu |
| `--c-transfer` | `#7C3AED` | Tím — chuyển tiền |

Bộ màu chủ đạo: **Tím `#7C3AED`** (chính) × **Cam `#F97316`** (nhấn) × **Xanh lá `#22C55E`** (success). Gradient thương hiệu: `linear-gradient(135deg, #7C3AED, #F97316)` (`--gradient-primary`) — xuất hiện ở hầu hết nút CTA chính, badge Pro, hero balance.

App hỗ trợ **Light Mode** qua `data-theme="light"` (toàn bộ token override sang nền sáng) — nhưng dark mode là mặc định và là bản sắc chính.

### Glassmorphism (đặc trưng thị giác quan trọng nhất)

Toàn bộ card trong app dùng "kính mờ": nền bán trong suốt + blur + viền mờ + shadow nhẹ.

```
--glass-bg: rgba(255,255,255,0.04)         --glass-bg-hover: rgba(255,255,255,0.07)
--glass-border: rgba(255,255,255,0.06)     --glass-blur: 24px
--glass-shadow: 0 8px 32px rgba(0,0,0,0.3)
```

Class dùng chung: `.glass-card` (có hover), `.glass-card-flat` (không blur), `.glass-surface`.

### Typography

- Font chữ thường: **Inter** (`--font-sans`) — qua `next/font`.
- Font tiêu đề/số liệu lớn: **Outfit** (`--font-display`) — dùng cho heading, số tiền lớn, tên rank.
- Scale: `--text-xs` 12px · `--text-sm` 13px (nút, badge) · `--text-base` 15px (body) · `--text-lg` 17px · `--text-xl` 20px · `--text-2xl` 24px · `--text-3xl` 30px.

### Spacing & bo góc

- Spacing scale (8px-based, nén cho mobile): `--space-xs` 4px · `--space-sm` 8px · `--space-md` 12px (padding cơ bản) · `--space-lg` 16px (padding trang/card) · `--space-xl` 20px · `--space-2xl` 24px.
- Bo góc: `--radius-sm` 8px (nút nhỏ) · `--radius-md` 12px (card, modal) · `--radius-lg` 16px (glass-card lớn) · `--radius-xl` 20px (card cao cấp) · `--radius-2xl` 24px (góc trên bottom-sheet) · `--radius-full` (badge, hình tròn).

### Animation

- Easing chủ đạo: `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out-expo`) — cảm giác "snappy" dứt khoát, không lê thê.
- Duration: 150ms (fast) / 250ms (normal) / 400ms (slow).
- **Framer Motion** dùng cho mọi modal/bottom-sheet: `spring({ stiffness: 300, damping: 30 })`, trượt từ `y: 100%` hoặc `y: 40-100px` lên `y: 0`.
- Nút bấm: `whileTap={{ scale: 0.97 }}` — phản hồi chạm rõ ràng, không mượt-lờ-đờ.
- `canvas-confetti` cho các khoảnh khắc ăn mừng (mới được giảm bớt độ "tưng bừng" theo yêu cầu — xem ghi chú ở cuối file).

### Z-index

`base:1` · `header/nav/modal: 90-100` · `toast: 110` · `confetti: 120`.

---

## 2. Cấu trúc điều hướng

### Khung điện thoại (mobile-shell)

Toàn bộ app render bên trong `.mobile-shell` — kể cả trên desktop, nó bị ép vào khung 430×932px (tỉ lệ iPhone Pro Max), bo góc 44px, viền tối, có notch giả (thanh đen 126×28px ở top), đặt giữa nền `#050510` với 2 vệt glow tím/cam mờ ở 2 góc. **Mọi thiết kế mới phải fit gọn trong khung 430px này** — không thiết kế dạng "desktop dashboard rộng".

### BottomNav — 5 tab, 68px cao

| # | Label | Route | Ghi chú |
|---|---|---|---|
| 1 | Tổng quan | `/overview` | |
| 2 | Sổ sách | `/ledger` | |
| 3 | **Chat** | `/chat` | Nút giữa, nổi bật khác hẳn — xem dưới |
| 4 | Mục tiêu | `/goals` | |
| 5 | Money | `/money` | |

Nút Chat (giữa) là hình tròn 52×52px, nổi cao hơn thanh nav (margin-top âm), gradient tím 3 sắc độ, có glow halo + animation pulse liên tục — thiết kế này cố ý làm nó thành điểm nhấn thị giác mạnh nhất màn hình vì chat là "trái tim" sản phẩm. Tab đang active có gạch ngang gradient tím-cam phía trên icon + icon phóng to 1.12×.

### AppHeader — 56px cao

- **Trái:** avatar tròn 32px (ảnh Google hoặc initials) + lời chào theo giờ trong ngày (cá nhân hóa theo "vibe"/tuổi) + tên user.
- **Phải:** cụm badge gamification trong 1 pill nền mờ: 🔥 streak · 🛡️ số shield (nếu có) · icon+tên rank hiện tại (gradient theo màu rank).

---

## 3. Hệ thống gamification (thị giác)

- **7 rank** (Sắt→Đồng→Bạc→Vàng→Bạch Kim→Lục Bảo→Kim Cương), mỗi rank là 1 khung lục giác (hexagon SVG) với gradient màu + icon emoji riêng + glow neon quanh viền. Badge lớn nhất xuất hiện ở tab Money (HallOfFame).
- **XP Toast**: thông báo nổi góc phải trên, tự biến mất sau 3s, tối đa 4 cái xếp chồng, 3 biến thể màu (dương/âm/bonus đặc biệt).
- **Streak/Shield**: hiện trong AppHeader; khi shield tự dùng để cứu streak, có banner riêng hiện 5.5s ở top.
- **Quest system**: nhiệm vụ điểm danh hàng ngày, thử thách tuần, sự kiện theo mùa, lộ trình tân thủ 7 bước — chi tiết đầy đủ ở file `01_PAGE_OVERVIEW_LEDGER.md` mục "Tổng quan".
- **Lưu ý mới (2026-07):** hệ thống confetti/hiệu ứng ăn mừng vừa được PO yêu cầu **giảm bớt độ phô trương** — nhiệm vụ điểm danh hàng ngày giờ chỉ hiện nút text "Nhận +X XP", không còn tự động bật popup toàn màn hình + pháo hoa ngay khi mở app. Chỉ những cột mốc thật sự hiếm (lên rank, hoàn thành onboarding, sự kiện theo mùa) mới còn hiệu ứng, và cũng đã giảm nhẹ. **Khi redesign, giữ tinh thần "sang trọng, tiết chế" này — đừng đề xuất thêm hiệu ứng ồn ào.**

---

## 4. Ràng buộc kỹ thuật (để thiết kế khả thi khi code lại)

- **Next.js App Router + React 19 + TypeScript.** Styling = Tailwind v4 (utility, không có file config custom) **+ 1 file CSS riêng cho mỗi component** (pattern: `Component.tsx` đi kèm `Component.css`, dùng biến `var(--...)` chứ không hardcode). Thiết kế mới nên tương thích pattern component-based này, không đề xuất 1 file CSS khổng lồ.
- **Framer Motion** cho mọi animation/transition — đề xuất animation nên mô tả được bằng spring/easing thay vì hiệu ứng cần thư viện mới.
- **canvas-confetti** cho hiệu ứng hạt — đã có sẵn, nhưng đang chủ động dùng ít lại (xem mục 3).
- **lucide-react** là bộ icon đang dùng toàn app — nếu đề xuất icon mới, ưu tiên chọn icon có trong bộ này để dễ code lại (hoặc icon set tương thích phong cách outline mảnh tương tự).
- Không dùng UI framework nặng (MUI, AntD...) — mọi component tự viết. Đề xuất thiết kế nên giữ được sự "nhẹ" này (không cần table phức tạp, không cần data-grid).
- App có **Light Mode** hoạt động song song (qua `data-theme`) — nếu redesign đổi bảng màu dark, cần cân nhắc có tương ứng light mode hay không (không bắt buộc nhưng nên lưu ý).

---

## 5. Danh sách file trong bộ brief này

| File | Nội dung |
|---|---|
| `00_MASTER_BRIEF.md` | File này — design system, nav, ràng buộc kỹ thuật |
| `01_PAGE_OVERVIEW_LEDGER.md` | Trang Tổng quan (`/overview`) + Sổ sách (`/ledger`) — chi tiết từng block, nút, modal |
| `02_PAGE_CHAT_MONEY.md` | Trang Chat (`/chat`) + Money/CFO (`/money`) |
| `03_PAGE_GOALS_INPUT.md` | Trang Mục tiêu (`/goals`) + Nhập giao dịch (`/input`) |
| `04_PRICING_SALES_PAGE_BRIEF.md` | Hiện trạng bán hàng (PricingModal/Cards) + **brief cho trang bán hàng mới cần thiết kế** |

Mỗi file trang liệt kê theo đúng thứ tự xuất hiện trên màn hình thật (từ trên xuống dưới), gồm: tên block → mục đích/nguồn dữ liệu → mọi nút bấm và logic của nó → modal liên quan → animation đặc biệt → điều kiện ẩn/hiện/empty-state. Đây là tài liệu kỹ thuật, ưu tiên đầy đủ.
