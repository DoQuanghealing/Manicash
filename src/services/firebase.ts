import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, Auth } from "firebase/auth";
import { getFirestore, Firestore, doc, getDoc, collection, addDoc } from "firebase/firestore";

// Tự động lấy cấu hình từ biến môi trường Vite (.env) hoặc dán trực tiếp
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSy...", // Dán API Key thật của Quả Dâu vào đây
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "manicash-xxx.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "manicash-xxx",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "manicash-xxx.appspot.com",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "xxx",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "xxx"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isConfigured = false;

const initFirebase = () => {
  try {
    if (getApps().length > 0) {
      app = getApp();
    } else {
      // Chỉ khởi tạo nếu apiKey không phải là chuỗi rỗng hoặc mặc định
      if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
        app = initializeApp(firebaseConfig);
      }
    }

    if (app) {
      auth = getAuth(app);
      db = getFirestore(app);
      isConfigured = true;
      return true;
    }
  } catch (error) {
    console.error("[Firebase Init Error]:", error);
  }
  return false;
};

initFirebase();

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const AuthService = {
  isConfigured: () => isConfigured,
  
  getDb: () => {
    if (!db) initFirebase();
    return db;
  },

  getAuth: () => {
    if (!auth) initFirebase();
    return auth;
  },

  checkPreConditions: () => {
    if (!isConfigured) {
        throw new Error("CONFIGURATION_ERROR: Firebase chưa được cấu hình. Hãy kiểm tra API Key trong file firebase.ts.");
    }
    if (!navigator.onLine) {
      throw new Error("NETWORK_ERROR: Không có kết nối mạng.");
    }
    return true;
  },

  // Đăng nhập Google chính thống
  loginWithGoogle: async () => {
    AuthService.checkPreConditions();
    const currentAuth = AuthService.getAuth();
    if (!currentAuth) throw new Error("Auth service không khả dụng.");
    
    const result = await signInWithPopup(currentAuth, provider);
    return result.user;
  },

  // Đã gỡ bỏ loginGuest để bảo mật dữ liệu thật
  
  logout: async () => {
    const currentAuth = AuthService.getAuth();
    if (currentAuth) await signOut(currentAuth);
    window.location.reload();
  },

  onAuthChange: (callback: (user: any) => void) => {
    const currentAuth = AuthService.getAuth();
    if (!currentAuth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(currentAuth, (user) => {
      callback(user);
    });
  },

  // Các hàm log hành vi và dữ liệu cho Lord Diamond
  logFutureLead: async (tag: string, userEmail: string, userId: string) => {
    const database = AuthService.getDb();
    if (!database) return false;
    try {
      await addDoc(collection(database, "future_leads"), {
        topic: tag,
        email: userEmail,
        userId: userId,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (e) { return false; }
  },

  logBehavior: async (action: string, details: any, userEmail: string, userId: string) => {
    const database = AuthService.getDb();
    if (!database) return false;
    try {
      await addDoc(collection(database, "behavior_logs"), {
        action,
        details,
        email: userEmail,
        userId: userId,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (e) { return false; }
  }
};
