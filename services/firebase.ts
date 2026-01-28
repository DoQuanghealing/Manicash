import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // BỔ SUNG: Để lưu dữ liệu ví

// SỬA TẠI ĐÂY: Ánh xạ trực tiếp từ Environment Variables đã cấu hình
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let auth: any = null;
let db: any = null; // BỔ SUNG: Khai báo database
let isConfigured = false;

try {
  // Kiểm tra xem Key đã được nạp từ hệ thống chưa
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_")) {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app); // Khởi tạo Firestore
    isConfigured = true;
  }
} catch (error) {
  console.error("Lỗi cấu hình Firebase:", error);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// XUẤT CÁC BIẾN: Để các file khác (StorageService) có thể dùng chung
export { auth, db }; 

export const AuthService = {
  isConfigured: () => isConfigured,

  loginWithGoogle: async () => {
    if (!auth) throw new Error("Hệ thống chưa nhận diện được API Key trên Vercel.");
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
    window.location.href = window.location.origin + window.location.pathname;
  },

  onAuthChange: (callback: (user: any) => void) => {
    if (!auth) {
      setTimeout(() => callback(null), 10);
      return () => {};
    }
    return onAuthStateChanged(auth, (user) => callback(user));
  }
};
