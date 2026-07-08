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
| **S0** | Nền admin + khóa cứng 1 email + nút vào | ✅ Xong (2026-07-08: route group `(admin)` + AdminShell + park mobile) |
| **S1** | M1 Tiền & Doanh thu (MVP) | ✅ Xong (2026-07-08: bảng đơn + đối soát + grant + biểu đồ doanh thu); refund M1.4 = P1 sau |
| **S2** | M2 Người dùng / Customer 360 (Firestore-only) | ✅ Xong (2026-07-08: danh bạ Auth⨝Firestore + Customer 360 + actions + deletion list); CRM deep-link CHỜ PO chốt Academy |
| **S3** | M0 Overview + M8 Audit | ✅ Xong (2026-07-08: KPI+hàng đợi + nhật ký admin_audit) |
| **S4** | Pipeline `metric_snapshots` (ưu tiên CAO, làm song song được) | 🟡 Plumbing XONG (consent+API+storage+xóa); **CHỜ PO chốt consent copy/onboarding trước khi BẬT thu thập** (dữ liệu nhạy cảm — Nghị định 13) |
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
| Route group `(admin)` + AdminShell sidebar | ✅ Xong (2026-07-08) | `src/app/(admin)/layout.tsx` = AdminShell (sidebar 9 module, gác cả nhóm qua `useAdminGate`). `/admin` cũ (ban) → `/admin/security`; `/admin` giờ = Tổng quan (M0 stub). Helper chung `src/lib/adminClient.ts`. Nâng `requireAdmin`→role khi cần vai thứ 2. |
| Loại `(admin)` khỏi static export mobile | ✅ Xong (2026-07-08) | `scripts/build-mobile.mjs` park thêm `src/app/(admin)` (cùng cơ chế park `api`/`proxy`) — bundle Android không chứa dashboard quản trị. |

**PO làm 1 lần (sau khi push + Vercel deploy):** `node scripts/grant-admin.mjs doduongquang8686@gmail.com` → đăng xuất/đăng nhập lại → xóa `MANICASH_ADMIN_KEY` trên Vercel.

---

## S1 — M1 Tiền & Doanh thu (MVP · quick win, data đã sẵn Firestore)

| Task | Trạng thái | Acceptance |
|---|---|---|
| M1.1 Bảng đơn hàng | ✅ Xong (2026-07-08) | `GET /api/admin/payments?view=list` đọc `payment_intents` + join email (Admin Auth batch) + đánh dấu `hasGrant` (đối chiếu `grant_events`); lọc status/plan/q; trang `/admin/money`. (Phân trang server-side: hiện cap 500, đủ giai đoạn sớm — nâng cursor khi đông.) |
| **M1.2 Đối soát "đã trả chưa cấp Pro"** (widget quan trọng nhất) | ✅ Xong (2026-07-08) | `GET ...?view=reconcile` (`src/lib/monetization/reconcile.ts`) trả 3 nhóm: **paid-chưa-grant** · **pending/mismatch >30ph** · **grant lạ (orphan)**. Nút "Cấp/Kiểm tra" → `POST /api/admin/grant {orderCode}` = `verifyAndGrantOrder` (paid→re-run atomic idempotent; pending→hỏi PayOS rồi cấp) + ghi `admin_audit`. |
| Grant Pro thủ công | ✅ Xong (2026-07-08) | `POST /api/admin/grant {uid, periodDays}` = `grantProManual` (transaction: stacking hạn, `users.isPremium/premiumExpiresAt`, `grant_events` provider:`admin` orderId:`manual:<ts>`) + `admin_audit`. |
| M1.3 Biểu đồ doanh thu | ✅ Xong (2026-07-08) | `getRevenueSeries` + `?view=revenue`: cột 30 ngày (giờ VN) + tổng + tách theo gói. Trang `/admin/money` khối "📈 Doanh thu 30 ngày". |
| M1.4 Refund (P1) | ⬜ Chưa | Deep-link CRM (không tự động hoá) — chưa làm |

---

## S2 — M2 Người dùng / Customer 360 (Firestore-only) — ✅ XONG 2026-07-08

> **Quyết định kiến trúc (quan trọng):** nguồn danh bạ = **Firebase Auth `listUsers`** (mọi user đăng ký đều có email/displayName/createdAt/lastRefreshTime), LEFT-JOIN `users/{uid}` (thương mại + trạng thái). KHÔNG scan collection `users` (thưa — chỉ có doc khi mua/xóa/quota). `src/lib/admin/directory.ts` + `/api/admin/users`, trang `/admin/users`.

