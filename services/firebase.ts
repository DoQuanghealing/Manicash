import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// Cấu hình lấy từ biến môi trường của Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Khởi tạo Firebase an toàn để tránh lỗi khởi tạo nhiều lần trong môi trường Dev
let auth: any = null;
try {
  // Chỉ khởi tạo nếu có apiKey để tránh crash app khi chưa nạp Secret
  if (firebaseConfig.apiKey) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase Init Error:", error);
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const AuthService = {
  isConfigured: () => !!auth,

  loginWithGoogle: async () => {
    if (!auth) {
      console.error("Cấu hình Firebase thiếu VITE_FIREBASE_API_KEY");
      throw new Error("Hệ thống đăng nhập chưa sẵn sàng. Vui lòng thử lại sau.");
    }
    
    if (!navigator.onLine) throw new Error("Không có kết nối internet.");

    // Cơ chế chống treo Popup
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 25000) // Tăng lên 25s cho mạng yếu
    );

    try {
      const loginPromise = signInWithPopup(auth, provider);
      const result: any = await Promise.race([loginPromise, timeout]);
      return result.user as User;
    } catch (error: any) {
      if (error.message === "TIMEOUT") throw new Error("Phản hồi từ Google quá chậm.");
      if (error.code === 'auth/popup-closed-by-user') throw new Error("Bạn đã đóng cửa sổ đăng nhập.");
      if (error.code === 'auth/network-request-failed') throw new Error("Lỗi kết nối mạng khi xác thực.");
      throw error;
    }
  },

  logout: async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Lỗi đăng xuất:", error);
      }
    }
  },

  onAuthChange: (callback: (user: User | null) => void) => {
    if (!auth) {
      callback(null);
      return () => {};
    }
    // Trả về hàm unsubscribe để dọn dẹp bộ nhớ trong React
    return onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  }
};
