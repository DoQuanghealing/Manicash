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
  /** ISO timestamp của lần resist gần nhất — dùng cho daily quest counter. */
  lastResistAt?: string;
  /** Lưu YYYY-MM-DD → count resist trong ngày đó. Giới hạn last 30 ngày. */
  resistByDate?: Record<string, number>;
  /** Số shield đang giữ — protect streak khi bỏ lỡ 1 ngày. Tự tăng mỗi mốc 7-day streak. */
  streakShields?: number;
  /** Lịch sử dùng shield — ISO timestamp, để UI hiện toast. */
  shieldsUsedAt?: string[];
  isPremium: boolean;
  plan: SubscriptionPlan;
  /** Pro tier — optional, default 'free' khi đọc. Enforce ở proGating.ts. */
  tier?: UserTier;
  premiumExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Năm sinh user (optional). Dùng cho rule gợi ý theo độ tuổi sau này. */
  yearOfBirth?: number;
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
