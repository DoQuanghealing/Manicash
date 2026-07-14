# La Bàn Tài Chính Nội Tâm (Financial DNA) — Spec

> Đặc quyền Phú Vương 🐉: bài test **năng lực + thói quen + tâm lý tiền bạc** → xác định
> "nhóm người" → giải pháp hành vi + cách nâng tầm tư duy tài chính.
>
> **Lấp mảnh đang trống:** `capacityEngine` có thành phần `growthOrientation` (Tư duy Tăng
> trưởng) bị để mặc định 50 với ghi chú *"để dành Oracle — cần AI đọc mới đo được"*. Bài test
> này chính là thứ đo nó. Đây là bản hợp nhất: khảo sát năng lực (đã có) + Oracle (P3).
>
> ⚠️ Phần viết tự do = **dữ liệu nhạy cảm nhất** (tầng "chữa lành", `ETHICS_CHARTER §5`). Spec
> này đồng thời là bản review đạo đức mà charter yêu cầu trước khi xây.

---

## 1. Hai tầng (đã chốt)

| | Khi nào | Nội dung | Token |
|---|---|---|---|
| **Teaser** | Bước 1 luồng mời Phú Vương | 4 câu trắc nghiệm nhanh → persona **sơ bộ** | **0** |
| **Bản đầy đủ** | Sau khi đã là Phú Vương (mở từ chat/Hồ sơ) | Trắc nghiệm mở rộng + **viết tự do** + **phân tích AI** | tốn credit |

Teaser deterministic (không AI) → cho "vị" để tạo tò mò, không lộ hết. Bản đầy đủ mới có
phần viết + LLM. Free được Phú Vương → bản đầy đủ là chỗ tự nhiên gate **credit / Pro Plus**.

---

## 2. Khung "nhóm người" — Persona tâm lý tiền

Dựa trên tài chính hành vi (money scripts), Việt hoá + hợp với giọng quản gia. Persona **kết
hợp** dữ liệu hành vi khách quan (từ app) + phần viết chủ quan → không chỉ dán nhãn nghề.

| Persona | Đặc điểm | Điểm mạnh | Điểm mù |
|---|---|---|---|
| 🛡️ **Người Canh Giữ** | Kỷ luật cao, hay lo, tích trữ, ngại tiêu cả khi nên | An toàn, ít nợ | Bỏ lỡ cơ hội, căng thẳng vì tiền |
| 🎈 **Người Phóng Khoáng** | Hào phóng, sống hiện tại, yếu tiết kiệm | Rộng rãi, tận hưởng | Không đệm khẩn cấp, khó dài hạn |
| 🙈 **Người Né Tránh** | Ngại nhìn vào tiền, không ghi chép | Không tham lam | Mất kiểm soát vì không nhìn |
| 🏗️ **Người Kiến Tạo** | Tư duy tăng trưởng, đầu tư, dài hạn | Tài sản sinh sôi | Dễ liều, quên hưởng thụ hiện tại |
| 👑 **Người Thể Diện** | Tiêu để khẳng định giá trị bản thân | Động lực cao, dám chi | Gắn giá trị vào vật chất, dễ quá đà |

Cho phép **lai** (vd Canh Giữ × Né Tránh = "lo âu nên tránh nhìn"). Giọng: **mô tả, không phán xét.**

---

## 3. Phần A — Trắc nghiệm (bấm chọn, 0 token)

Đo thói quen + thái độ, ánh xạ persona + bổ trợ 4 chỉ số năng lực. ~6–8 câu, mỗi đáp án gắn
trọng số tới persona. Ví dụ (khoá sau khi PO duyệt bộ câu):

1. *Cuối tháng dư tiền, bạn thường…* → để yên / tiêu nốt cho đã / đầu tư-tiết kiệm / mua thứ khẳng định bản thân
2. *Nhìn vào bảng chi tiêu, bạn cảm thấy…* → lo lắng / thoải mái / tò mò muốn tối ưu / ngại không muốn xem
3. *Với bạn, tiền chủ yếu là…* → sự an toàn / niềm vui hiện tại / công cụ tạo thêm tiền / thước đo thành công
4. *Khoản chi khiến bạn áy náy nhất…* (mở nhiều lựa chọn)
5–8. (thói quen: tần suất ghi chép, phản ứng khi vượt ngân sách, thái độ với nợ, tầm nhìn 5 năm…)

