# ManiCash — Plan đưa app lên Google Play (v1)

> Plan này là kết quả của audit ngày 2026-05-25. Mục tiêu: đưa ManiCash từ
> trạng thái Next.js web app → app Android phát hành được trên Google Play
> Store. Phiên bản 1 (v1) chỉ nhắm Android. iOS để v2.

---

## 1. Quyết định đã chốt

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Hướng đóng gói | **Capacitor wrap Next.js (static export)** | Giữ 100% code hiện tại, không rewrite |
| Platform v1 | **Android only** | Giảm chi phí ($25 vs $124), không cần Mac |
| SMS Banking | **Ẩn cho v1** | Đơn giản hóa scope. Bring back ở Phase 7 nếu cần |
| Account deletion | **Hard delete + Export JSON trước khi xóa** | Đơn giản, đúng spec, an toàn cho user |
| Privacy/ToS | Draft trong app + URL công khai | Bắt buộc |
| Demo data | Behind env flag, off trong production | Reviewer không thấy "demo" trong UI |

---

## 2. Tổng quan thời gian

| Phase | Effort | Block dependency |
|---|---|---|
| 1. Production build pass | 1-2 ngày | — (block tất cả) |
| 2. Remove dev surface | 0.5 ngày | After 1 |
| 3. Compliance content | 2-3 ngày | Song song với 4 |
| 4. PWA foundation | 1 ngày | Song song với 3 |
| 5. Capacitor + Android build | 3-5 ngày | After 3 & 4 |
| 6. Play Store submission | 2-3 ngày tự làm + 1-3 ngày review | After 5 |

**Total: ~3 tuần làm + 1-3 ngày Google review.**

---

## 3. Phase 1 — Production build pass (1-2 ngày)

### Mục tiêu
`npm run build && npm run lint` cả 2 exit 0.

### Task

#### 1.1 Sửa build error ở `/input`
- **File**: `src/app/(app)/input/page.tsx`
- **Lỗi**: `useSearchParams() should be wrapped in a suspense boundary`
- **Fix**: Wrap component dùng `useSearchParams()` trong `<Suspense fallback={...}>`
  ```tsx
  export default function InputPage() {
    return (
      <Suspense fallback={<div>Đang tải...</div>}>
        <InputContent />
      </Suspense>
    );
  }
  ```

#### 1.2 Sửa lint errors (27 errors)

Priority order (high → low):

**Critical (block build hoặc gây bug runtime):**
- `Cannot call impure function during render` — `src/components/ui/FloatingBudgetBubble.tsx:314`
- `Cannot access refs during render` — `src/components/ui/FixedBillsPanel.tsx:188`
- `Calling setState synchronously within an effect` — nhiều file:
  - `BudgetSettingsModal.tsx:53,79`
  - `FixedBillsPanel.tsx:32`
  - `XPToast.tsx:36,70`
  - `useFinanceCorePersistence.ts:46`
  - `useFinanceStore.ts:65`

**Style (fix nhanh):**
- `Unescaped entities` — `"` trong JSX text — `TaskFormModal.tsx`, các file khác
- `require()` style imports — `useBudgetStore.ts:249,251` → chuyển thành dynamic `import()` hoặc move top-level
- `Unexpected any` — sửa type hoặc whitelist trong `.eslintrc` cho test files

**Cleanup (low priority, có thể skip nếu hết giờ):**
- Unused imports/vars — 12 warnings

#### 1.3 Acceptance
- `npm run build` xuất ra `.next` thành công + size budget reasonable (< 500KB JS first load)
- `npm run lint` 0 errors (warnings cho phép)

---

## 4. Phase 2 — Remove dev surface (0.5 ngày)

### Mục tiêu
Production build không có UI element "demo", "dev", "bypass" để Google reviewer scan ra.

### Task

#### 2.1 Xóa Dev Bypass Login
- **File**: `src/app/(auth)/login/LoginForm.tsx`
- Xóa function `handleDevBypass()` và button "Dev Bypass Login"
- Verify: build production không còn chuỗi `bypass` trong bundle (`grep -r "bypass" .next/`)

