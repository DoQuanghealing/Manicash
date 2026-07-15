# 🧩 P6 — Tổng Hợp Tài Liệu + Site Map "AI Chat → Coach"

> Em đã đọc 5 file anh gửi. Tài liệu này: (1) em hiểu gì, (2) các file đã trả lời câu hỏi nào của em / còn thiếu gì, (3) **site map từ AI chat đến Coach để anh xác nhận**, (4) các quyết định cần chốt, (5) plan build P6b/c.

---

## 1. Em đã đọc gì (tóm tắt 5 file)

| File | Loại | Nội dung chính |
|---|---|---|
| **Phân Tích Toàn Diện & Đề Xuất Tối Ưu** | Báo cáo chiến lược (Manus AI) | Đánh giá điểm mạnh/yếu, đề xuất P6b (Oracle streaming), P6c (landing Coach + lead + email nurture), UI/UX, customer journey, **roadmap 12 tuần**, **budget 550–900tr + team 7 người**, KPI/metrics |
| **API Setup & Integration Guide** | Hướng dẫn kỹ thuật | Cách dựng hệ "AI-Template" (Node.js/Express **hoặc** Python/FastAPI) + PostgreSQL |
| **ai_template_api_nodejs.js** / **_fastapi.py** | Code backend | API hoàn chỉnh cho hệ chấm bài AI |
| **AI_Template_API.postman_collection** | Bộ test API | Các endpoint: template, assessment, evaluate, stats, admin |

---

## 2. 🔑 Phát hiện lớn: "DuongQuang.Academy" + hệ AI-Template

4 file kỹ thuật mô tả một **hệ thống khóa học có AI chấm bài** (thuộc *DuongQuang.Academy*) — đây **chính là sản phẩm "khóa học/Coach"** mà phễu ManiCash hướng tới. Cách nó chạy:

```
Học viên xem 1 VIDEO bài học (vd "Bẫy Dopamine")
        ▼
Làm 1 ASSESSMENT (bộ câu hỏi + rubric chấm điểm của template đó)
        ▼
Gửi câu trả lời → GPT-4o-mini CHẤM theo rubric
        ▼
Trả về: điểm /10 · Đạt/Chưa · feedback "Quản gia" · +XP · mở BADGE
        + phân tích sentiment (cảm xúc) + effort level (mức nỗ lực)
        ▼
Lưu lịch sử + thống kê (streak, điểm TB) + theo dõi CHI PHÍ API + CHURN risk
```

**Ý nghĩa:** anh đã có sẵn (hoặc đang dựng) một **nền tảng học tập gamified, AI chấm bài**. Nó là **đích đến "Cấp 2 (khóa học)"** trong phễu — và học viên giỏi/tiến bộ sẽ được mời lên **"Cấp 3 (Coach 1-1)"**.

→ Tin tốt: phần "khóa học" của P6c **đã có kiến trúc + code mẫu**. Em không phải thiết kế từ đầu.

⚠️ **Nhưng có một điểm vênh kỹ thuật quan trọng** (xem mục 4).

---

## 3. Đối chiếu: file của anh đã trả lời câu hỏi nào của em?

(So với `docs/P6_DISCOVERY_BRIEF.md`)

