# 🔮 P6b/c — Bản Hỏi Đáp Khám Phá (Discovery Brief)

> Mục đích: gom đủ thông tin để build **P6b (Oracle AI nhận xét năng lực)** + **P6c (Recommendation → Coach + CV PDF)**.
> Cách dùng: anh trả lời thẳng dưới mỗi câu (hoặc tạo file mới trả lời theo số mục). Câu nào đồng ý gợi ý của em thì ghi **"OK"** là đủ.
>
> Ký hiệu: 🟢 = chỉ cần anh **chọn/xác nhận** · 🔴 = cần anh **cung cấp dữ liệu thật** (em không tự bịa được) · 💡 = gợi ý mặc định của em.

---

## PHẦN A — P6b: Oracle (AI nhận xét năng lực "có hồn")

> Đây là phần biến 4 chỉ số khô khan thành 1 bức "thư khai vấn" cá nhân hóa. Đa số là anh xác nhận default.

### A1. 🟢 Model & chi phí
- Dùng model nào cho Oracle? 💡 **GPT-4o-mini** (sâu, ~12đ/lượt, key anh đã có). [GPT-4o / Groq-70B nếu muốn]
- Mỗi lần đo Oracle trừ bao nhiêu **credit**? 💡 **8 credit** (bằng báo cáo CFO).
- Có **cache** theo dữ liệu (4 chỉ số không đổi → trả lại bản cũ, KHÔNG tính phí)? 💡 **Có** (hash scores + tháng).

### A2. 🟢 Ai được dùng Oracle?
- 💡 **Pro** dùng thoải mái (trong quota) · **Free** xem được điểm số + radar (P5) nhưng "nhận xét có hồn" bị **mờ/khóa**, mở bằng nâng Pro hoặc 1 credit pack.
- Anh muốn Free được thử **1 lần/đời** cho "wow" rồi mới khóa không? 💡 Có (tăng chuyển đổi).

### A3. 🟢 Giọng & cấu trúc (theo spec Manus — xác nhận)
- Persona: **"ManiCash AI Oracle"** — sắc sảo như doanh nhân, thấu cảm như người thầy, thực chiến như kỹ sư. 💡 Giữ.
- Cấu trúc 4 phần: **① Gương Thần** (phản chiếu thực tại) → **② Điểm Chạm Thịnh Vượng** (vũ khí bí mật) → **③ Lộ Trình 30 Ngày** (3 bước: app → học kỹ năng → tự động hóa) → **④ Lời Mời** (dẫn về Coach). 💡 Giữ.
- Độ dài: 💡 **400–600 từ**.
- Hiệu ứng: 💡 **streaming** (gõ từng chữ) cho cảm giác "đang viết riêng cho anh".
- Có nhắc **tên người dùng + số liệu cụ thể** (danh mục chi nhiều nhất, mục tiêu đang theo)? 💡 Có.
- ⚠️ Phần **④ Lời Mời** có nên gắn CTA tới gói Coach của anh ngay không, hay để trung lập đến khi anh chốt sản phẩm Coach (mục C)? → anh chọn.

### A4. 🟢 Dữ liệu gửi lên AI (privacy)
- 💡 CHỈ gửi: 4 điểm số + nhóm nghề + danh mục chi nhiều nhất + tên mục tiêu + kỹ năng khai báo + 1-2 từ khóa tâm trạng. **KHÔNG gửi giao dịch thô.** → anh duyệt giới hạn này?
- Lưu kết quả Oracle ở đâu? 💡 `localStorage` (offline-first) + tùy chọn đồng bộ `users/{uid}/capacity_report` (Firestore) để xuất CV/▶ làm dữ liệu R&D.

### A5. 🟢 Chỉ số "Tư duy Tăng trưởng" (Growth Orientation - thuộc MMS)
- P5 đang để tạm 50. Spec nói "AI đánh giá qua hội thoại". 💡 Em sẽ cho Oracle **chấm 0–100 phần này** dựa trên lịch sử chat tư vấn + survey. → anh OK cách này, hay bỏ qua (giữ 50)?

---

## PHẦN B — P6c: CV Năng Lực (PDF + Profile online)

### B1. 🟢 Nội dung CV (theo template Manus — xác nhận)
- 💡 Trang 1: Header (tên + ID + slogan) + **Radar 4 chỉ số**. Trang 2: **Nhận xét Oracle** + phân loại nghề + 3 gợi ý công việc. Trang 3: **Lộ trình 30 ngày** + dự báo thu nhập. Trang 4: **QR + liên hệ Coach**. → giữ hay sửa?
- CV cho **Free hay Pro**? 💡 Pro (hoặc tốn credit) — đây là "tài sản khoe được".

### B2. 🔴 Profile online + QR (CẦN anh quyết)
- Có làm **trang profile online** (xem CV trên web, người khác mở được) không? 💡 Có — tạo "viral loop".
- URL profile: 💡 **slug ngẫu nhiên** `manicash.org/u/ab12cd` — **KHÔNG lộ uid Firebase** (privacy). → anh duyệt?
- **QR trên CV dẫn về đâu?** 🔴 → (a) profile online của user, (b) landing page Coach của anh, (c) cộng đồng (Zalo/FB group)? Cho em link đích.