#### 2.2 Ẩn SMS Banking feature
- **Route**: `src/app/(app)/settings/sms-webhook/page.tsx` → wrap toàn page trong feature flag:
  ```tsx
  if (process.env.NEXT_PUBLIC_ENABLE_SMS_WEBHOOK !== 'true') notFound();
  ```
- **Navigation**: bỏ link đến `/settings/sms-webhook` ở Profile/Settings UI
- **API route**: `src/app/api/sms-webhook/route.ts` + `src/app/api/webhook-token/route.ts` — giữ file (vì có thể bring back), nhưng response 404 nếu flag off
- **Keep**: `src/lib/sms/parsers/*` + `src/lib/sms/categoryPredictor.ts` (pure utility, không có UI surface)
- Update `.env.example` thêm dòng `NEXT_PUBLIC_ENABLE_SMS_WEBHOOK=false`
- Update `README.md` ghi rõ feature ẩn cho v1

#### 2.3 Demo seed data behind env flag
- **Files**: `useFinanceStore.ts`, `useBudgetStore.ts`, `useAuthStore.ts`
- Hiện tại: seed data luôn chạy → user mới thấy data ảo
- Sau khi sửa: chỉ chạy khi `NEXT_PUBLIC_DEMO_MODE === 'true'`
- Production build: flag = `false` → user mới thấy empty state
- Demo account cho reviewer dùng riêng (tạo trong Firebase manually)

#### 2.4 Audit UI strings
Grep case-insensitive cho `(demo|test|dev|debug|stub|todo|fixme)` trong tất cả `.tsx` user-facing:
```bash
grep -ri -E "\b(demo|test|dev|debug|stub|todo|fixme)\b" src/app src/components --include="*.tsx"
```
Sửa hoặc xóa từng chỗ.

#### 2.5 Acceptance
- Login screen chỉ có "Đăng nhập với Google"
- Sidebar/Profile không link đến `/settings/sms-webhook`
- `grep -ri "bypass\|demo\|dev mode" src/` chỉ còn matches trong comment/docstring

---

## 5. Phase 3 — Compliance content (2-3 ngày)

### Mục tiêu
- Có Privacy Policy + Terms of Service công khai
- Account deletion flow đầy đủ
- Data export (JSON) trước khi xóa

### Task

#### 3.1 Privacy Policy page
- **File**: `src/app/legal/privacy/page.tsx` (route công khai, không cần auth)
- **Layout**: `src/app/legal/layout.tsx` — minimal, không có app shell
- **Nội dung phải có**:
  - Tên công ty / cá nhân chịu trách nhiệm
  - Loại data thu thập:
    - Identity: email, tên, ảnh đại diện (qua Google Sign-In)
    - Financial: giao dịch, ngưỡng, mục tiêu, ví, snapshot tháng
    - Behavioral: XP, streak, page visits
    - AI: payload gửi Groq (thu nhập, chi tiêu tháng — đã anonymized không có note)
  - Mục đích: cung cấp dịch vụ, AI insights, gamification
  - Bên thứ 3:
    - **Google Sign-In** — link Google Privacy Policy
    - **Firebase** (Google) — Auth + Firestore
    - **Groq** — link Groq Privacy Policy
    - **Vercel** — hosting (nếu deploy ở đây)
  - Data retention: giữ đến khi user xóa account
  - User rights: xem, sửa, xóa, export
  - Cookies: chỉ session cookie Firebase
  - Liên hệ DPO/email
  - Ngày hiệu lực + ngày cập nhật
- **Bắt buộc**: gửi luật sư VN review trước khi public (cá nhân mình có thể draft template tiếng Việt)

#### 3.2 Terms of Service page
- **File**: `src/app/legal/terms/page.tsx`
- **Nội dung**:
  - Quyền sử dụng
  - Cấm hành vi (reverse-engineering, abuse API)
  - Disclaimer cho **AI CFO**: "Lời khuyên từ AI CFO chỉ mang tính tham khảo, không phải tư vấn tài chính chuyên môn. Cậu chủ chịu trách nhiệm về quyết định tài chính của mình."
  - Giới hạn trách nhiệm
  - Luật áp dụng (VN)

