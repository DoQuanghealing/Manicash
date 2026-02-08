
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let auth: any = null;
let isConfigured = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    isConfigured = true;
  }
} catch (error) {
  console.error("[Firebase Init] Lỗi cấu hình:", error);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Mock state for Admin/Debug mode
let mockUser: any = JSON.parse(localStorage.getItem('manicash_mock_user') || 'null');
let authChangeCallback: ((user: any) => void) | null = null;

export const AuthService = {
  isConfigured: () => isConfigured,

  checkPreConditions: () => {
    console.log("[Auth] Kiểm tra điều kiện trước đăng nhập...");
    if (!navigator.onLine) {
      throw new Error("NETWORK_ERROR: Không có kết nối mạng. Vui lòng kiểm tra lại Wifi/4G.");
    }
    // Trong môi trường web, chúng ta giả định Google Services khả dụng nếu có internet
    // Nếu là môi trường Hybrid (Capacitor/Cordova), bước này sẽ kiểm tra Play Services native
    return true;
  },

  loginWithGoogle: async () => {
    console.log("[Auth] Bắt đầu quy trình đăng nhập Google...");
    
    if (!auth) {
      console.warn("[Auth] Firebase chưa được cấu hình, chuyển hướng sang demo.");
      throw new Error("CONFIGURATION_ERROR: Firebase chưa được cấu hình.");
    }

    AuthService.checkPreConditions();

    // Tạo một Promise timeout 20 giây
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT: Quá trình đăng nhập mất quá nhiều thời gian (20s).")), 20000);
    });

    try {
      console.log("[Auth] Đang mở Popup Google...");
      const loginPromise = signInWithPopup(auth, provider);
      
      // Chạy đua giữa login và timeout
      const result: any = await Promise.race([loginPromise, timeoutPromise]);
      
      console.log("[Auth] Lấy Token thành công:", result.user.uid);
      console.log("[Auth] Xác thực với Firebase thành công.");
      return result.user;
    } catch (error: any) {
      console.error("[Auth] Lỗi chi tiết:", error.code, error.message);
      
      // Mapping lỗi Firebase/Google Sign-In
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error("SIGN_IN_CANCELLED: Bạn đã đóng cửa sổ đăng nhập.");
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error("NETWORK_ERROR: Lỗi kết nối mạng khi xác thực.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        throw new Error("DEVELOPER_ERROR: Quá nhiều yêu cầu popup cùng lúc.");
      } else if (error.message?.includes("TIMEOUT")) {
        throw new Error("TIMEOUT: Phản hồi từ Google quá chậm, vui lòng thử lại.");
      }
      
      throw error;
    }
  },

  loginAsAdmin: () => {
    console.log("[Auth] Kích hoạt Chế độ Admin (Debug)...");
    const adminUser = {
      uid: 'admin-debug-id',
      displayName: 'Admin Quang (Debug)',
      email: 'quang.admin@manicash.dev',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
    };
    mockUser = adminUser;
    localStorage.setItem('manicash_mock_user', JSON.stringify(adminUser));
    if (authChangeCallback) authChangeCallback(adminUser);
  },

  logout: async () => {
    console.log("[Auth] Đang đăng xuất...");
    localStorage.removeItem('manicash_mock_user');
    mockUser = null;
    
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("[Auth] Lỗi khi đăng xuất Firebase:", e);
      }
    }

    if (authChangeCallback) {
        authChangeCallback(null);
    }

    window.location.href = window.location.origin + window.location.pathname;
  },

  onAuthChange: (callback: (user: any) => void) => {
    authChangeCallback = callback;
    
    if (mockUser) {
      setTimeout(() => callback(mockUser), 50);
      return () => { authChangeCallback = null; };
    }

    if (!auth) {
      setTimeout(() => callback(null), 10);
      return () => { authChangeCallback = null; };
    }
    
    return onAuthStateChanged(auth, (user) => {
      if (!mockUser) callback(user);
    });
  }
};
