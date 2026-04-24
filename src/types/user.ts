/* ═══ User Types ═══ */

export type UserRank = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond';

export type SubscriptionPlan = 'free' | 'premium';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  rank: UserRank;
  xp: number;
  streak: number;
  lastActiveDate: string;
  resistCount: number;
  totalResistSaved: number;
  isPremium: boolean;
  plan: SubscriptionPlan;
  premiumExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUserMinimal | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface FirebaseUserMinimal {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
