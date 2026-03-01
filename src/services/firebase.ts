import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  Auth
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  collection,
  addDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey) {
  throw new Error("Firebase ENV chưa được cấu hình.");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const AuthService = {
  getDb: (): Firestore => db,
  getAuth: (): Auth => auth,

  loginWithGoogle: async () => {
    if (!navigator.onLine) {
      throw new Error("Không có kết nối mạng.");
    }
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  logout: async () => {
    await signOut(auth);
    window.location.reload();
  },

  onAuthChange: (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  },

  checkAppVersion: async (): Promise<string | null> => {
    try {
      const docRef = doc(db, "system_settings", "app_info");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().latest_version || null;
      }
    } catch (e) {
      console.error("Lỗi kiểm tra phiên bản:", e);
    }
    return null;
  },

  logFeatureRequest: async (featureId: string, userEmail: string) => {
    try {
      await addDoc(collection(db, "feature_requests"), {
        featureId,
        userEmail,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (e) {
      console.error("Error logging feature request:", e);
      return false;
    }
  }
};