| Câu hỏi của em | Trạng thái | File trả lời gì |
|---|---|---|
| **A. Oracle** — model, streaming, persona, cấu trúc 4 phần | ✅ **Đã rõ** | Dùng GPT-4o-mini + streaming + personalization + 4 phần + nút CTA. Khớp plan của em. |
| A1 — credit/lượt mỗi lần | 🟡 Một phần | Có cơ chế **đếm chi phí API** (ai_api_calls) nhưng chưa chốt giá/lượt cho user |
| A4 — privacy (gửi gì lên AI) | 🔴 **Chưa** | Chưa nói rõ |
| A5 — Growth Orientation chấm qua AI | 🟡 | Pattern "AI chấm theo rubric" có sẵn, áp được |
| **B. CV PDF + Profile + QR** | ✅ Đã rõ hướng | 4 trang + profile online + QR (báo cáo xác nhận) |
| B2 — QR/profile lộ uid không | 🔴 **Chưa** | Chưa quyết slug/privacy |
| **C1. Danh mục khóa học** | 🟡 **Một phần** | Có *cấu trúc* khóa (video + assessment) nhưng **chưa có danh sách khóa + giá thật** |
| **C2. Gói Coach** | 🟡 **Đề xuất, chưa chốt** | Manus đề xuất *"4.99tr/6 tháng hoặc 833k/tháng, 4 buổi + Zalo 24/7, cho nhóm TAS>70 & IPS>75"* — **cần anh xác nhận đây có phải gói thật không** |
| **C3. Lead đổ về đâu** | 🟡 Đề xuất | Manus đề xuất: form → booking (Calendly) → Zalo/email cho Coach. Cần anh chốt đích thật |
| **D. Dữ liệu R&D / admin** | ✅ Có sẵn block | Hệ có sẵn **theo dõi chi phí API + churn-risk theo sentiment** → dùng cho admin/R&D |
| **D2. Pháp lý/consent** | 🔴 Chưa | Chưa đề cập |

**Kết luận:** phần **Oracle (A)** và **CV (B)** gần như đã chốt hướng → em build được ngay. Phần **Coach & Khóa học (C)** vẫn cần anh **xác nhận con số/đích thật** — và quan trọng nhất là **quyết định kiến trúc** ở mục 4.

---

## 4. ⚠️ Quyết định kiến trúc QUAN TRỌNG NHẤT cần anh chốt

Hệ AI-Template (file code anh gửi) chạy trên **PostgreSQL + server Node/FastAPI riêng**.
ManiCash chạy trên **Firebase/Firestore + Next.js + Vercel** (offline-first).
→ **Hai stack khác nhau.** Phải chọn cách ghép:

| Hướng | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **A. Gộp vào ManiCash** 💡*(em nghiêng)* nếu academy nằm TRONG app | Viết lại hệ khóa học trên **Firestore + dùng LLM layer sẵn có** của ManiCash | 1 app, 1 stack, 1 đăng nhập, đồng bộ năng lực→khóa học liền mạch | Không dùng lại trực tiếp code Postgres (phải port sang Firestore) |
| **B. Microservice riêng** | Giữ **Postgres + deploy server riêng** (vd Railway), ManiCash gọi API + chia sẻ đăng nhập | Dùng được code consultant gần như ngay | Nuôi 2 stack, 2 DB, phức tạp vận hành + chi phí |
| **C. Academy là site TÁCH RIÊNG** | DuongQuang.Academy là web độc lập; ManiCash chỉ **dẫn link + truyền dữ liệu năng lực** qua | Nhẹ nhất, làm nhanh, mỗi bên tự lo | Trải nghiệm rời rạc, khó đồng bộ XP/badge xuyên 2 app |

**Câu hỏi cho anh:**
- **DuongQuang.Academy đã là một website/app riêng đang chạy chưa**, hay sẽ xây mới?
  - Nếu **đã có riêng** → hướng **C** (dẫn link) trước, tích hợp sâu sau.
  - Nếu **xây mới + muốn liền trong ManiCash** → hướng **A** (Firestore-native, hợp với offline-first).
  - Hướng **B** chỉ nên chọn nếu anh thực sự cần Postgres và có người vận hành server riêng.

> 💡 Gợi ý của em: ManiCash đang rất gọn (1 stack Firebase, offline-first). Em **không khuyên** thêm Postgres + server riêng (hướng B) trừ khi bắt buộc — nó phá sự gọn nhẹ. Nếu academy xây mới, **hướng A** giữ mọi thứ trong 1 nhà.

---

## 5. 🗺️ SITE MAP: từ AI Chat → Coach (PHẦN ANH CẦN XÁC NHẬN)

