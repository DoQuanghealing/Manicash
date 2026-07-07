# Trang Tổng quan (/overview) & Sổ sách (/ledger)

> Đọc `00_MASTER_BRIEF.md` trước để hiểu design token, nav, ràng buộc kỹ thuật. File này liệt kê chi tiết từng block UI theo đúng thứ tự xuất hiện trên màn hình thật (top → bottom).

---

# TRANG TỔNG QUAN (/overview)

Đây là màn hình mặc định khi mở app — trộn giữa dashboard tài chính và bảng điều khiển gamification. Rất nhiều block, phần lớn **conditional** (chỉ hiện khi có dữ liệu/điều kiện liên quan) để tránh rối mắt khi không cần thiết.

### Block 0 — Seasonal Event Banner
Banner sự kiện theo mùa (Tết, lễ...), tự ẩn khi không có sự kiện active. Bấm vào mở modal full: icon sự kiện + tiến độ (N/K chương) + danh sách chương (mỗi chương có scenario, hint, phần thưởng, nút hành động dẫn tới nơi cần làm) + phần thưởng cuối cùng khi hoàn thành hết chương. Modal có thể mở `CheckInModal` lồng bên trong nếu chương yêu cầu điểm danh.

### Block 0b — Upcoming Holiday Hint
Banner nhỏ, chỉ thông tin (không bấm được), báo ngày lễ âm lịch sắp tới trong 30 ngày (nếu chưa trùng sự kiện đang active ở Block 0).

### Block 1 — Safe-to-Spend Card ⭐ (quan trọng nhất trang)
Card chính, to nhất, hiển thị **"Số dư an toàn để chi tiêu thêm"** — con số quan trọng nhất toàn app.
- Badge trạng thái: 🔴 Nguy hiểm / 🟡 Cẩn thận / 🟢 An toàn (theo ngưỡng số dư).
- Số tiền lớn (đổi màu đỏ + dấu trừ nếu âm).
- Breakdown 5 dòng: Tổng thu nhập tháng · (nếu có) Dư tháng trước · trừ Ngưỡng chi tiêu · trừ Bill chưa đóng · trừ Mục tiêu tiết kiệm/tháng.
- **Nút info (i)** cạnh label → mở modal giải thích công thức tính bằng lời + code block màu, kèm nút "Đã hiểu" đóng lại.
- **Card cảnh báo phụ (conditional)**: nếu âm → hiện box gợi ý 4 cách xoay tiền (đòi nợ cũ, kiếm thêm, xin gia đình, mượn); nếu thấp (0 → 1 triệu) → hiện khuyến khích lập kế hoạch kiếm thêm.

### Block 1a — Pending Transaction Banner
Chỉ hiện khi có giao dịch từ SMS webhook chờ xác nhận. Header bấm để mở/đóng danh sách, mỗi item có nút Xác nhận/Từ chối.

### Block 1b — Budget Warning Banner
Chỉ hiện khi có ≥1 danh mục vượt ngưỡng chi tiêu tháng. Liệt kê tối đa 3 danh mục, mỗi cái có progress bar đỏ/cam + % + số tiền đã chi/ngưỡng.

### Block 1c — Idle Money Banner
Chỉ hiện khi ví chính có > 100 triệu nhàn rỗi **và** có mục tiêu chưa hoàn thành. Gợi ý số tiền nên chuyển sang mục tiêu, bấm vào → điều hướng `/goals`. Có nút "X" để ẩn 24h (lưu localStorage).

### Block 2 — Income Block (full-width)
Card thu nhập với biểu đồ đường tích lũy.
- Toggle 4 khoảng thời gian: Ngày / Tuần / Tháng / Năm — đổi cách tính và nhãn trục X biểu đồ.
- Nút "🏦 [Tên ngân hàng]" cạnh subtitle → mở `WalletBankModal` (quản lý thông tin 3 tài khoản ngân hàng).
- Biểu đồ SVG: đường cong mượt (Catmull-Rom) + vùng tô gradient xanh lá mờ dần, có điểm dữ liệu (chấm tròn) và tooltip giá trị.

### Block 3 — Expense & Bills Block (2 cột)
Card phức tạp nhất trang, chia 2 phần trên (funding status) và 2 cột dưới (Chi tiêu / Hóa đơn).

