# 🧠 ManiCash AI Chat — Tài Liệu Diễn Giải Toàn Diện

> **Mục đích tài liệu:** giải thích cho người tư vấn (không cần biết code) hiểu **AI chat của ManiCash vận hành thế nào, có tác dụng gì cho người dùng, backend ra sao** — để đưa ra tư vấn tối ưu cho giai đoạn tiếp theo (P6b/c).
>
> Cập nhật: 2026-06. Trạng thái: nhóm tính năng **offline P1–P6a đã xong & lên production**; phần đám mây P6b/c đang chờ chốt sản phẩm.

---

## 1. Tóm tắt 1 phút

ManiCash là **app quản lý tài chính cá nhân dạng chat** cho người Việt. Thay vì bấm form, người dùng **nhắn tin** với một "quản gia tài chính" tên **Lord Diamond** (vd: *"mua cà phê 30k"*, *"còn bao nhiêu tiền?"*, *"tháng này xài được bao nhiêu?"*).

Điểm khác biệt cốt lõi: bộ não chat — tên mã **PRISM (Lõi Kim Cương)** — **chạy hoàn toàn offline ngay trên máy người dùng**. Hỏi về tiền của mình → trả lời **tức thì, miễn phí, không cần internet**. Chỉ những tác vụ "khó" thật sự (tư vấn sâu, nhận xét có chiều sâu) mới gọi lên AI đám mây (tốn phí).

Định vị: *"Giữa bạn và sự giàu có chỉ cách nhau một app"* — app luôn bên cạnh, kể cả khi mất mạng.

---

## 2. ManiCash là gì & AI chat đứng ở đâu

ManiCash có **5 màn hình chính**: Tổng quan · Sổ sách · **Chat (trung tâm)** · Mục tiêu · Money.
**Chat là trái tim** — nơi người dùng nhập liệu, tra cứu, nhận cảnh báo, và (sắp tới) đo năng lực + hướng nghiệp. Mọi hành động đều có thể bắt đầu từ khung chat.

Sản phẩm thực ra là **2 trong 1**:
1. **Quản lý tiền** (đang vận hành): ghi thu/chi, ngân sách, mục tiêu, sức khỏe tài chính.
2. **Kiến tạo thịnh vượng** (đang xây): đo "năng lực" người dùng → gợi ý nghề/khóa học → dẫn tới dịch vụ Coach.

---

## 3. Hai khái niệm: "Gương mặt" và "Bộ não"

| | Tên | Vai trò |
|---|---|---|
| 🎭 **Gương mặt** | **Lord Diamond** | Nhân vật quản gia — giọng nói, tính cách, cách xưng "ngài". Cái người dùng *thấy*. |
| 💎 **Bộ não** | **PRISM** (Lõi Kim Cương) | Engine xử lý chạy offline. Cái người dùng *không thấy* nhưng quyết định độ thông minh. |

**Vì sao là "kim cương / lăng kính"?** Kim cương chính là một lăng kính: nhận **1 tia dữ liệu thô** (các giao dịch bạn nhập) rồi **tán xạ thành cả phổ trí tuệ** — chi tiêu, dòng tiền, sức khỏe tài chính, năng lực, cơ hội. Kim cương cũng **cứng nhất** (bền, không sập), **không cần nguồn điện** (chạy offline), **nhiều mặt** (nhiều năng lực), và **quý nhất** (tài sản của bạn).

---

## 4. Triết lý cốt lõi: OFFLINE-FIRST (quan trọng nhất)

> **Mọi câu hỏi đi qua PRISM (trên máy) TRƯỚC. Trả lời được thì trả ngay — offline, 0đ, không tốn lượt AI. Chỉ câu KHÓ thật mới gọi đám mây.**

Bộ não chia **3 tầng**:

