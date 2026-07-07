# Trang Chat (/chat) & Money (/money)

> Đọc `00_MASTER_BRIEF.md` trước. File này liệt kê chi tiết Chat với "Lord Diamond" và Money (2 sub-tab: nhiệm vụ kiếm tiền + báo cáo CFO AI).

---

# TRANG CHAT (/chat)

Màn hình trung tâm của app — chat với trợ lý AI "Lord Diamond". Không chỉ để hỏi đáp mà còn là nơi nhập giao dịch bằng ngôn ngữ tự nhiên, xác nhận hành động AI đề xuất, và xem lịch sử thao tác.

### Header — Lord Diamond
Avatar tròn "LD" + tên "Lord Diamond" + dòng phụ "Quản gia tài chính" + số quy tắc AI đã nhớ về thói quen user + chấm trạng thái online xanh.

### Banner tắt chat (conditional)
Nếu feature flag tắt: icon khóa + thông báo tắt.

### Banner Người Gác — Guardian Alert (conditional)
Cảnh báo chủ động do AI phát hiện (vd sắp vượt ngân sách, bill sắp đến hạn). Header có nút đóng (×). Mỗi cảnh báo có icon + tiêu đề + nội dung, màu theo mức độ nghiêm trọng; bấm vào 1 cảnh báo sẽ tự động gửi câu hỏi liên quan vào chat.

### Khung chat (thread, cuộn được)
- **Bong bóng tin nhắn** 3 loại: User (phải, không avatar) · Assistant (trái, avatar LD) · System (trái, icon check xanh — dùng cho xác nhận/thông báo hệ thống).
- **Nội dung bong bóng có nhiều dạng đặc biệt** ngoài text/markdown thường:
  - **Receipt card**: thẻ xác nhận đã ghi nhận thu/chi, kèm tổng kết trong ngày.
  - **Capacity card**: thẻ radar 4 chỉ số năng lực (FDS/TAS/IPS/MMS) kèm gợi ý.
  - **Survey card**: form khảo sát năng lực (chọn kỹ năng, thời gian rảnh) ngay trong bong bóng chat.
- **Chip gợi ý câu hỏi tiếp theo**: xuất hiện dưới tin nhắn cuối của AI, bấm để tự động hỏi tiếp.
- **Chỉ báo đang gõ**: avatar LD + 3 chấm động khi AI đang xử lý.
- **Thẻ xác nhận hành động (action card)**: khi AI đề xuất 1 thao tác (vd chuyển quỹ), hiện thẻ có mô tả preview + mức độ rủi ro (màu theo cao/trung/thấp) + 2 nút Xác nhận/Hủy. **Nguyên tắc an toàn cốt lõi: AI không bao giờ tự thực hiện — luôn cần bấm Xác nhận.**
- **Panel lịch sử thao tác** (bật/tắt bằng chip riêng): danh sách tối đa 20 thao tác gần nhất kèm trạng thái (đã yêu cầu/xác nhận/thực hiện/lỗi/đã hoàn tác), có nút "Hoàn tác" cho thao tác có thể undo.

### Thanh hành động nhanh (cuộn ngang, dưới khung chat)
Chuỗi chip theo thứ tự: **Nhập thủ công** (dẫn `/input`) → **Báo cáo trưa** / **Tổng kết tối** (điểm danh nhanh) → **Đối chiếu số dư** → **Lịch sử thao tác** (toggle panel) → **chip thói quen** (auto-gợi ý ghi nhanh dựa giao dịch lặp lại, có icon+tên+số tiền) → **chip ví dụ** tĩnh (câu mẫu để thử).

### Dropdown lệnh `/`
Gõ `/` hiện danh sách lệnh nhanh dạng autocomplete (vd `/donananluc` đo năng lực, `/khaosat` khảo sát).

### Ô nhập liệu (composer)
Input text + nút gửi (icon Send), placeholder gợi ý gõ `/` để xem lệnh.

### Panel trượt từ phải (overlay khi cần chỉnh sửa sâu hơn)
Khi cần xác nhận/chỉnh chi tiết hơn 1 action card đơn giản, 1 panel trượt vào từ bên phải (nội dung chat bị đẩy sang trái 16%), có nút back. 3 loại panel:
- **Xác nhận giao dịch**: số tiền lớn (màu theo thu/chi) + form đầy đủ (loại, số tiền, danh mục, ví, ngày, ghi chú) + gợi ý danh mục thay thế + gợi ý match với bill cố định nếu liên quan + nút "Xác nhận lưu".
- **Đối chiếu số dư**: 3 ô nhập số dư thực tế từng ví (thu nhập/chi tiêu/tiết kiệm) so với số ManiCash đang ghi nhận, nút "Kiểm tra lệch".
- **Tạo kế hoạch kiếm tiền**: form tên nhiệm vụ, mục tiêu tiền, số ngày, danh sách bước nhỏ (thêm/xóa được), nút "Tạo nhiệm vụ".

