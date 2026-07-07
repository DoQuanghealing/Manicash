# Trang bán hàng (Pricing / Sales Page) — Hiện trạng + Brief thiết kế mới

> Đọc `00_MASTER_BRIEF.md` trước. Phần 1 mô tả hiện trạng thật (để không phá vỡ logic khi redesign). Phần 2 là **brief cho 1 trang bán hàng đầy đủ hơn** mà sản phẩm đang cần — đây là phần yêu cầu thiết kế MỚI, không phải mô tả code có sẵn.

---

## PHẦN 1 — Hiện trạng bán hàng hôm nay

Hiện tại ManiCash **chưa có trang bán hàng (sales page) đúng nghĩa** — chỉ có 1 **modal bottom-sheet** (`PricingModal`) mở từ nhiều nơi trong app, và 1 trang `/upgrade` dùng lại y hệt nội dung đó dưới dạng full-page. Cả hai đều chỉ là **bảng so sánh 3 gói**, không có yếu tố thuyết phục/marketing (không hero, không social proof, không FAQ).

### Cấu trúc hiện tại (PricingCards, trong modal hoặc `/upgrade`)

3 thẻ xếp dọc:

**Thẻ 1 — Base (miễn phí)**
- Giá 0đ, không kỳ hạn.
- 4 dòng tính năng: quản lý thu chi/3 ví/chia tiền/ngân sách · mục tiêu & nhiệm vụ (giới hạn 3) · gamification · báo cáo CFO tóm tắt + 1 lượt AI/ngày.
- Nếu đang ở gói này: badge "Đang dùng" xanh lá, không có nút CTA.

**Thẻ 2 — Pro (trả phí, thẻ được nhấn mạnh nhất — viền cam)**
- Bộ chọn kỳ hạn dạng segmented control 3 nút: Tháng (49.000đ) · 6 tháng (280.000đ, ghi "Tiết kiệm") · Năm (539.000đ, ghi "Tặng ~2 tháng"). Nút đang chọn nền cam gradient.
- 5 dòng tính năng: AI Money Chat 20 lượt/ngày · báo cáo CFO AI viết riêng · tự động ghi giao dịch SMS · không giới hạn wishlist/mục tiêu/nhiệm vụ · ưu tiên tính năng mới.
- Nếu đang active: viền xanh lá + badge "Đã kích hoạt" + dòng "còn X ngày"; nếu chưa: nút CTA cam "✨ Nâng cấp Pro".

**Thẻ 3 — Trial (dùng thử, 30 ngày miễn phí)**
- Giá "0đ · 30 ngày", ghi rõ "mỗi người chỉ 1 lần".
- Các trạng thái nút: đang dùng thử (hiện số ngày còn lại) / đã dùng thử rồi (khóa nút, xám) / đang là Pro rồi (không cần trial) / chưa dùng (nút CTA gradient tím-cam "🎁 Dùng thử miễn phí").

### Cơ chế mở modal
`usePricingModalStore` — mở từ: bấm vào tính năng Pro khi đang Free (component `ProGate` chặn mềm, hiện thẻ nhỏ giải thích + nút "Nâng cấp"), nút "Nâng cấp" trong app, hoặc callback sau khi thanh toán xong.

**Kết luận hiện trạng:** đây là 1 bảng giá kỹ thuật, không phải trang bán hàng có khả năng thuyết phục người chưa quyết định mua. Không có: câu chuyện giá trị (tại sao cần Pro), bằng chứng xã hội, xử lý phản đối (objection handling), FAQ, cảm giác khẩn cấp/khan hiếm hợp lý.

---

## PHẦN 2 — Brief thiết kế trang bán hàng mới

### Mục tiêu
Thiết kế **1 trang bán hàng độc lập** (không phải modal) tại route hiện có `/upgrade`, thay thế bảng giá đơn thuần hiện tại bằng 1 trải nghiệm bán hàng đầy đủ — vẫn giữ bảng 3 gói làm phần lõi (không đổi logic giá/SKU/trạng thái đã mô tả ở Phần 1), nhưng bọc thêm các lớp thuyết phục xung quanh.

### Chân dung người dùng mục tiêu (để thiết kế đúng tâm lý)
Người Việt thu nhập trung bình-thấp tới trung bình, có xu hướng "kiếm nhiều tiêu nhiều", né tránh nhìn thẳng vào tài chính của mình, chỉ hoảng khi tài khoản gần cạn. Họ không mua vì bảng tính năng khô khan — họ mua vì cảm thấy **được thấu hiểu** và tin app sẽ **dẫn dắt** chứ không phán xét. Tông giọng bán hàng nên giữ nhân vật "Lord Diamond/quản gia" đã có sẵn trong sản phẩm — ấm áp, không hù dọa, không dùng ngôn ngữ tài chính hàn lâm.