```
        Người dùng nhắn 1 câu
                 │
                 ▼
   ┌─────────────────────────────────┐
   │  TẦNG 1 — PRISM (offline, 0đ)    │  ← 90% câu hỏi dừng ở đây
   │  • Hiểu ý định (phân loại)       │
   │  • Trả lời số liệu tức thì       │
   │    (số dư, bill, an toàn chi...) │
   │  • Cảnh báo chủ động, ghi nhanh  │
   └─────────────────────────────────┘
                 │ (chỉ khi cần)
                 ▼
   ┌─────────────────────────────────┐
   │  TẦNG 2 — Trí nhớ (offline)      │
   │  • Học thói quen, giao dịch lặp  │
   │  • Hồ sơ dài hạn của người dùng  │
   └─────────────────────────────────┘
                 │ (chỉ khi "khó")
                 ▼
   ┌─────────────────────────────────┐
   │  TẦNG 3 — AI đám mây (tốn phí)   │  ← chỉ ~10% câu
   │  • Tư vấn sâu, báo cáo CFO       │
   │  • Nhận xét năng lực "có hồn"    │
   │  • Mất mạng → tự rút gọn, không  │
   │    gãy trải nghiệm               │
   └─────────────────────────────────┘
```

**Vì sao kiến trúc này là lợi thế:**
- 💰 **Rẻ:** 90% tương tác không gọi API → biên lợi nhuận cao (~70–90%).
- ⚡ **Nhanh:** không round-trip mạng → trả lời tức thì.
- 🔒 **Riêng tư:** dữ liệu tiền bạc **không rời máy** cho các câu hỏi thông thường.
- 📴 **Tin cậy:** dùng được cả khi mất mạng/máy bay.
- 🧮 **Chính xác tuyệt đối:** số liệu offline **khớp y hệt** màn hình app (cùng một "lõi tính toán" — xem mục 6.3).

---

## 5. Người dùng được gì (các tính năng đã chạy)

| Phase | Tên | Người dùng làm gì | Ví dụ | Giá trị |
|---|---|---|---|---|
| **P1** | Trả lời offline | Hỏi bất cứ gì về tiền của mình | *"còn bao nhiêu tiền?"* → trả lời ngay | Tức thì, 0đ, không cần mạng |
| **P2** | Thẻ gợi ý + lệnh `/` | Bấm chip gợi ý / gõ `/` ra menu nhanh | `/sodu` `/antoan` `/bill` `/muctieu` | Như Telegram bot — mượt, dẫn dắt |
| **P3** | Trí nhớ giao dịch | App học thói quen → nút "ghi nhanh" | *☕ Cà phê · 30.000đ* (bấm 1 phát) | Nhập liệu nhanh gấp nhiều lần |
| **P4** | Người Gác | Cảnh báo chủ động khi mở app | *"🚨 Vượt ngân sách Ăn uống"*, *"📋 Tiền nhà tới hạn 2 ngày"* | App "để ý giúp" — cảm giác được chăm sóc |
| **P5** | La Bàn Năng Lực | Gõ `/nangluc` → radar 4 chỉ số + nhóm nghề | *"Nhà Khai vấn Công nghệ"* + biểu đồ radar | Khám phá bản thân → mở hướng kiếm tiền |
| **P6a** | Khảo sát năng lực | Gõ `/khaosat` → khai kỹ năng, thời gian rảnh | Chọn "Lập trình, Viết lách… 10–20h/tuần" | Đo năng lực chính xác hơn |

**4 chỉ số năng lực (P5):**
- **FDS** – Kỷ luật tài chính (ghi chép đều, giữ ngân sách, nạp mục tiêu, streak)
- **TAS** – Nhạy bén công nghệ (dùng AI, khám phá tính năng)
- **IPS** – Tiềm năng thu nhập (kỹ năng, earning task, thời gian rảnh)
- **MMS** – Tư duy thịnh vượng (quỹ khẩn cấp, xem báo cáo, tư duy tăng trưởng)

→ Tổ hợp 4 chỉ số ra **1 trong 4 nhóm nghề** (Sáng tạo Nội dung · Chuyên gia Số · Nhà Khai vấn · Kỹ sư Vận hành) + nhận diện **lai (Hybrid)**.

---

## 6. Backend vận hành thế nào

### 6.1. Luồng xử lý 1 tin nhắn

