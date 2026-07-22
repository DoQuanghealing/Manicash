# ManiCash — Backlog (cập nhật 2026-07-19)

Việc CÒN LẠI sau khi hoàn tất butler roadmap T1→T6 + taste quota + migration PV-5.
Sắp theo mức chặn. Mục nào cần PO thao tác tay đều ghi rõ.

---

## 🔴 A. Chặn phát hành PV-5 (cần PO thao tác — chạm hệ thống LIVE)

| # | Việc | Ghi chú |
|---|---|---|
| A1 | **Tạo SKU 99.000đ trong PayOS dashboard** (`manicash_pro_plus_monthly`) | Code đã có `PRO_PLUS_PRICE_VND`/`PRO_PLUS_PRODUCT_ID`. Claude KHÔNG tự đụng PayOS live. |
| A2 | **Bật `NEXT_PUBLIC_BUTLER_BILLING_ENFORCED=true`** | Kích hoạt: cap cấp theo gói + taste quota + flow migration. Trước khi bật, mọi thứ inert (FOMO). |
| ~~A3~~ | ~~Nối đường cấp quyền Pro Plus~~ | ✅ **ĐÃ XONG** (xem dưới) |
| ~~A4~~ | ~~Thẻ mua Pro Plus trên trang giá~~ | ✅ **ĐÃ XONG** — thẻ "🐉 Phú Vương" 99k, `getPlanCard` đánh dấu active đúng. |
| A5 | Test webhook PayOS end-to-end với SKU `pro_plus_monthly` | Sau A1. |

> ✅ **Chuỗi mua Pro Plus giờ đã nối trọn:**
> thẻ trên trang giá → `startCheckout('pro_plus_monthly')` → `create-link` validate SKU (99k/30d)
> → `payment_intents` → webhook PayOS → `tierForSku(intent.plan)` → cấp `pro_plus` → mở cấp quản gia 3.
> **Chỉ còn thiếu A1** (tạo SKU trong PayOS dashboard) là bán được thật.

> ✅ **A3 đã sửa (2026-07-19).** Gốc bug: `payosGrant.ts` (đường LIVE) và `grantPro.ts` đều hard-code
> `tier:'pro'`, bỏ qua SKU của đơn.
>
> Cách sửa: **SKU tự khai nó cấp tier nào** (`ProSku.grantsTier`) + `tierForSku()` / `tierForProductId()`
> + `entitlementFieldsForTier()` là NGUỒN DUY NHẤT ghi field entitlement. `payosGrant` giờ đọc
> `intent.plan` → tier; `grantProToUser` nhận `skuId`/`productId`. SKU lạ → `'pro'` (fail-safe,
> không bao giờ tự phát nhầm quyền cấp 3). Ghi thêm `grantedTier` vào `payments_index` + `grant_events`
> để đối soát.
>
> Có test hồi quy: *"mua SKU 99k → ghi field → resolveTier → mở được cấp 3"* + đối chứng Pro thường vẫn cấp 2.

## 🟠 B. Tính năng cấp 3 đã khai gate nhưng CHƯA build

Các gate tồn tại trong `butlerFeatures.FEATURE_MIN_LEVEL` nhưng không nơi nào dùng:

| # | Feature | Trạng thái |
|---|---|---|
| B1 | `dna.oracle` — **PV-3 Financial DNA + Oracle** | Có spec (`docs/`), chưa build. Tính năng cấp 3 lớn nhất còn thiếu. |
| B2 | `sync.multiDevice` — **PV-4 money sync đa thiết bị** | Chưa build. Liên quan D1. |
| B3 | `query.full` — truy xuất cross-period + LLM-with-snapshot | Chưa build. |
| B4 | `task.completion.watch` | **Gate mồ côi**: điểm khả thi live đang gate nhầm vào `task.eval`. Cleanup nhỏ (~5 phút). |

## 🟡 C. Follow-up nhỏ (không chặn)

| # | Việc |
|---|---|
| C1 | Care script #7 (`task-nudge`) "Chia giúp ta" → auto-mở + auto-chạy thẩm định đúng task quá hạn (hiện chỉ điều hướng `/money`). Cần store flag chia sẻ. |
| C2 | Cân nhắc tách "kho" quota `task_eval` riêng nếu muốn trần 12đ độc lập (hiện dùng chung kho `report`). |
| C3 | PO duyệt/biên tập lời thoại 10 kịch bản Care — `src/lib/aiMoneyChat/care/careScripts.ts`, object `CONTENT`. |
| C4 | Nâng cầu dao ngân sách nền tảng theo MRR: `max(50.000đ, 3%×MRR/30)` (hiện fix 50k/ngày). |

## ⚪ D. Từ phiên trước — CẦN XÁC MINH LẠI (có thể đã cũ)

| # | Việc |
|---|---|
| D1 | Money sync trên web vẫn TẮT → set `NEXT_PUBLIC_MONEY_SYNC_ENABLED=true` trên Vercel + publish Firestore rules (`match /money`). |
| D2 | Gỡ nhánh debug `admin_test`. |
| D3 | iOS: chưa bắt đầu — cần máy Mac + chốt Apple IAP (PayOS sẽ bị Apple reject). |
| D4 | P6 discovery + landing page mới ở dạng draft. |

---

## ✅ Đã xong (tham chiếu)

- **Butler T1→T6**: feature matrix 3 cấp · zero-leak billing · CI cost-simulation · post-payment (#2) · Care Companion (10 kịch bản 0đ) · Task Eval · Pro Plus 99k + trần chi phí fix cứng.
- **Taste quota**: Free 4 lượt tư vấn sâu/tháng · Pro 5 lượt thẩm định nhiệm vụ/tháng → upsell.
- **Migration PV-5**: 14 ngày báo + 7 ngày trial (vẫn full cấp 3) → hạ mềm về gói.
- Kinh tế: `docs/PRO_PLUS_ECONOMICS.md` (trần 30k/user/tháng → margin ≥69%, CI kiểm chứng).
