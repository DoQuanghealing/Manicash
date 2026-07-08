# ManiCash — Roadmap triển khai Admin / CRM / R&D

> Roadmap thực thi, bám theo `docs/ADMIN_CRM_RND_BLUEPRINT.md` (đặc biệt §9 lộ trình + §11 bản cắt gọn cho một-người + §12 ràng buộc PO). Cập nhật trạng thái từng task ngay tại đây. Ngày khởi tạo: 2026-07-07.

## Nguyên tắc thực thi (đã chốt)
- **Gộp 1 admin trong repo ManiCash**, dạng BFF join-on-read. KHÔNG gộp DB.
- **Academy: TUYỆT ĐỐI KHÔNG ĐỤNG** — chỉ deep-link / read-only / clone. Cấm gọi tool `manicash_*`.
- **Firebase giữ nguyên** cho lõi. Supabase (nếu có) chỉ cho tầng R&D/analytics mới, làm sau.
- **Quản trị = đúng 1 email:** `doduongquang8686@gmail.com`. 3 lớp khóa: Custom Claim + allowlist email + email_verified.
- Cắt gọn cho một-người: MVP bỏ `app_events`, bỏ đa vai (chỉ owner+support), bỏ 4/5 mini-game (chỉ CalmBox), bỏ `hsContinuous` kép.
- Trước mọi tính năng chữa lành: `docs/ETHICS_CHARTER.md` + consent 3 tầng (dữ liệu nhạy cảm — Nghị định 13/2023).
- Mỗi tăng trưởng: `tsc` + `npm run build` sạch trước khi commit. Không push khi chưa PO confirm.

---

## Trạng thái tổng

| Sprint | Tên | Trạng thái |
|---|---|---|
| **S0** | Nền admin + khóa cứng 1 email + nút vào | 🟡 Đang làm (phần khóa cứng + nút: XONG phiên 2026-07-07) |
| **S1** | M1 Tiền & Doanh thu (MVP) | ⬜ Chưa |
| **S2** | M2 Người dùng / Customer 360 (Firestore-only) | ⬜ Chưa |
| **S3** | M0 Overview + M8 Audit | ⬜ Chưa |
| **S4** | Pipeline `metric_snapshots` (ưu tiên CAO, làm song song được) | ⬜ Chưa |
| **S5** | Nối định danh 2 hệ (deep-link → sau mới facade) | ⬜ Chưa (phụ thuộc Academy chỉ-đọc) |
| **S6** | M4 R&D dashboard "người tốt lên" | ⬜ Chưa (cần S4 chạy ≥vài tuần) |
| **S7+** | Growth flows · M3/M5 cổng · Chữa lành (sau ETHICS) | ⬜ Chưa |

---

## S0 — Nền admin + khóa cứng quyền

**Mục tiêu:** một khung admin an toàn, chỉ đúng 1 email vào được, có nút vào ở vị trí riêng.

| Task | Trạng thái | Ghi chú / Acceptance |
|---|---|---|
| Gác API bằng Custom Claims (`requireAdmin`) | ✅ Xong (phiên trước) | Bearer ID token + `admin===true` + `checkRevoked` |
| Audit log `admin_audit` | ✅ Xong | Mọi hành động admin ghi lại |
| Script cấp/thu quyền `grant-admin.mjs` | ✅ Xong | + guard chỉ cấp cho email allowlist |
| **Khóa cứng đúng 1 email** (`adminEmails.ts` allowlist) | ✅ Xong (2026-07-07) | `requireAdmin` chặn nếu email ∉ allowlist HOẶC `email_verified===false`. Client `AdminDashboardContent` cũng check. Chặn mọi email khác cố chiếm quyền. |
| **Nút vào admin** ở Profile (vị trí riêng) | ✅ Xong (2026-07-07) | Chỉ render khi `isAdminEmail(user.email)`; link `/admin`. Email khác không thấy nút + không vào được (server chặn). |
| Route group `(admin)` + AdminShell sidebar | ⬜ Chưa | Migrate `/admin` cũ sang; nâng `requireAdmin`→`requireAdminRole` (owner/support) khi cần vai thứ 2 |
| Loại `(admin)` khỏi static export mobile | ⬜ Chưa | Guard `next.config` / env `NEXT_PUBLIC_BUILD_TARGET=mobile` — tránh vỡ build Android |

**PO làm 1 lần (sau khi push + Vercel deploy):** `node scripts/grant-admin.mjs doduongquang8686@gmail.com` → đăng xuất/đăng nhập lại → xóa `MANICASH_ADMIN_KEY` trên Vercel.

---

## S1 — M1 Tiền & Doanh thu (MVP · quick win, data đã sẵn Firestore)

| Task | Acceptance |
|---|---|
| M1.1 Bảng đơn hàng | Đọc `payment_intents`+`payments_index`+`grant_events`; lọc trạng thái/gói/ngày/email; phân trang server-side |
| **M1.2 Đối soát "đã trả chưa cấp Pro"** (widget quan trọng nhất) | 3 danh sách lệch: paid-chưa-grant · intent pending >30ph · grant lạ. Nút re-trigger grant + ghi `admin_audit` |
| Grant Pro thủ công | Ghi `grant_events` + `admin_audit`; cập nhật `users` (isPremium/premiumExpiresAt) |
| M1.3 Biểu đồ doanh thu (P1) | Theo ngày/gói; MRR trend |
| M1.4 Refund (P1) | Deep-link CRM (không tự động hoá) |