```
        MANICASH (app tài chính · offline-first · Lord Diamond/PRISM)
┌────────────────────────────────────────────────────────────────────────────┐
│  TẦNG 0 — QUẢN LÝ TIỀN  [Free]                                                │
│    P1 hỏi đáp số liệu · P2 lệnh / · P3 ghi nhanh · P4 cảnh báo  (offline)     │
│                              │  "Khám phá năng lực của bạn →"                 │
│                              ▼                                                │
│  TẦNG 1 — ĐO NĂNG LỰC  [Free xem điểm / Pro xem sâu]                          │
│    P5 /nangluc → Radar 4 chỉ số + nhóm nghề (vd "Nhà Khai vấn Công nghệ")     │
│    P6a /khaosat → khai kỹ năng, thời gian rảnh (chính xác hơn)               │
│                              │                                                │
│                              ▼                                                │
│  TẦNG 2 — ORACLE "CÓ HỒN"  [Pro / tốn credit]                                 │
│    P6b → thư khai vấn (GPT-4o-mini, streaming):                               │
│      ① Gương thần ② Điểm chạm ③ Lộ trình 30 ngày ④ LỜI MỜI                    │
│      Nút:  [📥 Tải CV]   [📚 Khóa học phù hợp]   [💬 Kết nối Coach]            │
└──────────────┬───────────────────────┬────────────────────────┬─────────────┘
               │                       │                        │
   ┌───────────▼─────────┐  ┌──────────▼───────────┐  ┌─────────▼─────────────┐
   │  CV NĂNG LỰC (P6c)  │  │  KHÓA HỌC  (Cấp 2)    │  │  COACH 1-1  (Cấp 3)   │
   │  • PDF 4 trang      │  │  DuongQuang.Academy   │  │  • Form lead          │
   │  • Profile online   │  │  • Video bài học      │  │  • Đặt lịch (booking) │
   │  • QR  ─────────────┼──┤  • AI chấm bài        │  │  • Báo Zalo/email anh │
   │  (khoe → viral)     │  │    (hệ AI-Template):  │  │  • Email nurture      │
   │                     │  │    điểm·XP·badge·     │  │  • GÓI: 4.99tr/6th ?  │
   │                     │  │    feedback·sentiment │  │    (❓ CHỜ ANH CHỐT)  │
   └─────────────────────┘  └───────────┬───────────┘  └──────────▲────────────┘
                                        │  học viên giỏi/tiến bộ   │
                                        └──────── mời lên ─────────┘

   PHÍA SAU (Admin/R&D):  theo dõi chi phí API · churn-risk (sentiment) ·
                          ngách user quan tâm → số liệu cho hồ sơ R&D/gọi vốn
```

**3 điểm trong site map cần anh xác nhận:**
1. **Luồng có đúng ý anh không?** (Chat → đo năng lực → Oracle → 3 nhánh: CV / Khóa học / Coach)
2. **"Khóa học" trỏ vào DuongQuang.Academy** — academy đó nằm ở đâu (mục 4: trong app / site riêng)?
3. **Gói Coach** — con số & nội dung thật là gì (mục 6)?

---

## 6. Các "gói" cần anh XÁC NHẬN con số thật

Manus **đề xuất** (em chưa coi là chốt — cần anh duyệt/sửa):

### Gói Coach 1-1 (Cấp 3 — đích cao nhất)
- Giá đề xuất: **4.990.000đ / 6 tháng** *hoặc* **833.000đ / tháng**
- Gồm: 4 buổi coaching/tháng + hỗ trợ Zalo 24/7 + tặng template/video
- Đối tượng: nhóm "Nhà Khai vấn Công nghệ" (TAS>70 & IPS>75)
- → **Anh xác nhận: tên gói, giá, nội dung, đối tượng thật?**

### Khóa học lẻ (Cấp 2 — DuongQuang.Academy)
- → **Anh cho em danh sách thật:** tên khóa · giá · thuộc nhóm năng lực nào · bán trong app hay link ngoài.

### Đã chốt trước đó (ManiCash, giữ nguyên)
- Pro: **49k/tháng · 280k/6th · 539k/năm** · Credit pack: **20k/40k/100k**.
- → Gói Coach + khóa học **nằm TRÊN** các gói này (high-ticket).

