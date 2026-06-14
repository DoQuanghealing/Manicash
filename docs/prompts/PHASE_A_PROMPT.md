# Prompt — Phase A: Nền monetization 3 gói (tier + Dùng thử + SKU)

> Giao cho codex chạy trên branch `codex/ai-money-chat`. Plan đầy đủ: `docs/SALES_ADMIN_PAYOS_PLAN.md` (đọc §0, §1, §2, §3, Phase A trước khi code).
> **KHÔNG commit/push** — làm xong viết report, chờ PO duyệt. **KHÔNG đụng** PayOS/admin/chat (Phase B/C/I sau).

---

## Bối cảnh
ManiCash (Next.js 16.2.1 App Router, React 19, TS, Firebase, Zustand, Tailwind v4). Đang dựng milestone M1 "bán hàng": Base (free) / Pro (trả phí) / Dùng thử Pro 1 tháng (miễn phí, 1 lần). Phase A chỉ làm **NỀN LOGIC** (chưa có UI bán hàng — đó là Phase B).

Hạ tầng có sẵn để TÁI DÙNG (đừng viết lại):
- `src/lib/monetization/entitlement.ts` — `resolveTier`, `getProStatus`, `computeProExpiry` (stacking), kill-switch `isMonetizationEnabled()`, hằng `PRO_PRICE_VND=49000`, `PRO_PERIOD_DAYS=30`.
- `src/lib/monetization/grantPro.ts` — `grantProToUser(uid,{periodDays,provider,orderId})` idempotent theo `orderId`, ghi `users/{uid}` qua Admin SDK trong `runTransaction`. `type BillingProvider = 'google_play'|'mock'`.
- `src/lib/aiMoneyChat/quotaCore.ts` — `resolveAiMoneyPlan(profile, now)` (server-side tier cho quota).
- `src/lib/firebaseAdmin.ts` — `getAdminDb()`. `src/lib/requestAuth.ts` — `getVerifiedRequestUid(req)`.
- `src/types/user.ts` — `UserProfile` (đã có `birthDate`, `tier`, `plan`, `isPremium`, `premiumExpiresAt`, `billingProvider`, `billingOrderIds`).
- `firestore.rules` — pattern per-uid owner; collection admin-only = `allow read, write: if false`.
- Test: npm + jiti (KHÔNG pnpm). Mẫu `tests/monetization-entitlement.test.ts` + script `test:monetization`.

---

## Việc cần làm (Phase A)

### A1. Mở rộng type + profile (BLOCKING — làm trước, nếu không tsc fail)
- `grantPro.ts`: `BillingProvider = 'google_play' | 'mock' | 'payos' | 'trial' | 'admin'`. Cập nhật mọi nơi import type.
- `src/types/user.ts` `UserProfile`: thêm `trialUsedAt?: string;` (ISO) và `phone?: string;`. (Ngày sinh: dùng `birthDate` sẵn có, **không** thêm form thu — để trống.)

### A2. Bảng SKU (`entitlement.ts`)
```ts
export type ProSkuId = 'monthly' | 'half_year' | 'yearly';
export const PRO_SKUS: Record<ProSkuId, { amount: number; periodDays: number; productId: string }> = {
  monthly:  { amount: 49_000,  periodDays: 30,  productId: 'manicash_pro_monthly' },
  half_year:{ amount: 280_000, periodDays: 180, productId: 'manicash_pro_6month'  },
  yearly:   { amount: 539_000, periodDays: 365, productId: 'manicash_pro_yearly'  },
};
```
Giữ `PRO_PRICE_VND`/`PRO_PERIOD_DAYS` cũ (gói tháng) để không vỡ chỗ đang dùng.

### A3. Hợp nhất tier-resolver (invariant: "Pro LUÔN có hạn")
- Quy tắc chuẩn dùng chung client+server: **Pro ⟺ `hasPremiumFlag(profile) AND premiumExpiresAt != null AND expiry > now`** (khi kill-switch ON; OFF → Pro như cũ cho demo).
- **Sửa `resolveAiMoneyPlan` (quotaCore.ts):** hiện coi `premiumExpiresAt === null` là Pro-vĩnh-viễn — ĐỔI thành: `premiumExpiresAt == null ⇒ KHÔNG Pro` (coi như free), để khớp `resolveTier`. Đảm bảo client (`entitlement`) và server (`quotaCore`) đồng nhất ai là Pro.
- Test bất biến: với mọi đường cấp Pro, `premiumExpiresAt` luôn khác null; user có flag nhưng expiry null ⇒ free ở CẢ hai resolver.