### B3. 🟢 Render kỹ thuật
- 💡 Render **server-side** (Vercel + @react-pdf/renderer) để PDF đẹp + đồng nhất font tiếng Việt. → OK? (client-side dễ lỗi font).

### B4. 🟢 Huy hiệu & so sánh cộng đồng
- "Top 5% Tech", "cao hơn 85% người dùng"… cần **nhiều user thật** mới có mốc so sánh. 💡 **Để pha 2** (sau khi có data); pha 1 chỉ hiện badge theo điểm tuyệt đối (vd FDS>70 = "Kỷ luật thép"). → OK?

---

## PHẦN C — P6c: Khóa học & Coach (PHẦN QUAN TRỌNG NHẤT — cần dữ liệu thật của anh)

> Đây là phần em **không tự bịa được**. Anh càng chi tiết, recommendation càng "chốt sale" giỏi.

### C1. 🔴 Danh mục khóa học
Liệt kê các khóa anh có/muốn bán. Mỗi khóa cho em:
| Tên khóa | Giá | Thuộc nhóm năng lực nào* | Bán trong app hay dẫn link ngoài | Link/landing |
|---|---|---|---|---|
| (vd) Claude Masterclass | 499k | Sáng tạo / Vận hành | Link ngoài | https://... |
| … | | | | |

*4 nhóm: **Sáng tạo Nội dung** · **Chuyên gia Số** · **Nhà Khai vấn** · **Kỹ sư Vận hành**.

- Khóa học là **của anh** / affiliate / marketplace?
- Thanh toán khóa **qua PayOS trong app** hay **dẫn ra web ngoài**? 💡 Pha 1 dẫn link ngoài (nhanh), PayOS sau.

### C2. 🔴 Gói Coach (sản phẩm cao cấp — "đích đến" của phễu)
- Tên gói + giá: …
- Hình thức: 1-1 / group / "Coach AI Automation"? …
- Cam kết/kết quả gói mang lại: …
- Ưu tiên nhóm năng lực nào? 💡 Spec gợi ý **Coach×Tech (Nhà Khai vấn Công nghệ)** = lead xịn nhất.
- Có trang landing Coach chưa? Link: …

### C3. 🔴 Lead đổ về đâu? (khi user bấm "Nhận tư vấn từ Coach")
- 💡 Form trong app → lưu `Firestore` + **báo cho anh** (email/Zalo). → hay anh muốn về Google Sheet / CRM / Zalo OA cụ thể? Cho em đích.
- Cần đặt lịch hẹn (booking) không? 💡 Pha 1: chỉ thu lead + thông tin liên hệ; booking để sau.

### C4. 🟢 Phễu 3 cấp (theo Manus — xác nhận)
- 💡 **Cấp 1 (Free):** gợi ý 3 nghề + tặng checklist PDF. **Cấp 2 (Credit/khóa lẻ):** Oracle tư vấn sâu + gợi khóa học. **Cấp 3 (Coach):** "Gửi báo cáo cho Coach" → thu lead. → giữ 3 cấp này?

---

## PHẦN D — Hạ tầng, dữ liệu R&D & pháp lý

### D1. 🟢 Dữ liệu cho hồ sơ R&D / gọi vốn
- Lưu `capacity_report` + log "user quan tâm ngách nào" (click khóa nào) lên Firestore (ẩn danh hóa) để làm số liệu R&D? 💡 Có.
- Cần thêm mục trong **trang admin** xem "ngách hot" (R&D) không? 💡 Có — nhẹ thôi.

### D2. 🟢 Pháp lý / Privacy (NĐ 13/2023)
- Survey (kỹ năng, thời gian rảnh) + CV public cần **dòng đồng ý** trước khi lưu/chia sẻ. 💡 Em thêm checkbox consent. → OK?
- Dự báo thu nhập cần **disclaimer** "tham khảo, không phải cam kết/tư vấn đầu tư". 💡 Em thêm. → OK?

---

## PHẦN E — Thứ tự triển khai

- 🟢 Em đề xuất build **P6b (Oracle) TRƯỚC** — vì độc lập, không cần catalog khóa học, ra "wow" ngay. **P6c (Coach/CV) SAU** — cần dữ liệu mục C của anh.
- → Anh đồng ý thứ tự này, hay muốn CV/Coach trước?

---

## 📌 Tóm tắt: 3 thứ em CẦN NHẤT từ anh để khởi động

1. **Mục C1 + C2** — danh sách khóa học + gói Coach (giá, nhóm, link). *(gate toàn bộ P6c)*
2. **Mục C3 + B2** — lead đổ về đâu + QR dẫn về đâu. *(các link đích)*
3. **Mục A3-④** — phần "Lời Mời" của Oracle có gắn CTA Coach ngay không.

Những mục 🟢 còn lại, anh chỉ cần ghi **"OK"** hàng loạt là em chạy được.
