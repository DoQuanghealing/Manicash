import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Thêm Firestore để lưu dữ liệu riêng

const firebaseConfig = {
  // Sử dụng import.meta.env để bảo mật và linh hoạt
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let auth: any = null;
let db: any = null;
let isConfigured = false;

try {
  // Kiểm tra xem biến môi trường đã được nạp chưa
  if (firebaseConfig.apiKey) {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isConfigured = true;
  } else {
    console.warn("Manicash: Firebase API Key is missing. Check your .env or Vercel settings.");
  }
} catch (error) {
  console.error("Lỗi cấu hình Firebase:", error);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export { db }; // Export database để dùng lưu dữ liệu riêng
export const AuthService = {
  isConfigured: () => isConfigured,

  loginWithGoogle: async () => {
    if (!auth) throw new Error("Firebase chưa được cấu hình.");
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: any) {
      console.error("Lỗi đăng nhập Google:", error);
      throw error;
    }
  },

  logout: async () => {
    if (auth) await signOut(auth);
    // Thay vì reload, nên để App tự cập nhật qua onAuthChange
  },

  onAuthChange: (callback: (user: FirebaseUser | null) => void) => {
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  }
};
