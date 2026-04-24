/* ═══ Sign Out Helper — Clears Firebase + Session Cookie ═══ */
'use client';

import { signOut as firebaseSignOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useSignOut() {
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    try {
      // Clear session cookie
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });

      // Sign out from Firebase
      await firebaseSignOut();

      // Clear Zustand store
      logout();

      // Redirect to login
      router.push('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, [logout, router]);

  return { handleSignOut };
}