---

## 7. ⚖️ Lưu ý quan trọng: đề xuất "agency" vs cách mình đang làm

Báo cáo Manus đề xuất **budget 550–900 triệu, team 7 người, 12 tuần** — đó là **báo giá kiểu thuê agency làm trọn gói**.

**Cách mình đang làm khác hẳn:** em build **trực tiếp, từng phase, ngay trong codebase** — anh đã thấy P1→P6a + vá 16 bug lên production **mà không tốn 550tr hay team 7 người**. Vậy nên:
- Anh **không cần** chốt "budget 900tr / thuê team" để làm P6b/c. Em làm tiếp được theo đúng nhịp cũ.
- Những **ý tưởng chiến lược** trong báo cáo (streaming Oracle, landing Coach, email nurture, social proof, journey map) thì **rất hữu ích** — em sẽ chắt lọc đưa vào plan.
- Các **con số uplift** (vd "+150% share", "6-8x revenue") là **mục tiêu kỳ vọng**, chưa kiểm chứng — mình theo dõi thực tế rồi điều chỉnh, đừng coi là cam kết.

> Nói thẳng: anh giữ tiền lại. Mình build dần, đo thật, tối ưu thật.

---

## 8. Plan của em cho P6b/c (đã cập nhật theo phát hiện mới)

**P6b — Oracle (làm trước, ~1-2 phase, offline-friendly + 1 lần gọi AI):**
1. Prompt builder "AI Oracle" (persona + 4 phần + nhét điểm số/danh mục/mục tiêu/kỹ năng) — dùng LLM layer + quota sẵn có.
2. Streaming hiển thị (gõ từng chữ) + format đẹp (emoji, đậm) ngay trong thẻ năng lực.
3. Gating: Pro/credit + cache theo (scores + tháng) để không tính phí lại.
4. Nút CTA cuối: [Tải CV] · [Khóa học phù hợp] · [Kết nối Coach].
→ Chỉ cần anh chốt **A1 (credit/lượt)** + **A4 (privacy)** + **A3-④ (CTA Coach gắn ngay hay không)**.

**P6c — CV + Khóa học + Coach (sau, cần data mục 5/6 + quyết kiến trúc mục 4):**
1. CV PDF (server-side render) + profile online (slug ẩn danh) + QR.
2. "Khóa học phù hợp" → map nhóm năng lực → danh sách khóa (DuongQuang.Academy) — theo kiến trúc anh chọn ở mục 4.
3. Lead Coach → form → lưu Firestore + báo anh (Zalo/email) → (sau) booking.
4. Admin: ngách user quan tâm + (tái dùng ý tưởng) chi phí API + churn-risk.

---

## 9. ✅ Việc CẦN anh chốt (rút gọn — chỉ phần mới)

1. **[Kiến trúc — mục 4]** DuongQuang.Academy: đã có site riêng (→hướng C) hay xây mới trong ManiCash (→hướng A)?
2. **[Coach — mục 6]** Gói Coach thật: tên, giá, nội dung, đối tượng (xác nhận hay sửa đề xuất 4.99tr).
3. **[Khóa học — mục 6]** Danh sách khóa thật (tên/giá/nhóm/link).
4. **[Lead — C3]** Khi user bấm "Kết nối Coach" → đổ về đâu (Zalo/email/Sheet/CRM)?
5. **[QR — B2]** QR trên CV dẫn về đâu (profile/landing Coach/cộng đồng)?
6. **[Oracle — A3④]** Lời mời cuối Oracle gắn CTA Coach ngay, hay trung lập đến khi có landing?

> Mục 1 là **quan trọng nhất** — nó định hình toàn bộ P6c. Các mục còn lại anh trả lời dần cũng được; em có thể **bắt đầu P6b ngay** vì nó không phụ thuộc các mục này.

---

*Tài liệu này tổng hợp 5 file anh gửi + đối chiếu kiến trúc ManiCash hiện tại. Mục đích: anh xác nhận site map + các gói + hướng kiến trúc, rồi em build P6b/c.*
