# Product

## Register

product

## Users
Người Việt trẻ (18–35), dùng điện thoại là chính (baseline 375px), muốn quản lý chi tiêu cá nhân mà không thấy "phức tạp như app kế toán". Bối cảnh dùng: tranh thủ vài giây ghi một khoản chi ngay sau khi tiêu, hoặc xem nhanh tình hình tài chính buổi tối. Việc cần làm: ghi giao dịch cực nhanh, hiểu tiền đang ở đâu, và được nhắc nhở/động viên để giữ thói quen.

## Product Purpose
ManiCash là app tài chính cá nhân gamified cho người Việt. AI Money Chat là "cửa vào chính": nhập giao dịch bằng ngôn ngữ tự nhiên ("mua trà sữa 50k"), hệ thống tự tách số tiền/loại/danh mục và cho xác nhận. Thành công = user ghi sổ đều mỗi ngày vì thao tác nhẹ và vui, rồi nâng cấp Pro để có AI sâu hơn + báo cáo CFO.

## Brand Personality
Quản gia tài chính "Lord Diamond": ấm áp, thông minh, hơi cao sang nhưng gần gũi; nhắc nhở chứ không phán xét. Ba từ: **thân thiện · thông minh · gọn gàng**. Cảm xúc mục tiêu: nhẹ nhõm (không bị choáng số liệu), được đồng hành, và một chút sang.

## Anti-references
- App kế toán doanh nghiệp dày đặc bảng/biểu (MISA, dashboard "dev" nhiều card xếp lớp).
- Form dài nhồi nhiều input cùng lúc trên một màn mobile.
- Card lồng card, popup chồng popup không có đường lui rõ ràng.
- Giao diện "loè loẹt" nhiều gradient text / glow vô nghĩa.

## Design Principles
1. **Một việc một lúc (one task per surface).** Khi cần nhập liệu chi tiết, đưa ra panel riêng có đường lui rõ ràng — không nhồi vào luồng chat.
2. **Chat là trục chính.** Mọi hành động khởi nguồn từ hội thoại; panel chỉ là bước xác nhận tạm thời rồi quay lại chat.
3. **Nhẹ trước, sâu sau.** Mặc định hiển thị tối giản; chi tiết/nâng cao mở theo yêu cầu.
4. **Luôn có đường lui.** Mọi panel phát sinh đều có nút back về màn chính; không bao giờ để user mắc kẹt.
5. **Tôn trọng hệ thiết kế sẵn có.** Glassmorphism tối, tokens CSS hiện hữu; không thêm thư viện UI nặng làm vỡ phong cách.

## Accessibility & Inclusion
- Mobile-first 375px; vùng chạm ≥44px.
- Tương phản chữ thân ≥4.5:1 trên nền tối.
- Tôn trọng `prefers-reduced-motion` cho mọi chuyển cảnh panel.
- Tiếng Việt có dấu đầy đủ ở mọi chuỗi hiển thị.