**Phần trên — trạng thái nạp quỹ:**
- "Tài khoản chi tiêu hiện có": số dư hiện tại + mục tiêu cần nạp cho tháng + nút xem lịch sử nạp + progress bar + trạng thái đủ/thiếu tiền.
- "Ngân sách tháng": công thức = ngưỡng hằng ngày + hóa đơn cố định, kèm nút mở biểu đồ funding riêng.

**2 cột:**
- **Cột Chi tiêu**: icon túi cam, tổng đã chi (đỏ nếu vượt ngân sách), số còn lại có thể chi, progress bar. Bấm mở modal chi tiết: biểu đồ cột 7 ngày gần nhất + danh sách 12 giao dịch gần nhất + nút "Xem đầy đủ ở Sổ sách".
- **Cột Hóa đơn**: icon thẻ tím, huy chương 🏅 nếu đã đóng hết tháng này, tổng tiền, đã đóng/chưa đóng, dãy ô vuông màu theo trạng thái từng bill (ô chưa đóng có animation nhấp nháy nhẹ, ★ nếu bill giá trị cao). Bấm mở modal chi tiết: 2 nhóm Đã đóng / Chưa đóng-sắp đến hạn, mỗi bill có nhãn trạng thái (quá hạn đỏ / sắp hạn vàng / bình thường).

### Block 4 — Funds Block (3 cột)
Card 3 quỹ tiết kiệm: **Dự phòng** (khóa 🔒 nếu is_locked) · **Mục tiêu** · **Đầu tư**. Mỗi cột hiện số tiền theo kỳ (tuần/tháng/năm, có toggle riêng ở header). Bấm 1 cột → mở modal chi tiết quỹ đó: toggle Tháng/Năm, biểu đồ đường (tháng) hoặc cột (năm) 12 tháng, lịch sử đóng góp/tổng kết theo tháng.

### Block 5 — Wishlist Popup (auto, conditional)
Chỉ tự bật khi có item wishlist vừa hết "thời gian làm mát" (cooling period). Cho 2 lựa chọn: Mua (ghi nhận, dẫn sang `/input`) hoặc Từ chối (tính là chiến thắng kỷ luật, cộng XP, hiện số tiền tiết kiệm được). Có nút X để bỏ qua tạm thời.

### Block 6a — Onboarding Quest Panel
Chỉ hiện với user mới, tự ẩn khi hoàn thành hết 7 bước. Card thu gọn hiện bước hiện tại + progress bar, bấm mở modal full: chi tiết bước đang làm (kịch bản, gợi ý cách làm, phần thưởng), preview 3 bước tiếp theo, danh sách đã hoàn thành. Nút hành động dẫn thẳng tới nơi cần làm trong app; khi hoàn thành hiện nút "Nhận thưởng".

### Block 6b — Daily Quest Card
3 nhiệm vụ điểm danh hàng ngày, reset 0h. Progress circle SVG ở header. Mỗi nhiệm vụ 1 dòng: chưa làm → nút "Làm ngay" dẫn tới nơi cần làm; đã xong chưa nhận → nút text "Nhận +X XP" (⚠️ **theo yêu cầu mới nhất, không còn hiệu ứng pháo hoa khi bấm — chỉ đổi trạng thái badge**); đã nhận → badge mờ "✓ +X".

### Block 6c — Weekly Challenge Card
1 thử thách xoay vòng theo tuần (4 theme), progress bar + phần thưởng. Nhận thưởng khi hoàn thành (còn giữ hiệu ứng nhẹ vì tần suất thấp hơn — 1 lần/tuần).

### Block 6d — Mission Checklist
Gợi ý gói 3 bước tối ưu tài chính (chủ yếu: mở 3 tài khoản ngân hàng riêng biệt). Trigger card thu gọn có progress, bấm mở modal: từng bước có checkbox, khi xong tất cả hiện màn "Hoàn thành xuất sắc" + gợi ý hành động tiếp theo.

### Block 7 — Wellness Card
Card text động viên/chữa lành, đổi nội dung theo khung giờ trong ngày + "vibe" cá nhân hóa theo tuổi. Chỉ hiển thị, không tương tác.

### Bonus — Monthly Report Modal
Tự bật sau khi rollover sang tháng mới (nếu có báo cáo chưa xem). Tóm tắt tháng cũ: tier sức khỏe (Tốt/Trung bình/Cần cải thiện), summary từ "quản gia", metrics (giao dịch, bill đúng hạn, ngân sách giữ vững, dư ra, XP kiếm được). Đóng bằng nút "Đã xem 🎯".

---