```
1. Người dùng gõ "mua cà phê 30k" / "còn bao nhiêu tiền?"
2. PRISM (client) phân loại ý định:
   • Là LỆNH HÀNH ĐỘNG (chuyển quỹ...)? → cần xác nhận an toàn
   • Là NHẬP GIAO DỊCH? → hiện thẻ nháp "Xác nhận chi 30k" (chống ghi nhầm)
   • Là TRA CỨU số liệu? → tính ngay từ dữ liệu trên máy → trả lời (offline)
   • Là CÂU KHÓ (tư vấn/báo cáo)? → mới gửi lên server/AI
3. Khoác "giọng Lord Diamond" + đính nút gợi ý tiếp theo
4. Nếu là giao dịch đã xác nhận → ghi vào sổ + học thói quen
```

**Nguyên tắc an toàn:** AI **không bao giờ tự ý ghi/sửa tiền**. Mọi giao dịch hay hành động (chuyển quỹ, đặt ngân sách) đều phải **người dùng bấm "Xác nhận"** trên một thẻ nháp. AI chỉ *đề xuất*, người dùng *quyết định*.

### 6.2. Bộ não gồm những gì (thành phần backend)

- **Bộ phân loại ý định** (intent router): nhận diện ~20 loại câu (hỏi số dư, hóa đơn, mục tiêu, báo cáo CFO, tư vấn…) bằng từ khóa + luật, chấm điểm độ tin cậy.
- **~16 "handler" tất định**: mỗi loại câu tra cứu có 1 hàm trả lời, đọc dữ liệu và tính ra con số. **Không cần AI, không cần mạng.**
- **Bộ nhớ**: (a) trí nhớ giao dịch lặp lại; (b) hồ sơ dài hạn (thói quen tài chính nén gọn).
- **Người Gác**: quét tình hình → sinh cảnh báo chủ động.
- **Engine năng lực**: tính 4 chỉ số + phân loại nghề.
- **Tầng AI đám mây**: 2 mô hình (xem mục 7) cho tư vấn sâu/báo cáo.

### 6.3. "Engine isomorphic" — vì sao số liệu luôn khớp

ManiCash có **một lõi tính toán tài chính duy nhất** (gọi là *Money Brain*) — tính số dư an toàn, ngân sách, dòng tiền, sức khỏe tài chính, runway… **Cả màn hình app, cả chat offline, cả server đều gọi chung lõi này.** Nên con số trên chat **luôn khớp** với con số trên các tab khác — không có chuyện "mỗi nơi một số".

Cơ chế: client đóng gói một **"ảnh chụp dữ liệu" (snapshot)** từ bộ nhớ máy → đưa vào Money Brain → ra kết quả. Server (khi cần) cũng nhận đúng snapshot đó → cùng kết quả.

### 6.4. Dữ liệu nằm ở đâu

- **Trên máy (chính):** toàn bộ giao dịch, ngân sách, mục tiêu, thói quen, khảo sát… lưu local (trình duyệt/app). Đây là lý do chạy được offline.
- **Đám mây (Firestore — phụ):** đồng bộ đa thiết bị, lưu lịch sử hội thoại bền vững, hồ sơ AI dài hạn, dữ liệu thanh toán, (sắp tới) báo cáo năng lực.
- **Ranh giới tài khoản:** khi đăng xuất, **toàn bộ dữ liệu local bị xóa sạch** để người dùng kế tiếp trên cùng máy không thấy dữ liệu người trước.

### 6.5. Bảo mật & riêng tư (điểm cần lưu ý khi tư vấn)

- Dữ liệu tài chính **không rời máy** cho các câu hỏi tra cứu thông thường.
- Khi gọi AI đám mây: chỉ gửi **bản tóm tắt số liệu**, hạn chế gửi giao dịch thô (sẽ siết thêm ở P6b).
- Xác thực theo token; chống lạm dụng (rate-limit, license gate).
- Tuân thủ NĐ 13/2023 về dữ liệu cá nhân — khảo sát & CV public sẽ có bước đồng ý.

---

## 7. Mô hình AI 2 tầng & cơ chế tính lượt

