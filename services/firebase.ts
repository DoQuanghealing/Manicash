
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
  console.error("Lỗi cấu hình Firebase:", error);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let authChangeCallback: ((user: any) => void) | null = null;

export const AuthService = {
  isConfigured: () => isConfigured,

  loginWithGoogle: async () => {
    if (!auth) {
      throw new Error("Firebase chưa được cấu hình.");
    }
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: any) {
      console.error("Lỗi đăng nhập Google:", error);
      throw error;
    }
  },

  logout: async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Lỗi khi đăng xuất Firebase:", e);
      }
    }

    if (authChangeCallback) {
        authChangeCallback(null);
    }

    // Force reload để đảm bảo trạng thái ứng dụng được reset hoàn toàn
    window.location.href = window.location.origin + window.location.pathname;
  },

  onAuthChange: (callback: (user: any) => void) => {
    authChangeCallback = callback;
    
    if (!auth) {
      // Nếu Firebase chưa cấu hình, mặc định trả về null ngay lập tức
      setTimeout(() => callback(null), 10);
      return () => { authChangeCallback = null; };
    }
    
    return onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  }
};
