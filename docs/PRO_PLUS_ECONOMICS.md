# Pro Plus (Phú Vương) — Mô hình kinh tế API (T6 · PV-5)

> **Chốt 2026-07-18.** Giá **99.000đ/tháng**. Nguồn sự thật cho quota + trần an toàn.
> Con số chi phí lấy từ chính engine (`aiCostCore.ts`, fx 26.000đ/USD).

## 1. Chi phí thật mỗi lượt (trần, làm tròn lên)

| Loại lượt | Model | Trần chi phí/lượt |
|---|---|---|
| rescue (cứu intent) | Groq 8B | 0,77đ |
| chat / tư vấn sâu | Groq 70B | 15,26đ |
| task_eval (thẩm định nhiệm vụ) | Groq 70B | 27,66đ |
| report CFO | GPT-4o-mini (worst) | 29,64đ |
| dna_oracle (PV-3, sắp có) | GPT-4o-mini | 24,18đ |

`task_eval` dùng chung "kho" `report` (chi phí tương đương).

## 2. Doanh thu ròng

`99.000đ − PayOS ~2,2% (~2.180đ) ≈ **96.800đ net/user/tháng**` (chưa trừ hạ tầng cố định — không đáng kể/user).

## 3. Quota Pro Plus — hồ sơ "Rộng rãi" (PO chọn)

| Feature (kho) | Trần/ngày | Trần/tháng |
|---|---|---|
| chat (tư vấn sâu, rescue) | 80 | 1.200 |
| report (CFO + task_eval) | 15 | 300 |

Ràng buộc THẬT là **trần tháng** (1.200/300), không phải trần ngày.

## 4. Chi phí thực tế theo hành vi

> **Lưu ý enforcement:** hệ thống chặn bằng **trần NGÀY (80/15) + credit tháng (4.000)** — KHÔNG bằng trần tháng feature. Vì chat rẻ credit nhưng đắt tiền, quota-only có thể lên **~33%**. Vì vậy **trần VND fix cứng 30k mới là lớp ĐẢM BẢO margin** (mục 5), không phải quota.

| Persona | chat/report tháng | Chi phí API | % giá | Lãi gộp |
|---|---|---|---|---|
| Nhẹ (5+1/ngày) | 150 / 30 | ~3.180đ | 3,2% | 96,8% |
| Nặng (20+4/ngày) | 600 / 120 | ~12.700đ | 12,8% | 87% |
| Kịch trần quota (không trần VND) | ~2.000 / ~250 | ~33.000đ | ~33% | 67% |
| **Có trần VND fix cứng (30k)** | **bị chặn ở 30k** | **≤ 30.030đ** | **≤ 30,3%** | **≥ 67%** |

95%+ user nằm ở vùng nhẹ/nặng (≤13% giá). Chỉ user cực đoan chạm trần 30k — và **tại đó margin vẫn ≥67%**.

## 5. Ba vùng + trần fix cứng

| Vùng | Ngưỡng | Xử lý |
|---|---|---|
| **1. Bao gồm** | ≤ trần ngày (80/15) | Phục vụ đầy đủ — 99%+ user không chạm |
| **2. Vượt (grace)** | tới trần tháng (1.200/300) | Vẫn phục vụ, "cảm giác vô hạn" |
| **3. FIX CỨNG** | **30.000đ/user/tháng** chi phí API (=30% giá) | **Degrade mềm** → bản deterministic 0đ |

### Trần fix cứng = 30.000đ/user/tháng (30% giá gói) — LỚP ĐẢM BẢO CHÍNH
- Tại đó: `99k − 30k API − 2,2k PayOS = ~66,8k lãi gộp (67%)` → **không bao giờ lỗ trên bất kỳ user nào**, kể cả abuser.
- Đây (không phải quota) là thứ **chốt margin ≥67%**: quota để rộng cho "cảm giác vô hạn", trần VND đỡ phần đuôi.
- Cũng che luôn rủi ro đổi model/giá hoặc thêm dna_oracle (PV-3).
- Kiểm chứng CI: `tests/ai-cost-simulation.test.ts` mô phỏng abuser pro_plus qua CHÍNH engine + trần → assert ≤ 30k.

### Degrade mềm (PO chọn) — khi chạm 30k
- Hạ về **bản deterministic 0đ**: điểm khả thi live, Care Companion, báo cáo cơ bản, feasibility score — **vẫn dùng được**.
- Thông báo lịch sự: *"Quản gia đang nghỉ dưỡng não bộ, mai phục vụ ngài tiếp."*
- KHÔNG khoá hẳn → khách vẫn thỏa mãn phần nào.

## 6. Cầu dao toàn nền tảng (khác trần/user)

Bên cạnh trần/user, có cầu dao chi tiêu API **/ngày toàn nền tảng** (`aiCostCore.evaluateSpendBreaker`, mặc định 50.000đ/ngày). Khi Pro Plus tăng, nâng theo `max(50.000đ, 3%×MRR/30)` (plan §6).

## 7. Triển khai (T6)

**Đã code (additive, gate sau `NEXT_PUBLIC_BUTLER_BILLING_ENFORCED`):**
- `pro_plus` trong AiTier/AiMoneyQuotaPlan + `DEFAULT_AI_QUOTA.pro_plus` (80/1200, 15/300).
- `PRO_PLUS_PRICE_VND = 99.000` + `Tier` mở rộng.
- Trần fix cứng: `getUserMonthlyCostCeilingVnd` + `evaluateUserCostCeiling` (pure) + accumulator `costVndThisMonth` trong `logAiUsage`.
- `billingLevelCap('pro_plus') → 3`.
- Cost-sim thêm persona pro_plus (CI chốt ≤30%).

**PO/PV-5 làm cùng lúc (chạm PayOS live — KHÔNG tự động):**
- Tạo SKU 99.000đ trong PayOS dashboard.
- Bật `NEXT_PUBLIC_BUTLER_BILLING_ENFORCED=true` (đồng thời cap Free→1, Pro→2, Pro Plus→3).
- Migration Free-sovereign hiện tại: báo 14 ngày + trial trước khi rơi về gói.