| Mô hình | Vai trò | Đặc điểm |
|---|---|---|
| **Groq (Llama 70B)** | Nhanh & rẻ | Phân tích ý định khó, diễn giải ngắn, câu dễ |
| **GPT-4o-mini** | Thông thái & cá nhân hóa | Báo cáo CFO sâu, tư vấn, **nhận xét năng lực "có hồn"** |

**Quota / Credit (chống lạm chi phí):**
- Bộ đếm lượt AI **bắt buộc kiểm ở server** (theo ngày + theo tháng), không lách được bằng xóa cache.
- **Free:** chủ yếu dùng tầng offline; rất ít/không lượt AI thật.
- **Pro:** có quota AI hằng tháng.
- **Mua thêm lượt (credit pack):** 20k / 40k / 100k cho người cần tư vấn sâu nhiều.
- **Cache theo dữ liệu:** dữ liệu không đổi → trả lại kết quả cũ, **không tính phí lại**.

---

## 8. Kiếm tiền thế nào (mô hình kinh doanh)

```
        NGƯỜI DÙNG FREE
   (quản lý tiền + gợi ý cơ bản)
                │  app "gieo mầm": bạn có tố chất X,
                │  nhưng thiếu hệ thống để bứt phá...
                ▼
        NÂNG CẤP PRO / MUA CREDIT
   (tư vấn sâu, đo năng lực đầy đủ, CV)
                │  AI chỉ ra khoảng cách thu nhập
                ▼
        KHÓA HỌC LẺ (AI/Automation/Content)
                │  warm leads
                ▼
        GÓI COACH 1-1 / AUTOMATION  ◄── doanh thu cao nhất
   (dịch vụ người thật của chủ sản phẩm)
```

Nguồn thu: **Pro (49k/tháng · 280k/6 tháng · 539k/năm)** + **credit packs** + **hoa hồng khóa học** + **gói Coach cao cấp**.

**Bối cảnh chiến lược:** bộ đếm doanh thu/người dùng/hoạt động còn phục vụ mục tiêu **đăng ký doanh nghiệp R&D tài chính** (giải pháp cho người thu nhập thấp–trung) → ưu đãi thuế + gọi vốn. Vì vậy số liệu phải **chính xác, bất biến, xuất được**.

**Vai trò "phễu lọc":** app tự động phát hiện ai có tiềm năng/tiến bộ nhất → đưa đúng người vào gói Coach của chủ sản phẩm. AI đóng vai "người chốt sale thầm lặng".

---

## 9. Tình trạng hiện tại

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Nền tảng bán hàng (tier/trial/PayOS) | Code xong | ✅ (chờ bật) |
| P1 Trả lời offline | | ✅ Live |
| P2 Thẻ + lệnh `/` | | ✅ Live |
| P3 Trí nhớ giao dịch | | ✅ Live |
| P4 Người Gác (cảnh báo) | | ✅ Live |
| P5 La Bàn Năng Lực (radar) | | ✅ Live |
| P6a Khảo sát năng lực | | ✅ Live |
| 🔬 Rà soát đối kháng | Vá 16 lỗi nền | ✅ Done |
| **P6b Oracle** (nhận xét AI "có hồn") | ☁️ cần mạng+credit | ⏳ Đang chốt |
| **P6c Coach / Khóa học / CV PDF** | ☁️ cần dữ liệu sản phẩm | ⏳ Đang chốt |

**Đã được kiểm thử đối kháng:** toàn bộ nhóm offline đã qua một vòng review tự động (nhiều tác nhân) tìm bug, **đã vá 16 lỗi** (báo động giả trên tài khoản trống, phân loại nghề lai sai, lệch ngày/giờ, dedup thói quen…). Nền hiện vững.

---

## 10. Sơ đồ kiến trúc tổng

