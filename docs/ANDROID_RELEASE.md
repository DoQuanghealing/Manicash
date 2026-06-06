# Hướng dẫn build & phát hành Android (Phase 5.5 → 6)

> Trạng thái: **5.1 → 5.5-prep ĐÃ XONG** (toàn bộ phần code + scaffold chạy được
> trên Windows). Tài liệu này là các bước còn lại cần **Android Studio + Firebase
> Console + thiết bị thật**. Branch: `codex/ai-money-chat`.

## Đã hoàn tất (không cần làm lại)
- ✅ 5.1 Static export + API split (1 repo, 2 build mode)
- ✅ 5.2 Capacitor 8.4 + `capacitor.config.ts` (appId `com.manicash.app`)
- ✅ 5.3 Firebase native auth (`signInWithGoogle` branch native/web) + `AuthGuard`
  client-side + CORS cho API trong `proxy.ts`
- ✅ 5.4 `android/` Gradle project (chỉ quyền INTERNET, google-services wire sẵn)
- ✅ 5.5-prep App icons ManiCash + signing config (`build.gradle` đọc `keystore.properties`)

---

## Yêu cầu môi trường
- **Android Studio** (bản mới) + **JDK 17** + **Android SDK** (qua SDK Manager)
- Tài khoản Google Play Developer ($25) — cho Phase 6

---

## Bước A — Thêm Android app vào Firebase + `google-services.json`

Cần thiết vì đăng nhập Google native dùng `@capacitor-firebase/authentication`,
plugin này đọc `google-services.json`.

1. [console.firebase.google.com](https://console.firebase.google.com) → project **`manicash-a943a`**
2. ⚙️ cạnh "Project Overview" → **Project settings** → mục **Your apps** → **Add app** → icon **Android**
3. Điền form:
   - **Android package name**: `com.manicash.app` ⚠️ khớp tuyệt đối (= `applicationId`
     trong `android/app/build.gradle`). Sai 1 ký tự là không nhận.
   - **App nickname**: `ManiCash Android` (tùy ý)
   - **Debug SHA-1**: thêm sau (xem Bước B) — bắt buộc cho Google Sign-In
4. **Download `google-services.json`** → đặt vào **`android/app/google-services.json`**
   (cùng cấp `build.gradle`, KHÔNG phải `android/` gốc)
5. **Bỏ qua** phần wizard "Add Firebase SDK" (classpath/apply plugin) — Capacitor đã
   wire sẵn (`android/build.gradle` có `classpath com.google.gms:google-services:4.4.4`,
   `app/build.gradle` tự apply khi thấy json). Chỉ cần đặt đúng file.

Kiểm tra: mở `google-services.json` thấy `"package_name": "com.manicash.app"` và
`"project_id": "manicash-a943a"`.

---

## Bước B — SHA-1 fingerprints (quan trọng nhất)

Google Sign-In native CHỈ chạy khi SHA-1 của keystore được đăng ký trong Firebase.
Thiếu → lỗi `code 10: DEVELOPER_ERROR`. Add tại: Project Settings → Android app →
**Add fingerprint**. Mỗi lần add xong → **tải lại `google-services.json`** đè vào `android/app/`.

3 loại SHA-1 cần add:
1. **Debug** (test máy/emulator):
   ```bash
   cd android && gradlew.bat signingReport
   ```
   Lấy `SHA1` ở block `Variant: debug`.
2. **Release / upload key** (sau Bước C):
   ```bash
   keytool -list -v -keystore manicash-release.jks -alias manicash
   ```
3. **Play App Signing** (⚠️ hay quên): Khi upload AAB, Google ký lại bằng key của họ →
   SHA-1 thật khác. Lấy từ **Play Console → Setup → App signing** (sau upload lần đầu),
   add vào Firebase. Không add = login Google chạy lúc test nhưng FAIL trên bản Play Store.

---

## Bước C — Tạo keystore (chạy 1 lần)

```bash
keytool -genkey -v -keystore manicash-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias manicash
cp android/keystore.properties.example android/keystore.properties   # rồi điền mật khẩu thật
```

⚠️ **BACKUP `manicash-release.jks` + mật khẩu ở ≥ 2 nơi an toàn** (1Password + Google
Drive private). Mất keystore = KHÔNG BAO GIỜ update được app trên Play Store nữa.

`keystore.properties` và `*.jks` đã được gitignore — KHÔNG commit.

---

## Bước D — Build AAB

```bash
npm run build:mobile          # tạo out/ (static export, park api/proxy)
npx cap sync android          # copy out/ + plugin vào android/
cd android && gradlew.bat bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Mục tiêu: AAB < 50MB. Nếu build lỗi → kiểm google-services.json + JDK 17 + SDK.

---

## Bước E — Test thiết bị thật (5.6)

Cài qua `bundletool` hoặc `gradlew.bat installRelease`. Checklist smoke:
- [ ] Login Google thành công (cần SHA-1 đúng!)
- [ ] Nhập transaction, xem ledger
- [ ] AI CFO fetch + render (cần `NEXT_PUBLIC_API_BASE_URL` trỏ đúng API Vercel + CORS)
- [ ] Account deletion (test account)
- [ ] Offline → trang /offline đẹp, không crash
- [ ] Back button Android → UX đúng
- [ ] StatusBar + safe-area trên máy có notch
- [ ] Scroll/animation mượt

---

## Lưu ý kiến trúc (đã quyết)

- **API:** bản mobile gọi API ở remote qua `NEXT_PUBLIC_API_BASE_URL` (set lúc
  `build:mobile`, vd `https://manicash.vercel.app`). Web build để trống = same-origin.
- **Auth mobile:** client-side guard (`AuthGuard`) + Bearer token, KHÔNG dùng cookie/proxy.
- **Build mobile** luôn theo thứ tự: `build:mobile` → `cap sync android` → gradle.
- `scripts/build-mobile.mjs` tự park `app/api` + `proxy.ts` (static export không hỗ trợ).

## Phase 6 — Play submission (sau khi có AAB)
Xem `PLAN.md` mục 8: Play Console $25, Data Safety form, content rating, store
listing (screenshots, mô tả), reviewer demo account, upload AAB → Production.