### A4. Dùng thử ATOMIC — chống lách qua xóa-account + reinstall cùng máy
Tạo `src/lib/monetization/grantTrial.ts`:
- `grantTrialAtomic(uid, email, deviceHash, now?)` — **MỘT `runTransaction` DUY NHẤT** (KHÔNG gọi `grantProToUser` lồng vào — nó tự mở transaction riêng → mất tính atomic):
  1. Đọc `users/{uid}`, `trial_ledger/{emailHash}`, `device_ledger/{deviceHash}`.
  2. Nếu user đang Pro active **HOẶC** emailHash đã có trong ledger **HOẶC** deviceHash đã có → **throw `TrialAlreadyUsed`** (route map 409).
  3. Else, trong cùng transaction: set trên `users/{uid}`: `trialUsedAt=now`, `tier='pro'`, `plan='premium'`, `isPremium=true`, `premiumExpiresAt=computeProExpiry(null, 30, now)`, `billingProvider='trial'`, `billingOrderIds` arrayUnion(`'trial-'+uid`); tạo `trial_ledger/{emailHash}={uid,at}`, `device_ledger/{deviceHash}={uid,ip,at}`, `grant_events/{autoId}={uid,provider:'trial',periodDays:30,orderId:'trial-'+uid,at}`.
- `emailHash = sha256(lowercased trimmed email)`; `deviceHash = sha256(deviceId)` (deviceId = chuỗi random client gửi, lưu localStorage). Lưu kèm `ip` (từ `x-forwarded-for`) trong `device_ledger` để soi gian lận — **không** thu thông tin phần cứng sâu (hợp NĐ 13/2023).
- Helper hash: dùng `crypto` (Node) ở server.

### A5. API route `/api/billing/trial` (POST)
- `src/app/api/billing/trial/route.ts`. Auth bằng `getVerifiedRequestUid(req)` (web). Đọc body `{ deviceId }`. Lấy email từ profile/token, ip từ header.
- Gọi `grantTrialAtomic`. Trả `{ ok, tier, premiumExpiresAt }` (200) / `409 {reason:'trial_used'}` / `401`.
- (Ghi chú: auth Bearer-only cho mobile cross-origin sẽ xử ở Phase C — Phase A web-first.)

### A6. `getPlanCard(profile, now?)` (`entitlement.ts`)
Trả trạng thái cho UI 3 khung (Phase B sẽ render): `{ activeTier, isOnTrial, trialUsed, daysRemaining, proPeriods: PRO_SKUS }`. `trialUsed = Boolean(profile.trialUsedAt)`.

### A7. Firestore rules
Thêm vào `firestore.rules` (admin-SDK-only):
```
match /trial_ledger/{h}   { allow read, write: if false; }
match /device_ledger/{h}  { allow read, write: if false; }
match /grant_events/{id}  { allow read, write: if false; }
```

### A8. Tests (jiti, thêm `tests/*.test.ts` + script `test:*`)
- `tests/monetization-trial.test.ts`: trial lần 1 OK; lần 2 cùng uid → 409; **cùng emailHash uid khác → 409**; **cùng deviceHash → 409**; đang Pro active bấm trial → 409; 2 request song song chỉ 1 thành công (mô phỏng transaction).
- `tests/monetization-tier-invariant.test.ts`: `resolveTier` == `resolveAiMoneyPlan` cho các trạng thái (free / pro-còn-hạn / pro-hết-hạn / flag-nhưng-expiry-null → free).
- Mock Firestore Admin (theo cách các test hiện có mock, xem `tests/` sẵn).
- Đảm bảo `npm run test:monetization` cũ vẫn xanh.

---

## Ràng buộc
- **KHÔNG commit/push.** Xong → viết report (xem dưới), chờ PO.
- Engine phải **isomorphic/deterministic** (tham số `now` truyền vào, KHÔNG gọi `Date.now()` ẩn trong logic thuần).
- Đọc `node_modules/next/dist/docs/` nếu cần về route handler Next 16 (đây KHÔNG phải Next.js bạn quen — có breaking change).
- Không phá test/tsc/lint hiện có. Chạy `npm run lint` + `npx tsc --noEmit` + các test liên quan trước khi báo xong.
- KHÔNG đụng UI bán hàng (Phase B), PayOS (Phase C), admin (Phase D), chat (Phase I).

## Report cần nộp (sau khi xong)
1. File đã tạo/sửa (đường dẫn).
2. Quyết định kỹ thuật (cách mock Firestore transaction trong test, cách lấy ip/email).
3. Kết quả: `tsc --noEmit`, `lint`, các test (số PASS/FAIL, dán output).
4. Việc CÒN LẠI / giả định / điểm cần PO xác nhận.
5. Xác nhận: chưa commit/push.
</content>