#### 3.3 Public delete-request page
- **File**: `src/app/account/delete-request/page.tsx`
- Cho user không login được vẫn submit yêu cầu xóa (Google yêu cầu out-of-app path)
- Form: email + lý do → gửi vào Firebase Functions hoặc email người vận hành

#### 3.4 Account deletion flow trong app

**Files cần tạo/sửa:**
- `src/lib/exportUserData.ts` — collect tất cả data của user, return JSON blob
- `src/lib/deleteAccount.ts` — orchestrate full delete
- `src/app/(app)/profile/_components/DeleteAccountModal.tsx` — UI wizard

**Flow:**
```
Profile → "Xóa tài khoản"
  ↓
Modal Step 1: Cảnh báo
  "⚠️ Xóa tài khoản là hành động không thể hoàn tác. Tất cả dữ liệu
   tài chính, mục tiêu, XP của cậu chủ sẽ biến mất vĩnh viễn."
  [Tải dữ liệu trước khi xóa]  [Tiếp tục]
  ↓
Modal Step 2: Export (optional)
  Bấm "Tải JSON" → download `manicash-data-{date}.json` chứa:
  - profile (uid, email, name)
  - transactions (toàn bộ)
  - budgets, goals, tasks
  - XP history, streak
  ↓
Modal Step 3: Confirm
  Gõ "XÓA TÀI KHOẢN" để confirm
  ↓
Modal Step 4: Re-authenticate
  "Vui lòng đăng nhập lại với Google để xác nhận"
  → reauthenticate via Google OAuth popup
  ↓
Backend cascade:
  1. exportUserData → save snapshot vào Firestore (audit log) — optional
  2. delete Firestore: users/{uid}, transactions/{uid}/*, budgets/{uid}/*, goals/{uid}/*, ...
  3. delete Firebase Storage files (nếu có)
  4. revoke Google OAuth tokens
  5. firebase.auth().currentUser.delete()
  6. localStorage.clear() + IndexedDB clear
  7. Redirect /login + toast "Tài khoản đã được xóa"
```

**Lưu ý kỹ thuật:**
- `firebase.auth().currentUser.delete()` throw `auth/requires-recent-login` nếu user login lâu rồi → bắt error, redirect re-auth
- Firestore delete recursive: dùng batched writes (max 500 docs/batch) hoặc Cloud Function `firebase-tools:firestore:delete --recursive`
- Test edge case: user xóa khi đang offline → queue và retry

#### 3.5 Link Privacy Policy + ToS trong app
- Login screen footer: "Tiếp tục đồng nghĩa với việc đồng ý [ĐKSD] và [Quyền riêng tư]"
- Profile screen: section "Pháp lý" với 2 link
- Trong `manifest.ts`: set `privacy_policy_url`

#### 3.6 Acceptance
- 3 route `/legal/privacy`, `/legal/terms`, `/account/delete-request` build + accessible không login
- Account deletion flow xóa được Firebase Auth user trong test
- Export JSON download được file đúng schema

---

## 6. Phase 4 — PWA foundation (1 ngày)

### Mục tiêu
- Có `manifest.ts` đầy đủ
- Icons + splash screens cho mobile
- Lighthouse PWA score ≥ 90

### Task

#### 4.1 Manifest
- **File**: `src/app/manifest.ts`
  ```ts
  import type { MetadataRoute } from 'next';
  export default function manifest(): MetadataRoute.Manifest {
    return {
      name: 'ManiCash — Butler tài chính cá nhân',
      short_name: 'ManiCash',
      description: 'Quản lý tài chính cá nhân với AI CFO',
      start_url: '/overview',
      display: 'standalone',
      background_color: '#0A0A12',
      theme_color: '#7C3AED',
      orientation: 'portrait',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      categories: ['finance', 'productivity'],
      lang: 'vi',
    };
  }
  ```