# TRANG SỔ SÁCH (/ledger)

Trang xem lại toàn bộ lịch sử giao dịch + quản lý ngân sách theo danh mục + bill cố định.

### Header
Tiêu đề "📒 Sổ sách" + nút "📅 Lịch" (chỉ hiện ở tab Chi tiêu) mở `CalendarModal` để lọc theo ngày cụ thể.

### Summary Cards (2 cột)
Tổng thu nhập (xanh) và tổng chi tiêu (cam) — tính trên toàn bộ lịch sử, không lọc tháng.

### Tab switcher — 3 tab
"💸 Chi tiêu" · "🏷️ Danh mục" · "📋 Bill cố định"

### Tab "Chi tiêu"
- Badge lọc theo ngày (nếu có chọn từ lịch) + nút xóa lọc.
- 3 nút filter: Tất cả / Thu / Chi.
- Nút "⚙️ Ngưỡng" → mở `BudgetSettingsModal`.
- Danh sách giao dịch nhóm theo ngày, mỗi nhóm có tổng ngày. Mỗi giao dịch: icon danh mục, tên + ghi chú, số tiền + giờ. Giao dịch có `⚑` là đã được flag cảnh báo. Giao dịch split (chia quỹ) bấm để mở rộng xem breakdown 4 phần (chi tiêu/dự phòng/mục tiêu/đầu tư); giao dịch thường bấm mở `TransactionDetailSheet`.
- Empty state: icon 📝 + "Chưa có giao dịch".

### Tab "Danh mục"
- Banner 3 thống kê: DM theo dõi · GD cảnh báo · Tiết kiệm tiềm năng.
- Bộ mô phỏng "cắt giảm X%" — 4 nút 10/20/30/50%, đổi số tiền tiết kiệm ước tính hiển thị.
- Danh sách card mỗi danh mục (sắp xếp ưu tiên: đang hoạt động → có flag → vượt ngưỡng → theo số tiền): icon, tên, badge cảnh báo (theo dõi/vượt ngưỡng/số GD cảnh báo), % + progress bar màu theo mức độ. Bấm mở `CategoryDetailDrawer`.

### Tab "Bill cố định"
Danh sách quản lý bill cố định hàng tháng (component `FixedBillsPanel`).

### Modal: BudgetSettingsModal
Tổng quan 3 số (ngưỡng/đã chi/còn lại) → biểu đồ tròn phân bổ ngân sách → biểu đồ cột ngưỡng-vs-thực chi từng danh mục → danh sách chỉnh sửa ngưỡng từng danh mục (input số tiền, sửa icon/tên, xóa) → form thêm danh mục mới (icon + tên).

### Modal: CategoryDetailDrawer
Bottom-sheet kéo-để-đóng. Header: icon + tên + tổng chi/ngưỡng + nút Flag danh mục. Progress bar. Ô nhập ngưỡng riêng cho danh mục này + nút lưu. Banner cảnh báo bất thường (giao dịch ≥ 2.5× trung bình) kèm nút "gắn cờ cả lô". Danh sách giao dịch trong danh mục (có thể mở rộng xem hết hoặc chỉ top), mỗi giao dịch có nút flag riêng lẻ. Cuối cùng: dự báo tiết kiệm nếu cắt X% các khoản đã gắn cờ.

### Modal: TransactionDetailSheet
Bottom-sheet kéo-để-đóng. Icon lớn + tên danh mục + số tiền (màu theo thu/chi) + ghi chú + ngày/giờ. Với giao dịch chi tiêu: nút gắn cờ "Cảnh báo — AI CFO sẽ nhắc nhở".

---

## Ghi chú thị giác chung 2 trang này

- Màu trạng thái nhất quán: xanh lá = an toàn/tốt, cam/vàng = cảnh báo, đỏ = nguy hiểm/vượt ngưỡng, tím = mục tiêu/quỹ chung, xanh dương = thông tin/dự phòng, xanh ngọc = đầu tư.
- Card luôn có animation fade-in + trượt nhẹ lúc mount, so le delay giữa các block (cảm giác "xếp tầng" khi cuộn xuống).
- Mọi bottom-sheet/modal đều trượt lên từ dưới với spring physics, có thể kéo tay để đóng (drag-to-dismiss) trên các sheet chính (CategoryDetailDrawer, TransactionDetailSheet).
- Empty state luôn có: emoji lớn + câu mô tả ngắn + gợi ý hành động tiếp theo.