**Teaser** = lấy 4 câu (1–4) → persona sơ bộ deterministic.

---

## 4. Phần B — Viết tự do (chỉ bản đầy đủ) ⚠️ NHẠY CẢM

2–3 câu hỏi mở, mỗi câu ~vài dòng. Đây là chiều cảm xúc mà trắc nghiệm không chạm tới:

- *"Ký ức hoặc cảm xúc đầu tiên của bạn về tiền là gì?"*
- *"Điều gì về tiền bạc khiến bạn lo lắng nhất lúc này?"*
- *"Nếu tiền không còn là vấn đề, điều đầu tiên bạn làm là gì?"*

**Câu chữ xin phép (bắt buộc, hiện trước phần B):**
> *"Phần này {danh xưng} chia sẻ điều riêng tư hơn — cảm nhận về tiền. Tôi dùng nó chỉ để hiểu
> và đưa lời khuyên hợp với ngài. Không ai khác đọc, ngài xoá được bất cứ lúc nào."*
> [Tôi đồng ý chia sẻ] [Bỏ qua phần này]

Bỏ qua vẫn phân tích được (chỉ dựa phần A) — **không ép**.

---

## 5. Phần C — Phân tích (LLM, tốn credit)

LLM (GPT-4o-mini) đọc **A + B** → xuất báo cáo có cấu trúc (đây cũng chính là Oracle 4 phần):

1. **Nhóm người của bạn** — persona (có thể lai) + mô tả ấm áp, cụ thể với chính họ.
2. **Điểm mạnh & điểm mù** — soi từ hành vi thật + phần viết.
3. **2–3 giải pháp hành vi** — hành động nhỏ, cụ thể, hợp persona (vd Người Né Tránh → "mỗi tối chỉ ghi 1 dòng, không cần đúng").
4. **1 hướng nâng tầm tư duy** — dịch chuyển niềm tin gốc về tiền (money script) theo hướng lành mạnh.

Kết `growthOrientation` (điểm 0–100) ghi lại vào `capacity_report` → nâng độ chính xác MMS.

---

## 6. Ranh giới đạo đức (PHẢI có)

- **Không phán xét** — mọi persona đều có điểm mạnh; giọng nâng đỡ, không chê.
- **Disclaimer** cuối báo cáo: *"Đây là góc nhìn để tham khảo, không phải chẩn đoán tâm lý hay tư vấn đầu tư."*
- **Dấu hiệu khủng hoảng thật** (nợ nần tuyệt vọng, ý nghĩ tiêu cực) → giọng nâng đỡ, gợi tìm hỗ trợ thật, **KHÔNG** xúi liều/vay nóng.
- **Lưu riêng + xoá được:** phần viết tự do lưu `users/{uid}/financial_dna` — xoá tài khoản xoá sạch; thêm nút xoá riêng phần này.
- **Consent tách bạch** (charter tầng 3+): đồng ý Phú Vương ≠ tự động đồng ý chia sẻ phần B.

---

## 7. Tái dùng & kỹ thuật

- Engine: `capacityEngine` (4 chỉ số) + persona mới (mapping trọng số, deterministic cho teaser).
- LLM: đi qua policy credit sẵn có (`aiQuotaPolicy` feature 'report') — bản đầy đủ tính 1 lượt.
- Prompt + validate output theo mẫu `cfoNarration` (đã có pattern system-prompt + validate + cache).
- Lưu: `financial_dna` doc (persona + scores + report + reflectionConsent). Free text lưu tối thiểu, cân nhắc chỉ lưu bản phân tích thay vì raw nếu muốn an toàn hơn.

---

## 8. Lộ trình build (đề xuất)

- **B1** — Bộ câu A + persona mapping (deterministic) + teaser thay/bổ sung Bước 1. *(0 token, ship sớm)*
- **B2** — Phần B (viết tự do) + consent UI + lưu `financial_dna`.
- **B3** — Phần C: prompt LLM + validate + credit gate + render báo cáo (Oracle).
- **B4** — Nút xoá riêng + ghi `growthOrientation` ngược vào capacity.

## 9. Chờ PO chốt
- Duyệt bộ câu A (mình soạn nháp → PO chỉnh) + 3 câu B.
- Bản đầy đủ: Free tốn 1 credit/lần hay khoá hẳn sau Pro Plus?
- Có lưu **raw** phần viết không, hay chỉ lưu bản phân tích (an toàn hơn cho dữ liệu nhạy cảm)?