#### 4.2 Icon set
- Source: 1 file SVG/PNG 1024x1024 — design logo ManiCash (purple gradient + cash icon)
- Generate sizes via `pwa-asset-generator` hoặc Figma export:
  - 192, 256, 384, 512 (any purpose)
  - 192, 512 (maskable, có safe-zone 80%)
  - 1024 (Android adaptive icon background + foreground)
- Lưu vào `public/icons/`

#### 4.3 Meta tags
- **File**: `src/app/layout.tsx`
- Thêm `<meta name="theme-color" content="#7C3AED">`
- Thêm `<meta name="apple-mobile-web-app-capable" content="yes">`
- Thêm `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`

#### 4.4 (Optional) Service worker
- Dùng `next-pwa` để bundle SW
- Offline-first cho static assets + Firestore caching
- Có thể skip cho v1, làm sau

#### 4.5 Acceptance
- Lighthouse PWA score ≥ 90 trong Chrome DevTools
- Test "Add to Home Screen" trên Chrome Android — icon hiển thị đúng

---

## 7. Phase 5 — Capacitor + Android build (3-5 ngày)

### Mục tiêu
- Có `app-release.aab` (Android App Bundle) signed, ready upload Google Play

### Task

#### 5.1 Architecture refactor

Next.js cần chuyển sang **static export** để Capacitor bundle:

- **File**: `next.config.ts` thêm `output: 'export'`
- **Vấn đề**:
  - API routes `/api/cfo`, `/api/auth/session`, `/api/admin/bans` KHÔNG export được
  - Server Actions không export được
  - Dynamic routes cần `generateStaticParams()`

- **Giải pháp**:
  - **API → deploy riêng lên Vercel** với cấu hình `next.config.ts` thứ 2 (không export)
  - Hoặc tách workspace: `apps/web` (export) + `apps/api` (Vercel functions)
  - Mobile app fetch `https://api.manicash.app/cfo` thay vì `/api/cfo`
  - **CORS** config: allow origin `https://localhost`, `capacitor://localhost`, `http://localhost:3000`
- **Test**: `npm run build` tạo `out/` chứa static HTML/JS/CSS

#### 5.2 Capacitor setup

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/app @capacitor/splash-screen @capacitor/status-bar
npx cap init "ManiCash" "com.manicash.app" --web-dir=out
```

- **File**: `capacitor.config.ts`
  ```ts
  import type { CapacitorConfig } from '@capacitor/cli';
  const config: CapacitorConfig = {
    appId: 'com.manicash.app',
    appName: 'ManiCash',
    webDir: 'out',
    server: {
      androidScheme: 'https',
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 1500,
        backgroundColor: '#0A0A12',
        androidSplashResourceName: 'splash',
      },
      StatusBar: {
        style: 'DARK',
        backgroundColor: '#0A0A12',
      },
    },
  };
  export default config;
  ```

#### 5.3 Firebase Auth trong WebView

**Vấn đề**: `signInWithPopup` không hoạt động trong native WebView (popup bị block).

**Giải pháp**: dùng plugin native
```bash
npm install @capacitor-firebase/authentication
npx cap sync
```

Refactor `useAuthStore.signInWithGoogle()`:
```ts
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';

