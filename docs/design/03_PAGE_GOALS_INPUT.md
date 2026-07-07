# Trang Mục tiêu (/goals) & Nhập giao dịch (/input)

> Đọc `00_MASTER_BRIEF.md` trước. File này liệt kê chi tiết trang Mục tiêu (2 sub-tab) và màn hình Nhập giao dịch (nút giữa bottom-nav).

---

# TRANG MỤC TIÊU (/goals)

2 sub-tab: **🎯 Mục tiêu lớn** và **🧊 Wishlist** (có thể deep-link thẳng vào wishlist qua `/goals?tab=wishlist`).

## Sub-tab: MỤC TIÊU LỚN

### Tổng quan (hero)
Card gradient tím→cam: "Tổng đã tích lũy" (số lớn, chữ gradient) / tổng cần đạt của tất cả mục tiêu cộng lại.

### Memory bump (conditional)
Nếu đúng ngày này năm trước có nạp tiền vào 1 mục tiêu nào đó → hiện card nhắc kỷ niệm nhẹ nhàng ("Cùng ngày này năm trước, bạn nạp X vào 'Y'...").

### Danh sách mục tiêu (GoalCard, accordion)
Mỗi mục tiêu 1 thẻ:
- Header: icon, tên, badge ngân hàng nếu đã liên kết, deadline, "linh vật" đổi hình theo % tiến độ (🌱 → 🌟), badge %, chevron mở rộng.
- Progress bar màu riêng theo mục tiêu + số hiện tại/mục tiêu.
- 2 nút: "Nạp vào" (mở `GoalDepositModal`) và "Lịch sử (N)" (mở `GoalDetailModal`).
- Mở rộng: danh sách mốc tiến độ (milestone), tick từng mốc → ăn mừng (`MilestoneCelebration`), nút xóa mục tiêu (có confirm dialog).

### Nút "Thêm mục tiêu"
Mở `GoalFormModal`: tên, chọn icon (grid emoji), số tiền mục tiêu, deadline, chọn màu (grid màu) → tạo.

## Sub-tab: WISHLIST

### Card hướng dẫn "Quy tắc làm mát não"
Giải thích cơ chế: món đồ > 1 triệu thêm vào wishlist, chờ cooldown 48h, sau đó mới quyết định mua hay không (chống mua theo cảm xúc).

### 2 nút hành động
"+ Thêm vật phẩm" và "🏆 Bia chiến công" (bảng vinh danh các lần từ chối thành công, có badge đỏ nếu có item mới).

### Danh sách theo trạng thái
- **Đang làm mát**: đếm ngược thời gian còn lại (giờ:phút, cập nhật mỗi phút), có lý do ban đầu nếu ghi.
- **Sẵn sàng quyết định**: hết cooldown, badge "Đã hết hạn".
- Empty state nếu chưa có gì.

## Modal: GoalDepositModal (nạp tiền vào mục tiêu)
Chọn 1 trong 5 nguồn tiền: Tài khoản chính · Quỹ dự phòng · Quỹ mục tiêu chung · Ngân hàng (nếu đã liên kết, luôn bật dù số dư khai báo = 0) · Tiền mặt/Khác (luôn bật). Nhập số tiền (có nút nhanh +100k/500k/1tr/5tr) + ghi chú tùy chọn → nút "Nạp X" → ăn mừng nhẹ khi thành công.

## Modal: GoalDetailModal (chi tiết mục tiêu — modal phong phú nhất trang này)
- Hero: ảnh nền (nếu có), icon lớn, tên, deadline + số ngày còn lại, badge linh vật/streak/cảnh báo sắp hết hạn.
- Progress + số tiền cần thêm mỗi tháng để kịp deadline.
- 2 nút nhanh: Nạp tiền / Chia sẻ.
- 1 câu trích dẫn động viên (cố định theo mục tiêu, không đổi mỗi lần mở).
- "Lý do tôi muốn" — ghi chú cá nhân, sửa được, hiện lại khi user "yếu lòng".
- Upload ảnh minh họa mục tiêu (nén ảnh tự động).
- Khối liên kết ngân hàng: nếu đã liên kết hiện thông tin (che bớt số TK) + nút hủy liên kết; nếu chưa, gợi ý liên kết mạnh hơn khi mục tiêu > 100 triệu.
- **Bản đồ nhiệt (heatmap) 90 ngày** kiểu GitHub — mỗi ô 1 ngày, đậm nhạt theo số tiền nạp, tooltip khi hover/chạm.
- Lịch sử nạp tiền đầy đủ, mỗi dòng có icon nguồn màu riêng (xanh=chính, xanh dương=dự phòng, tím=quỹ chung, vàng=ngân hàng, cam=tiền mặt).

## Modal: BankLinkModal
Banner giải thích rõ "chỉ lưu như ghi chú, KHÔNG kết nối API ngân hàng thật". Form: tên NH (gợi ý nhanh 6 ngân hàng phổ biến) + số TK + tên chủ TK (tùy chọn) + số dư khai báo hiện có.

