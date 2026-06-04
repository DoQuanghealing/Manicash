# P0 Monetization Report

Date: 2026-06-03
Branch: codex/ai-money-chat

## Muc tieu

Bien ManiCash tu app mien phi thanh SaaS ban duoc: kich hoat gating Free/Pro that,
co paywall, va co duong cap Pro cho user sau khi thanh toan. Xay provider-agnostic
de cam Google Play Billing sau ma khong sua lai logic.

## Da hoan thanh

### Entitlement core (single source of truth)
- `src/lib/monetization/entitlement.ts` (pure, testable):
  - `resolveTier` / `isProActive` / `getProStatus`: tinh Free/Pro tu tier/plan/isPremium + premiumExpiresAt, co check het han. Mirror logic server `resolveAiMoneyPlan` (quotaCore) de client + server dong bo.
  - `computeProExpiry`: cong don thoi gian khi gia han.
  - Kill-switch `NEXT_PUBLIC_MONETIZATION_ENABLED`: off (default) = moi user la Pro (giu hanh vi demo, khong khoa user truoc khi co billing); on = enforce.
  - Hang so: `PRO_PRICE_VND=49000`, `PRO_PERIOD_DAYS=30`, `PRO_PRODUCT_ID`, `PRO_FEATURES`.

### Gating that
- `src/utils/proGating.ts`: `isPro()` / `canUseSmsWebhook()` goi `isProActive` (thay vi luon true).
- `src/lib/firebase/auth.ts`: `fetchUserProfile` GIO doc `tier` (truoc bi bo sot) + parse premiumExpiresAt Timestamp.

### Server granting + verify API
- `src/lib/monetization/grantPro.ts`:
  - `verifyPurchase`: provider-agnostic. `mock` chi chap nhan khi `BILLING_ALLOW_MOCK=true`; `google_play` la stub TODO (Google Play Developer API).
  - `grantProToUser`: transaction set tier=pro/plan=premium/isPremium + premiumExpiresAt (cong don), idempotent theo orderId (billingOrderIds arrayUnion).
- `src/app/api/billing/verify/route.ts`: POST verify uid → verifyPurchase → grantProToUser. Tra granted/invalid/unauthorized/rejected/error.

### Client flow + paywall
- `src/lib/monetization/billingClient.ts`: `purchasePro()` — acquire token (native Google Play plug-in sau; web/dev fallback mock token) → goi /api/billing/verify.
- `src/app/(app)/upgrade`: paywall page — hero, gia 49k, features list, CTA, hien trang thai Pro/het han, cap nhat store ngay khi thanh toan thanh cong.
- `src/components/ui/ProGate.tsx` + `src/hooks/useIsPro.ts`: gate tinh nang. Free → card "nang cap".
- CFO narration (`CfoReportContent`): Pro → nut "Hoi Lord Diamond"; Free → ProGate prompt.
- Profile: card "Nang cap Pro" / "ManiCash Pro" link toi /upgrade.

### Analytics
- Them events: upgrade_view, upgrade_start, upgrade_success, upgrade_failed, pro_gate_blocked.

## Files changed (new)
- `src/lib/monetization/entitlement.ts`, `grantPro.ts`, `billingClient.ts`
- `src/app/api/billing/verify/route.ts`
- `src/app/(app)/upgrade/page.tsx`, `_components/UpgradeContent.tsx`, `_components/upgrade.css`
- `src/components/ui/ProGate.tsx`, `pro-gate.css`
- `src/hooks/useIsPro.ts`
- `tests/monetization-entitlement.test.ts`

## Files changed (modified)
- `src/utils/proGating.ts`, `src/lib/firebase/auth.ts`, `src/lib/analytics/events.ts`
- `src/app/(app)/report/_components/CfoReportContent.tsx`
- `src/app/(app)/profile/_components/ProfileContent.tsx` + `.css`
- `.env.example`, `package.json`

## Tests
- `npm run test:monetization`: pass (kill-switch off/on, expiry, computeProExpiry).
- `npm run test:ai-all`: 0 fail (da bao gom monetization).
- `npm run build`: pass — routes `/upgrade`, `/api/billing/verify`.
- `npm run lint`: file moi sach.

## Con lai de thuc su thu tien
1. **Google Play Billing native**: cam Capacitor plugin vao `acquirePurchaseToken()` + tao product `manicash_pro_monthly` tren Play Console.
2. **Server verify that**: implement `verifyPurchase('google_play')` qua Google Play Developer API (service account).
3. **Bat kill-switch**: set `NEXT_PUBLIC_MONETIZATION_ENABLED=true` khi billing san sang.
4. **Webhook gia han/huy**: Real-time Developer Notifications (RTDN) → cap nhat premiumExpiresAt khi renew/cancel/refund.
5. **Firestore rules**: dam bao client KHONG tu ghi duoc tier/premiumExpiresAt (chi admin SDK qua API).

## Rui ro con lai
- Hien mock purchase (BILLING_ALLOW_MOCK) chi de test E2E; production phai tat.
- Chua co RTDN nen Pro het han chi check bang premiumExpiresAt (du cho v1).