async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    // result.user, result.credential.idToken
  } else {
    // web flow hiện tại
    await signInWithPopup(auth, provider);
  }
}
```

- Cần `google-services.json` trong `android/app/`
- Cần SHA-1 fingerprint của debug + release keystore → add vào Firebase Console

#### 5.4 Android project

```bash
npx cap add android
npx cap open android  # mở Android Studio
```

- **File**: `android/app/build.gradle`
  ```gradle
  android {
    compileSdk 35
    defaultConfig {
      applicationId "com.manicash.app"
      minSdk 24
      targetSdk 35
      versionCode 1
      versionName "1.0.0"
    }
    // signing config cho release
  }
  ```

- **File**: `android/app/src/main/AndroidManifest.xml`
  - Permissions: **chỉ `INTERNET`** — không xin gì khác
  - Application label, icon (đã copy từ Capacitor sync)
  - `android:usesCleartextTraffic="false"`
  - Deep link intent filter cho OAuth callback

- **Icons**: Capacitor có script generate từ icon source
  ```bash
  npx @capacitor/assets generate --android
  ```

#### 5.5 Signing
- Generate keystore (lưu **TUYỆT ĐỐI AN TOÀN** — mất là không update app được nữa)
  ```bash
  keytool -genkey -v -keystore manicash-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias manicash
  ```
- Backup keystore vào ≥ 2 chỗ (1Password + Google Drive private)
- `android/keystore.properties` (gitignore) chứa password
- Build AAB:
  ```bash
  cd android
  ./gradlew bundleRelease
  # output: android/app/build/outputs/bundle/release/app-release.aab
  ```

#### 5.6 Testing trên thiết bị thật
- Cài AAB qua `bundletool` lên ≥ 1 thiết bị Android thật
- Smoke test:
  - [ ] Login Google thành công, callback đúng
  - [ ] Nhập transaction, xem ledger
  - [ ] AI CFO fetch + render
  - [ ] Mode flagged transactions
  - [ ] Account deletion (xóa thử account test)
  - [ ] Offline → error state đẹp, không crash
  - [ ] Back button Android → đúng UX (không exit app từ giữa flow)
  - [ ] Statusbar + safe-area-inset trên thiết bị có notch
  - [ ] Performance: scroll mượt, animation không lag

#### 5.7 Acceptance
- `app-release.aab` size hợp lý (< 50MB)
- Cài + chạy trên ≥ 2 thiết bị thật khác hãng (Samsung + Xiaomi/Oppo)
- Pass smoke test checklist trên

---

## 8. Phase 6 — Google Play submission (2-3 ngày tự làm + 1-3 ngày review)

### Mục tiêu
- App lên Play Store, status "Available"

### Task

#### 6.1 Google Play Developer Account
- Đăng ký https://play.google.com/console — $25 one-time
- Verify identity (cần ID Vietnam + thẻ thanh toán quốc tế)
- Có thể mất 1-2 ngày verify

#### 6.2 Create app trong Play Console
- App name: "ManiCash — Butler tài chính"
- Default language: Tiếng Việt
- Free / Paid: Free
- Declarations: Yes app contains ads? No. Yes/No content rating questionnaire.

#### 6.3 Store listing
Cần chuẩn bị assets:

| Asset | Spec | Notes |
|---|---|---|
| App icon | 512×512 PNG | Reuse từ Phase 4 |
| Feature graphic | 1024×500 PNG | Banner header trong store |
| Phone screenshots | 2-8 hình, min 1080×1920 | Show Overview, Ledger, Categories drill-down, Goals, AI CFO insight |
| Short description | ≤ 80 chars | "Quản lý chi tiêu thông minh với AI CFO" |
| Full description | ≤ 4000 chars | Sales copy chi tiết tính năng |

#### 6.4 Content rating
- IARC questionnaire — answer "no" hầu hết câu (no violence, no gambling, no user-generated content public)
- Likely rating: **3+** (everyone) hoặc **PEGI 3**

#### 6.5 Data Safety form (BẮT BUỘC)
Khai báo từng loại data:

| Data type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | Yes | App functionality, account management |
| Name | Yes | No | Yes | App functionality |
| User photos (avatar) | Yes | No | No | Account management |
| Financial info (transactions, budgets) | Yes | No | Yes | App functionality |
| App activity (page visits, XP) | Yes | No | No | Analytics, account management |
| Device IDs | No | — | — | — |

- Khai báo encryption in transit: **Yes** (HTTPS)
- Khai báo encryption at rest: **Yes** (Firestore default encryption)
- Account deletion: **Yes, có in-app và in-website** (link `/account/delete-request`)

#### 6.6 Privacy Policy URL
- Đã có từ Phase 3, host trên Vercel: `https://manicash.app/legal/privacy`

