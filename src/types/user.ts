/* ═══ User Types ═══ */

export type UserRank = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond';

export type SubscriptionPlan = 'free' | 'premium';

/** Tier cho feature gating mới (vd SMS Webhook). Hiện chưa enforce — xem utils/proGating.ts. */
export type UserTier = 'free' | 'pro';

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
  /** Pro tier — optional, default 'free' khi đọc. Enforce ở proGating.ts. */
  tier?: UserTier;
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
