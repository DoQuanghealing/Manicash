/* ═══ Firebase Auth Helpers ═══ */
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { getFirebaseAuth, getFirebaseDB } from './config';
import { usernameToEmail } from '@/lib/auth/usernameEmail';
import type { UserProfile } from '@/types/user';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google.
 * - Web: signInWithPopup (flow hiện tại).
 * - Native (Capacitor WebView): signInWithPopup bị block → dùng plugin native
 *   lấy Google credential rồi đăng nhập JS SDK qua signInWithCredential.
 *   capacitor.config đặt skipNativeAuth=true nên chỉ JS SDK giữ session →
 *   Firestore (JS SDK) hoạt động bình thường, không cần sync 2 lớp.
 */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  let user: User;

  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error('NATIVE_GOOGLE_NO_ID_TOKEN');
    const credential = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, credential);
    user = userCred.user;
  } else {
    const result = await signInWithPopup(auth, googleProvider);
    user = result.user;
  }

  await ensureUserDocument(user);
  return user;
}

/**
 * Đăng nhập bằng ID (username) + mật khẩu — cho tài khoản TEST do admin tạo.
 * username → email ẩn → signInWithEmailAndPassword. Không cần kích hoạt email.
 */
export async function signInWithUsernamePassword(username: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const email = usernameToEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(cred.user);
  return cred.user;
}

/**
 * Sign out — native cần sign out cả lớp plugin trước khi sign out JS SDK.
 */
export async function signOut(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  }
  await firebaseSignOut(getFirebaseAuth());
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChanged(
  callback: (user: User | null) => void
): Unsubscribe {
  const auth = getFirebaseAuth();
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Create/update user document in Firestore on first login
 */
async function ensureUserDocument(user: User): Promise<void> {
  const db = getFirebaseDB();
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newUser: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: user.uid,
      displayName: user.displayName || 'Chiến binh tài chính',
      email: user.email || '',
      photoURL: user.photoURL,
      rank: 'iron',
      xp: 0,
      streak: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
      resistCount: 0,
      totalResistSaved: 0,
      isPremium: false,
      plan: 'free',
      premiumExpiresAt: null,
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, newUser);
  } else {
    // Update last login info
    await setDoc(
      userRef,
      {
        displayName: user.displayName || userSnap.data().displayName,
        photoURL: user.photoURL || userSnap.data().photoURL,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

/**
 * Fetch user profile from Firestore
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseDB();
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    uid: data.uid,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL,
    rank: data.rank || 'iron',
    xp: data.xp || 0,
    streak: data.streak || 0,
    lastActiveDate: data.lastActiveDate || '',
    resistCount: data.resistCount || 0,
    totalResistSaved: data.totalResistSaved || 0,
    isPremium: data.isPremium || false,
    plan: data.plan || 'free',
    tier: data.tier || 'free',
    premiumExpiresAt: data.premiumExpiresAt?.toDate?.()?.toISOString?.() || data.premiumExpiresAt || null,
    accountStatus: data.accountStatus || 'active',
    deletionRequestedAt: data.deletionRequestedAt?.toDate?.()?.toISOString?.() || data.deletionRequestedAt,
    deletionScheduledAt: data.deletionScheduledAt?.toDate?.()?.toISOString?.() || data.deletionScheduledAt,
    deletionCancelledAt: data.deletionCancelledAt?.toDate?.()?.toISOString?.() || data.deletionCancelledAt,
    deletionReason: data.deletionReason,
    deletionMode: data.deletionMode,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || '',
  };
}
