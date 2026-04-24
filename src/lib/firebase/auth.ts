/* ═══ Firebase Auth Helpers ═══ */
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDB } from './config';
import type { UserProfile } from '@/types/user';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(result.user);
  return result.user;
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
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
    premiumExpiresAt: data.premiumExpiresAt || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || '',
  };
}