---

# TRANG MONEY (/money)

2 sub-tab chuyển đổi bằng thanh tab có chỉ báo trượt: **💰 Money** (nhiệm vụ kiếm tiền) và **📊 Báo cáo CFO**.

## Sub-tab: MONEY

### HallOfFame Card
Card gamification lớn nhất app.
- Badge rank hero (icon lớn, gradient theo rank, animation pulse nhẹ) + tên rank + tổng XP hiện tại.
- Progress bar tiến tới rank kế tiếp (nếu chưa max) + % + số XP hiện tại/cần đạt.
- Cảnh báo phạt XP (nếu đang bị giảm do trễ hạn nhiệm vụ).
- Dự báo mục tiêu: ước tính bao lâu đạt được mục tiêu lớn dựa thu nhập hiện tại.
- Roadmap thu nhỏ: dải icon tất cả 7 rank, làm mờ rank đã qua, sáng rank hiện tại.

### Task Stats Card
3 số: Hoàn thành / Đang chạy / Trễ hạn (màu xanh/xanh/đỏ).

### Danh sách nhiệm vụ kiếm tiền (accordion)
Mỗi nhiệm vụ 1 thẻ có thể mở rộng: emoji trạng thái, tên, badge XP ước tính, badge trạng thái, progress bar sub-task (nếu có checklist con). Mở rộng thấy checklist con (tick từng bước) + nút chỉnh sửa. Nút hành động: "✅ Hoàn thành" (nếu đang chạy) hoặc "⚠️ Xử lý trễ hạn" (nếu quá hạn, mở dialog chọn lý do).

### Nút "Thêm nhiệm vụ kiếm tiền"
Mở `TaskFormModal`: tên, tiền kỳ vọng, ngày bắt đầu/kết thúc, checklist bước nhỏ (thêm/xóa), ước tính XP hiện trực tiếp khi nhập.

### Lịch sử hoàn thành
Top 3 nhiệm vụ đã xong gần nhất, dạng thẻ tương tự nhưng khóa tương tác.

### Công cụ SMS (chỉ Pro, conditional theo feature flag)
1 card gradient badge "PRO" dẫn tới cài đặt tự động ghi giao dịch qua SMS ngân hàng.

## Sub-tab: BÁO CÁO CFO

### CFO Insight Card
Thẻ phân tích AI. Header "🧠 AI CFO" + badge nguồn (AI thật / phân tích nhanh). Có trạng thái loading (skeleton), lỗi (kèm nút thử lại), và nội dung chính: 1 câu tóm tắt tình hình + nút mở rộng xem gợi ý hành động (danh sách đánh số) + thời gian cập nhật + nút "Phân tích lại".

### Biểu đồ cột chồng (Thu/Chi theo tuần)
So sánh trực quan thu nhập vs chi tiêu từng tuần, 2 màu (xanh/cam), có animation dựng cột so le.

### Biểu đồ đường (Tăng trưởng tiết kiệm)
Đường cong + vùng tô gradient tím→xanh ngọc, hiện tổng tiết kiệm hiện tại ở header.

### Gauge sức khỏe tài chính
Vòng tròn SVG dạng đồng hồ đo (0-100), màu đổi theo điểm (đỏ <40, vàng 40-70, xanh ≥70), số điểm to ở giữa + nhãn Tốt/Trung bình/Yếu + mô tả ngắn.

### 2 CTA cuối trang
"Xem báo cáo đầy đủ tháng này" → `/report`. "Nhập giao dịch bằng AI Money Chat" → `/chat` (chỉ hiện nếu chat được bật).

### Modal: TaskFormModal / TaskOverdueDialog
Đã mô tả ở trên (form thêm/sửa nhiệm vụ; dialog chọn lý do trễ hạn với 3 lựa chọn: không còn liên quan / hoãn lại / đổi kế hoạch, kèm cảnh báo phạt 30% XP cho 3 nhiệm vụ tiếp theo).

---

## Ghi chú quan trọng khi redesign 2 trang này

- **Chat là trang phức tạp nhất app về mặt trạng thái** — có rất nhiều loại nội dung bong bóng khác nhau (text/markdown/receipt/capacity/survey) và 1 hệ thống panel trượt phụ. Redesign cần giữ được khả năng mở rộng thêm loại bong bóng mới trong tương lai, không nên "đóng cứng" layout.
- **Nguyên tắc an toàn AI không bao giờ tự hành động** phải thể hiện rõ trong UI (luôn cần bước xác nhận tường minh) — đây là yêu cầu sản phẩm cứng, không phải chi tiết thẩm mỹ.
- Money tab dùng animation chuyển tab kiểu "slide theo hướng" (trái/phải tùy thứ tự tab) — nên giữ cảm giác chuyển động có hướng này khi đổi thiết kế.
