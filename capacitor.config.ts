import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config — đóng gói bản static export (`out/`) thành app Android.
 * Bản web build (`out/`) được tạo bằng `npm run build:mobile`.
 *
 * appId `com.manicash.app` là package name VĨNH VIỄN trên Google Play — không
 * đổi sau khi publish. Phải khớp với applicationId trong android/app/build.gradle
 * và related_applications trong src/app/manifest.ts.
 */
const config: CapacitorConfig = {
  appId: 'com.manicash.app',
  appName: 'ManiCash',
  webDir: 'out',
  server: {
    // App chạy ở https://localhost trong WebView Android → CORS API phải allow origin này
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0A0A12',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      // Style DARK = chữ sáng cho nền tối (theme dark-first của ManiCash)
      style: 'DARK',
      backgroundColor: '#0A0A12',
      // backgroundColor chỉ áp dụng khi statusbar KHÔNG overlay (Android < 15)
      overlaysWebView: false,
    },
    FirebaseAuthentication: {
      // skipNativeAuth: chỉ lấy Google credential ở native rồi đăng nhập JS SDK
      // (signInWithCredential) → Firestore qua JS SDK hoạt động, không cần sync 2 lớp.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