## Modal: GoalShareCard
Xuất ảnh chia sẻ story (1080×1920) — canvas vẽ trực tiếp trên trình duyệt: nền gradient theo màu mục tiêu, icon to, %, progress bar, trích dẫn, dòng thương hiệu. Nút tải ảnh về máy.

---

# TRANG NHẬP GIAO DỊCH (/input)

Màn hình nút giữa bottom-nav — nơi ghi thu/chi/chuyển tiền. Có thể deep-link sẵn loại giao dịch (`?type=income`).

### Tab loại giao dịch
3 nút: 💰 Thu nhập / 💸 Chi tiêu / 🔄 Chuyển — đổi toàn bộ form bên dưới theo loại chọn.

### Chọn ví
2 nút: Ví chính / Quỹ dự phòng.

### Ô nhập số tiền
Input số lớn, tự format nghìn (kiểu Việt Nam), auto-focus, gạch chân đổi màu theo loại giao dịch (xanh/cam/tím).

### Lưới danh mục (ẩn nếu là Chuyển)
Grid icon danh mục — danh mục thu nhập cố định, danh mục chi tiêu lấy từ danh sách user tự tùy biến.

### Ngày giao dịch
Date picker, mặc định hôm nay, giới hạn tối đa 30 ngày trước, không cho chọn tương lai (xử lý theo giờ local, không dùng UTC để tránh lệch ngày).

### Ghi chú (tùy chọn)

### Nút submit
Đổi label theo loại ("💰 Ghi thu nhập" / "💸 Ghi chi tiêu" / "🔄 Chuyển tiền"). Disable khi thiếu số tiền hoặc danh mục.
- **Nếu là chi tiêu ≥ 3 triệu**: bắt buộc qua `BreathGate` trước khi ghi.
- Còn lại: ghi ngay → cộng XP → hiện `CelebrationModal`.

### Bình luận "quản gia" (chỉ khi là Chi tiêu)
1 câu nhận xét ngẫu nhiên mang tính hài hước/nhắc nhở nhẹ, hiện fade-in dưới form.

## Modal: BreathGate (30 giây thở trước khi chi lớn)
Icon 🧘 + số tiền sắp chi to rõ + vòng tròn SVG animation thở (hít vào/giữ/thở ra, chu kỳ 10s × 3 lần = 30s) + đếm ngược giữa vòng tròn. Trước khi hết giờ chỉ có nút "Bỏ qua" (hủy, không cộng XP gì). Sau khi hết 30s: 2 nút — "Vẫn muốn chi tiêu" (ghi giao dịch bình thường) hoặc "Hủy — Tôi đã nghĩ lại" (không ghi giao dịch, được cộng XP "nhịn chi tiêu" như phần thưởng kỷ luật). Đây là cơ chế hành vi cốt lõi — **không được bỏ hoặc rút ngắn thời gian khi redesign** vì mục đích là chống chi tiêu bốc đồng.

## Modal: CelebrationModal
Tự đóng sau 4 giây. Emoji + tiêu đề + số tiền + badge XP kiếm được + 1 câu bình luận "quản gia" ngẫu nhiên. Nút "Tuyệt vời!" đóng modal — nếu vừa ghi **thu nhập**, tiếp tục mở `BillFundReminder`; nếu là chi/chuyển, điều hướng thẳng `/ledger`.

## Modal: BillFundReminder (chỉ sau khi ghi thu nhập)
Giao diện nền kiểu "dải ngân hà" (starfield + glow) đặc biệt hơn các modal khác trong app — nhắc chia thu nhập ra các quỹ ngay khi vừa nhận tiền. Chứa `SplitFundsPanel` cho user chọn cách chia. Xác nhận xong → `SplitSuccessPopup` tóm tắt kết quả chia (số tiền vào từng quỹ) → nút "Tuyệt vời!" → điều hướng `/ledger`.

---

## Ghi chú quan trọng khi redesign 2 trang này

- **BreathGate 30 giây là tính năng hành vi cốt lõi**, không phải chi tiết trang trí — thiết kế mới phải giữ nguyên độ "chặn" (không cho tắt sớm, không rút ngắn thời gian) dù có thể đổi hình thức trình bày.
- Goals có rất nhiều dữ liệu cá nhân hóa (ảnh, lý do, heatmap, chia sẻ social) — đây là điểm khác biệt cảm xúc mạnh của mục tiêu tài chính so với sổ sách thông thường, nên giữ được chiều sâu này khi redesign, đừng rút gọn Goals thành 1 progress bar đơn giản.
- Toàn bộ input tiền trong 2 trang này dùng chung 1 quy ước format số Việt Nam (dấu chấm ngăn nghìn) — giữ nhất quán nếu redesign input.
