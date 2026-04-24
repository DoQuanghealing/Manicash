/* ═══ Auth Store — Zustand ═══ */
'use client';

import { create } from 'zustand';
import type { UserProfile, FirebaseUserMinimal } from '@/types/user';

interface AuthStore {
  user: UserProfile | null;
  firebaseUser: FirebaseUserMinimal | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;

  setFirebaseUser: (user: FirebaseUserMinimal | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setDemoMode: (isDemo: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  isDemoMode: false,

  setFirebaseUser: (firebaseUser) =>
    set({
      firebaseUser,
      isAuthenticated: !!firebaseUser,
    }),

  setUserProfile: (user) =>
    set({ user }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setDemoMode: (isDemoMode) =>
    set({ isDemoMode }),

  logout: () =>
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: false,
      isDemoMode: false,
    }),
}));