| Task | Trạng thái | Ghi chú |
|---|---|---|
| M2.1 Danh sách user | ✅ Xong | Auth⨝Firestore, `db.getAll` batch, lọc q/plan/status/includeTest, sort theo ngày tạo, cap 500. (Không cần `emailLower`/index vì lọc in-memory.) |
| M2.2 Customer 360 | ✅ Xong (degrade) | 3 khối: định danh (Auth) · thương mại (payments_index+grant_events: tổng đã trả/số đơn/lần cuối/grants) · **hành vi**. ⚠️ **rank/xp/streak nằm ở `users/{uid}/money/state` — CHỈ có khi money sync BẬT (prod đang OFF)** → khối hành vi hiện hiện "Chưa đồng bộ đám mây". |
| Grant/revoke Pro · ban/unban · đánh dấu test | ✅ Xong | `revokePro`/`setTestFlag` + reuse `security.manualBan/unban`; grant reuse `/api/admin/grant`. Mọi action ghi `admin_audit`. |
| M2.3 Yêu cầu xóa tài khoản | ✅ Xong | `/api/admin/overview?view=deletions` đọc `account_deletion_requests`, hiện bảng trên `/admin/users` (pending trước). |
| M2.4 Ban list | ⏭️ Giữ ở `/admin/security` | Không gộp (đã có UI đầy đủ); Customer 360 có nút ban/unban theo uid. |
| Nút deep-link CRM | ⬜ Chưa (CHỜ PO) | Chưa build — **cần PO đồng ý deep-link read-only Academy** trước (tôn trọng luật "không đụng Academy"). |

---

## S3 — M0 Overview + M8 Audit — ✅ XONG 2026-07-08

| Task | Trạng thái | Ghi chú |
|---|---|---|
| M0: KPI | ✅ Xong | `src/lib/admin/overview.ts` + `/api/admin/overview`. Hiện: doanh thu hôm nay · doanh thu 30 ngày (proxy MRR) · Pro đang hoạt động · **DAU** (= Auth `lastRefreshTime` trong 24h — không cần activity tracking riêng) · tổng user. Trang `/admin` (Tổng quan). |
| M0: hàng đợi "việc cần làm" | ✅ Xong | paid-chưa-grant (reuse reconcile) + deletion pending. (Refund pending: chưa có collection refund → bỏ tới khi làm M1.4.) |
| M8: đọc `admin_audit` | ✅ Xong | `src/lib/admin/audit.ts` + `/api/admin/audit`, trang `/admin/audit`: lọc theo loại (grant/user/ban) + người thực hiện. |

---

## S4 — Pipeline `metric_snapshots` — 🟡 PLUMBING XONG 2026-07-08, CHỜ PO bật thu thập

> Bật SỚM, kể cả khi UI R&D chưa làm. Mỗi ngày trễ = mất vĩnh viễn 1 ngày lịch sử "người tốt lên".
> **⚠️ Chốt chặn đạo đức/pháp lý:** metric_snapshots = dữ liệu nhạy cảm (Nghị định 13/2023). Đã build đủ plumbing an-toàn-mặc-định (consent OFF → KHÔNG ghi) nhưng **KHÔNG tự bật thu thập** — chờ PO chốt câu chữ consent + vị trí onboarding.

| Task | Trạng thái | Ghi chú |
|---|---|---|
| Consent `analyticsConsent` | ✅ Xong | Field trên `UserProfile` + `POST/GET /api/telemetry/consent` (server-authoritative). Toggle trong Profile → "Cá nhân hoá" (`AnalyticsConsentToggle`). Mặc định TẮT. |
| POST `/api/telemetry/snapshot` | ✅ Xong | Verify ID token; **chặn nếu `analyticsConsent!==true`** hoặc `isTestAccount`; upsert `metric_snapshots/{uid}_{yyyymmdd}` theo `dateLocal` (KHÔNG UTC) + `schemaVersion`/`appVersion`. Client gửi metrics (engine chạy client). |
| Nằm trong deletion | ✅ Xong | `permanentlyDeleteAccount` xóa thêm mọi `metric_snapshots` của uid (batch). |
| Filter `isTestAccount` | ✅ Xong | Chặn ngay tại endpoint snapshot + overview KPI loại test. |
| **Client tính + tự gửi snapshot / backfill** | ⬜ CHỜ PO | **Chưa wire auto-collect** (đây là phần cần consent copy). Khi PO chốt: viết builder (Health Score + FDS/TAS/IPS/MMS từ store local) + onboarding 1 câu + gọi snapshot khi app mở. |
| Onboarding consent copy + vị trí | ⬜ CHỜ PO | Câu hỏi chốt #2 dưới. |

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