```
┌──────────────────────────── THIẾT BỊ NGƯỜI DÙNG (offline-first) ───────────────────────────┐
│                                                                                             │
│   Khung Chat (Lord Diamond)                                                                 │
│        │                                                                                    │
│        ▼                                                                                    │
│   PRISM  ─────────────┬──────────────┬───────────────┬──────────────┐                       │
│   (bộ điều phối)      │              │               │              │                       │
│        ▼              ▼              ▼               ▼              ▼                        │
│  Phân loại ý định  Handlers     Trí nhớ        Người Gác      La Bàn Năng Lực                │
│                  (16 hàm)     (thói quen)    (cảnh báo)      (4 chỉ số + radar)              │
│        │              │                                                                     │
│        └──────────────┴──────────►  MONEY BRAIN  (lõi tính toán dùng chung)                 │
│                                          ▲                                                   │
│   Dữ liệu local (giao dịch, ngân sách, mục tiêu, thói quen, khảo sát)                        │
│        │                                                                                     │
└────────┼─────────────────────────────────────────────────────────────────────────────────┘
         │  (chỉ khi câu KHÓ / đồng bộ / thanh toán)
         ▼
┌──────────────────────────── ĐÁM MÂY ───────────────────────────────┐
│  API Chat (xác thực + quota) → AI 2 tầng (Groq / GPT-4o-mini)       │
│  Firestore (đồng bộ, lịch sử, hồ sơ AI, thanh toán, báo cáo NL)     │
│  PayOS (thanh toán)                                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 11. Thuật ngữ nhanh

| Từ | Nghĩa |
|---|---|
| **PRISM / Lõi Kim Cương** | Bộ não chat chạy offline trên máy |
| **Lord Diamond** | Nhân vật quản gia (giao diện/giọng nói) |
| **Offline-first** | Ưu tiên xử lý trên máy, chỉ lên mây khi bắt buộc |
| **Money Brain** | Lõi tính toán tài chính dùng chung (đảm bảo số liệu khớp) |
| **Snapshot** | Ảnh chụp dữ liệu người dùng đưa vào engine để tính |
| **Handler tất định** | Hàm trả lời 1 loại câu hỏi mà không cần AI |
| **Người Gác (Guardian)** | Hệ cảnh báo chủ động |
| **La Bàn Năng Lực** | Hệ đo 4 chỉ số FDS/TAS/IPS/MMS + nghề |
| **Oracle** (P6b) | AI viết "nhận xét có hồn" về năng lực |
| **Credit / Quota** | Lượt dùng AI đám mây (giới hạn theo gói) |

---

## 12. Lưu ý cho người tư vấn (ràng buộc khi đề xuất)

Khi đề xuất phương án cho P6b/c, xin cân nhắc các **ràng buộc cố hữu** của hệ thống:

1. **Offline-first là bản sắc** — đừng đề xuất phương án bắt mọi thứ phải online. Phần đám mây chỉ nên là "lớp gia vị" cao cấp, và phải **degrade mượt** khi mất mạng.
2. **Chi phí AI là nhạy cảm** — mỗi lượt gọi GPT tốn tiền. Ưu tiên cache, gating bằng Pro/credit, và chỉ gọi khi thật sự tạo giá trị "wow".
3. **Riêng tư** — hạn chế gửi dữ liệu tài chính thô lên AI; ưu tiên gửi bản tóm tắt/điểm số.
4. **Thị trường Việt Nam** — người dùng thu nhập thấp–trung, nhạy giá; UX phải đơn giản, tiếng Việt tự nhiên, dẫn dắt từng bước.
5. **An toàn dữ liệu tiền** — AI không tự ghi/sửa tiền; luôn cần người xác nhận.
6. **Mục tiêu kép** — vừa giữ chân & kiếm tiền (Pro/credit/Coach), vừa tạo **số liệu chính xác, bất biến** cho hồ sơ R&D/gọi vốn.

**3 câu hỏi sản phẩm cần chốt nhất** (chi tiết trong `docs/P6_DISCOVERY_BRIEF.md`):
1. Danh mục **khóa học** + **gói Coach** (giá, nhóm năng lực, link đích).
2. **Lead** (người quan tâm Coach) đổ về đâu, và **QR trên CV** dẫn về đâu.
3. Nhận xét AI Oracle có **gắn lời mời Coach** ngay hay để trung lập.

---

*Tài liệu này mô tả hệ thống ở mức khái niệm cho mục đích tư vấn. Chi tiết kỹ thuật triển khai nằm trong mã nguồn (`src/lib/aiMoneyChat/`, `src/lib/moneyBrain/`).*