### Cấu trúc đề xuất (top → bottom, vẫn trong khung 430px, cuộn dọc)

1. **Hero mở đầu** — không phải "Bảng giá" khô khan mà là 1 câu định vị cảm xúc trước (ví dụ tinh thần: "Từ hoảng loạn cuối tháng đến làm chủ dòng tiền" — viết lại theo giọng thương hiệu thật), kèm hình ảnh/icon liên quan tới rank-up hoặc biểu đồ tiến bộ đã có trong app (tái dùng ngôn ngữ hình ảnh gamification hiện có, không cần asset mới hoàn toàn).
2. **3 lý do nên nâng cấp** (không phải liệt kê tính năng, mà là lợi ích/kết quả) — ví dụ format "Vấn đề bạn đang gặp → Pro giải quyết thế nào", mỗi lý do 1 icon + 1-2 câu, ngắn.
3. **Bảng 3 gói (lõi hiện có)** — giữ nguyên toàn bộ logic ở Phần 1, chỉ nâng cấp trình bày: có thể làm nổi bật hơn gói Pro (ví dụ 1 ribbon "Phổ biến nhất" đã có, có thể thêm animation nhẹ khi vào viewport), giữ đúng 3 trạng thái nút theo tier user thật.
4. **So sánh nhanh Free vs Pro dạng bảng gọn** (khác với bảng liệt kê hiện tại — dạng 2 cột đối chiếu trực quan hơn, dùng dấu ✓/✗) — tùy chọn, có thể gộp vào bước 3 nếu không muốn trùng lặp.
5. **Câu hỏi thường gặp (FAQ)** — tối thiểu: "Hủy được không?", "Dùng thử có mất tiền không?", "Thanh toán qua đâu, có an toàn không?" (PayOS), "Nếu tôi không dùng hết lượt AI thì sao?". Dạng accordion thu gọn, tiết kiệm không gian màn hình dọc.
6. **Trấn an cuối trang trước CTA cuối** — 1 dòng ngắn kiểu cam kết/an tâm (không cần dàn dựng "bằng chứng xã hội" giả nếu chưa có testimonial thật — có thể để trống mục này cho tới khi có dữ liệu người dùng thật, đừng bịa số liệu).
7. **CTA cuối cùng lặp lại** — nút nâng cấp/dùng thử, đặt lại 1 lần nữa ở cuối trang cho người đã cuộn hết mà chưa quyết định.

### Ràng buộc khi thiết kế phần mới này
- **Không đổi logic nghiệp vụ** của 3 gói/trạng thái nút/giá — phần mới chỉ là lớp thuyết phục bao quanh, phần lõi bảng giá giữ nguyên hành vi.
- **Không bịa số liệu/testimonial giả** — nếu muốn có phần "bằng chứng xã hội", để placeholder rõ ràng ghi chú "cần dữ liệu thật từ PO" thay vì tự nghĩ ra số.
- Vẫn trong khung 430px mobile-first, cuộn dọc dài hơn trang hiện tại là chấp nhận được (đây là trang bán hàng, user chấp nhận cuộn để đọc kỹ hơn modal).
- Giữ tông tối/glass hiện có — trang bán hàng không cần tách biệt phong cách khỏi phần còn lại của app, vẫn phải cảm thấy "trong cùng 1 app".
- Route đích: vẫn dùng `/upgrade` sẵn có (deep-linkable) — không cần route mới. Modal `PricingModal` (bottom-sheet nhanh mở từ trong app) có thể giữ nguyên dạng rút gọn hiện tại cho các luồng "tiện mở nhanh" — trang `/upgrade` mới là nơi trình bày đầy đủ.

### Đầu ra mong muốn từ Claude Design
Một bộ mockup/hướng dẫn thiết kế cho trang `/upgrade` theo cấu trúc trên, kèm chỉ định rõ: màu sắc/spacing dùng token nào trong `00_MASTER_BRIEF.md`, animation khi cuộn (nếu có) mô tả bằng ngôn ngữ Framer Motion (spring/fade/stagger) để lập trình lại khả thi, và giữ nguyên toàn bộ copy/logic 3 thẻ giá đã liệt kê ở Phần 1 (chỉ được viết lại câu chữ phần hero/FAQ/lý do nâng cấp — phần bảng giá kỹ thuật thì giữ nguyên số liệu, chỉ có thể tinh chỉnh cách trình bày).