#### 6.7 Reviewer instructions
Trong "App content" → "App access":
- Login type: Sign in with Google
- Demo account credentials:
  - Tạo account test riêng: `reviewer@manicash.app` / password
  - Hoặc cho phép sign in by Google với tài khoản riêng họ
  - Note: "Sau khi login, bạn sẽ thấy dashboard với data demo seeded. Test các tab Sổ sách, Mục tiêu, Money để thấy đầy đủ tính năng."

#### 6.8 Production track release
- Upload AAB vào "Production" track
- Rollout: 100% (full release) hoặc staged (5% → 20% → 100% nếu muốn an toàn)
- Release notes (vi + en): "Phiên bản đầu tiên! 🎉 Bao gồm sổ sách, ngưỡng chi tiêu, mục tiêu tài chính, và AI CFO."

#### 6.9 Submit + chờ review
- Click "Send for review"
- Google review trung bình 1-3 ngày (có thể 24h)
- Nếu reject: đọc kỹ feedback, sửa, resubmit

#### 6.10 Acceptance
- App status: **Production / Available** trên Google Play
- Link app accessible từ web `https://play.google.com/store/apps/details?id=com.manicash.app`

---

## 9. Rủi ro & mitigation

| Rủi ro | Khả năng | Impact | Mitigation |
|---|---|---|---|
| Build static export fail vì App Router features | Cao | Block toàn bộ | Test sớm ở Phase 1.5; fallback: split API workspace |
| Firebase Auth không hoạt động trong WebView | Trung bình | Block login | Dùng `@capacitor-firebase/authentication` native plugin |
| AI CFO route 404 sau khi tách API | Trung bình | Mất tính năng | Deploy API riêng trước Phase 5; smoke test sớm |
| Google reject vì content rating | Thấp | Delay 1 tuần | Trả lời IARC trung thực; tránh từ "gambling", "investment advice" |
| Google reject vì account deletion chưa đủ | Trung bình | Delay 1 tuần | Test kỹ Phase 3.4 trước submit |
| Mất keystore release | Thấp | Catastrophic | Backup ≥ 2 nơi, encrypt |
| Privacy Policy không đúng spec VN | Trung bình | Pháp lý | Thuê luật sư review (~$200-500) |

---

## 10. Ngoài phạm vi v1

Những thứ KHÔNG làm cho release đầu, tránh scope creep:

- ❌ iOS app (v2)
- ❌ SMS Banking ingest (Phase 7+)
- ❌ Service worker offline-first đầy đủ (basic PWA OK)
- ❌ Push notifications
- ❌ In-app purchases / Pro tier
- ❌ Multi-language (chỉ tiếng Việt)
- ❌ Onboarding tour cho user mới
- ❌ Backup tự động lên Google Drive
- ❌ Widget Android home screen
- ❌ Migrate Firebase Auth sang Sign in with Vercel
- ❌ Sync data realtime giữa multiple devices (chỉ Firestore default)

---

## 11. Phase 7+ — Roadmap sau v1

Khi đã có production app on Play Store:

1. **iOS port** (~2 tuần) — Capacitor đã có sẵn, chỉ thêm iOS project
2. **SMS Banking bring back** — vẫn dùng webhook architecture, không xin SMS permission
3. **Push notifications** — Firebase Cloud Messaging cho reminders bill
4. **Offline mode** — Service worker + IndexedDB sync queue
5. **Pro tier** — AI CFO unlimited, multi-account, custom categories không giới hạn
6. **Widget Android** — quick add transaction từ home screen
7. **Web app maintain song song** — vẫn cho dùng từ browser desktop

---

## 12. Phase 1 starts ngay khi commit plan này

Sau khi `PLAN.md` được approve, mình sẽ bắt đầu Phase 1 — fix `useSearchParams` suspense + cleanup top critical lint errors.

Kết thúc Phase 1 → demo `npm run build` pass → tiếp Phase 2.
