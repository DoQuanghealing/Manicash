import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, Auth } from "firebase/auth";
import { getFirestore, Firestore, doc, getDoc, collection, addDoc } from "firebase/firestore";

// Tự động lấy cấu hình từ môi trường Vercel/GitHub
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isConfigured = false;

const initFirebase = () => {
  try {
    if (getApps().length > 0) {
      app = getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      isConfigured = true;
      return true;
    }

    // Chỉ khởi tạo khi có API Key hợp lệ
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      isConfigured = true;
      return true;
    }
  } catch (error) {
    console.warn("[Firebase Init] Quản gia đang chạy chế độ Offline do cấu hình lỗi.");
  }
  return false;
};

// Khởi tạo ngay lập tức
initFirebase();

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let authChangeCallback: ((user: any) => void) | null = null;

export const AuthService = {
  isConfigured: () => isConfigured,
  
  getDb: () => {
    if (!isConfigured) return null;
    if (!db) initFirebase();
    return db;
  },

  getAuth: () => {
    if (!isConfigured) return null;
    if (!auth) initFirebase();
    return auth;
  },

  checkPreConditions: () => {
    if (!isConfigured) throw new Error("Thưa cậu chủ, Firebase chưa được cấu hình.");
    if (!navigator.onLine) {
      throw new Error("Lỗi mạng: Quản gia không thể liên lạc với máy chủ.");
    }
    return true;
  },

  loginWithGoogle: async () => {
    const currentAuth = AuthService.getAuth();
    if (!currentAuth) throw new Error("Lỗi cấu hình: Thiếu API Key.");
    AuthService.checkPreConditions();
    const result: any = await signInWithPopup(currentAuth, provider);
    return result.user;
  },

  loginGuest: async () => {
    const guestUser = {
      uid: "guest_user_demo",
      email: "demo@manicash.io",
      displayName: "Cậu chủ Trải nghiệm",
      photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Demo"
    };
    if (authChangeCallback) authChangeCallback(guestUser);
    return guestUser;
  },

  logout: async () => {
    const currentAuth = AuthService.getAuth();
    if (currentAuth) await signOut(currentAuth);
    if (authChangeCallback) authChangeCallback(null);
    window.location.reload();
  },

  onAuthChange: (callback: (user: any) => void) => {
    authChangeCallback = callback;
    const currentAuth = AuthService.getAuth();
    
    if (!currentAuth) {
      const timer = setTimeout(() => {
        if (authChangeCallback) callback(null);
      }, 500); 
      return () => { 
        clearTimeout(timer);
        authChangeCallback = null; 
      };
    }

    return onAuthStateChanged(currentAuth, (user) => {
      callback(user);
    });
  },

  // Hệ thống kiểm tra phiên bản
  checkAppVersion: async (): Promise<string | null> => {
    const database = AuthService.getDb();
    if (!database) return null;
    try {
      const docRef = doc(database, "system_settings", "app_info");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().latest_version || null;
      }
    } catch (e) {
      console.error("Quản gia không check được version:", e);
    }
    return null;
  },

  // Hệ thống log hành vi để AI phân tích
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
    } catch (e) {
      console.error("Lỗi log hành vi:", e);
      return false;
    }
  },

  // Log yêu cầu tính năng mới
  logFeatureRequest: async (featureId: string, userEmail: string) => {
    const database = AuthService.getDb();
    if (!database) return false;
    try {
      await addDoc(collection(database, "feature_requests"), {
        featureId,
        userEmail,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (e) {
      console.error("Lỗi log feature request:", e);
      return false;
    }
  }
};
