/* ═══ AuthProvider — Firebase onAuthStateChanged listener ═══ */
'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { onAuthStateChanged, fetchUserProfile } from '@/lib/firebase/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setFirebaseUser, setUserProfile, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });

        // Fetch full profile from Firestore
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          if (profile) {
            setUserProfile(profile);
          }
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
        }
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [setFirebaseUser, setUserProfile, setLoading]);

  return <>{children}</>;
}

