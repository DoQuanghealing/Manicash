/* ═══ AuthProvider — Firebase onAuthStateChanged listener ═══ */
'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { onAuthStateChanged, fetchUserProfile } from '@/lib/firebase/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setFirebaseUser, setUserProfile, setLoading, isDemoMode } = useAuthStore();

  useEffect(() => {
    // Skip Firebase auth listener when in demo mode
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      // Double-check demo mode hasn't been set while listener was pending
      if (useAuthStore.getState().isDemoMode) return;

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
  }, [setFirebaseUser, setUserProfile, setLoading, isDemoMode]);

  return <>{children}</>;
}