---

## S2 — M2 Người dùng / Customer 360 (Firestore-only)

| Task | Acceptance |
|---|---|
| M2.1 Danh sách user | `users` + field `emailLower` + index; tìm theo email; lọc plan/rank/status |
| M2.2 Customer 360 (Firestore) | 3 khối: định danh · tài chính-hành vi (rank/xp/streak/resist) · thương mại (payments) |
| Grant/revoke Pro · ban/unban · đánh dấu test | Ghi `admin_audit` |
| M2.3 Yêu cầu xóa tài khoản | `account_deletion_requests` (pending/done) |
| M2.4 Ban list | Gộp trang `/admin` cũ |
| Nút deep-link CRM (KHÔNG build facade) | Mở hồ sơ Academy tab khác — **chốt trước: PO đồng ý deep-link read-only** |

---

## S3 — M0 Overview + M8 Audit

| Task | Acceptance |
|---|---|
| M0: 4 KPI (MRR · doanh thu hôm nay · Pro active · DAU) | Đọc `users`+`payments_index` |
| M0: hàng đợi "việc cần làm" | deletion pending · refund pending · paid-chưa-grant |
| M8: đọc `admin_audit` | Lọc theo actor/loại/ngày |

---

## S4 — Pipeline `metric_snapshots` (ƯU TIÊN CAO — không hồi tố được)

> Bật SỚM, kể cả khi UI R&D chưa làm. Mỗi ngày trễ = mất vĩnh viễn 1 ngày lịch sử "người tốt lên".

| Task | Acceptance |
|---|---|
| Consent riêng cho R&D (flag `analyticsConsent`) | 1 câu onboarding; `!granted` → không snapshot; nằm trong exportUserData + deletion |
| Client tính snapshot (engine đã có) | Health Score + FDS/TAS/IPS/MMS + hành vi + scalar |
| POST `/api/telemetry/snapshot` | Verify Firebase ID token; ghi `metric_snapshots/{uid_yyyymmdd}` upsert; `dateLocal` (KHÔNG UTC); kèm `schemaVersion`+`appVersion` |
| Backfill khi app mở | Tính lại các ngày trước từ dữ liệu local; chấp nhận sparse |
| Filter `isTestAccount=false` | Trong mọi query R&D |

---

## S5 — Nối định danh 2 hệ (Academy chỉ-đọc)

| Task | Acceptance |
|---|---|
| Mapping ở Firestore `crm_links/{uid}` | ManiCash sở hữu 100%; KHÔNG ghi vào Academy |
| Populate bằng đọc Academy theo email | **CHỜ PO chốt: Academy có API đọc gọi được không?** Nếu không → chỉ deep-link thủ công |
| (Nếu cần) REST facade CHỈ-ĐỌC | Chỉ build khi mở Customer 360 >10 lần/ngày |

---

## S6 — M4 R&D dashboard "người tốt lên" (cần S4 ≥ vài tuần data)

| Task | Acceptance |
|---|---|
| Nightly rollup `analytics_daily_rollup` | Đọc rollup, không scan raw |
| 3 widget lõi | FWI median theo tuần-kể-từ-signup · % cải thiện · Health Score theo plan |
| Nói rõ cỡ mẫu | Mọi số R&D kèm N; KHÔNG dùng làm bằng chứng gọi vốn khi chưa audit |

**Bỏ khỏi giai đoạn đầu:** FDS→IPS lag correlation, Sankey, cohort phức tạp (mẫu nhỏ → spurious).

---

## S7+ — Growth · Cổng CRM · Chữa lành

- **Growth flows:** onboarding activation + Pro paywall theo ngữ cảnh + CV share loop (`leadSource`).
- **M3/M5 cổng CRM:** deep-link + đọc KPI (nếu Academy cho đọc).
- **Chữa lành (M6):** CHỈ sau khi có `docs/ETHICS_CHARTER.md` + consent 3 tầng + disclaimer "không phải công cụ y tế" + hotline. MVP = FES band + **CalmBox** + vài podcash tĩnh + đo bằng holdout (không giữ lại hỗ trợ khủng hoảng).

---

## 3 con số đo ngay (bỏ phần còn lại tới khi đủ mẫu)
`CR_activation` (≥5 giao dịch/3 ngày HOẶC streak 3) · `CR_free_to_pro` · **doanh thu NET tuyệt đối**.

## Câu PO còn cần chốt (không chặn S0–S1)
1. Academy có endpoint đọc để read-only pull không? (nếu không → chỉ deep-link) — chặn S5.
2. Consent 3 tầng: nội dung + vị trí trong onboarding — chặn S4 (phần consent) & chữa lành.
3. Path `/admin` (mặc định) hay subdomain — chặn khi cần siết bảo mật, không phải bây giờ.
