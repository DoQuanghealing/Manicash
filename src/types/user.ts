/* ═══ User Types ═══ */

export type UserRank = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond';

export type SubscriptionPlan = 'free' | 'premium';

/** Tier cho feature gating mới (vd SMS Webhook). Hiện chưa enforce — xem utils/proGating.ts. */
export type UserTier = 'free' | 'pro';

/** Nguồn cấp Pro. Nguồn-sự-thật cho phân loại admin lấy từ grant_events (append-only),
 * field này chỉ phản ánh lần cấp gần nhất. */
export type BillingProvider = 'google_play' | 'mock' | 'payos' | 'trial' | 'admin';

export type AccountStatus = 'active' | 'pending_deletion' | 'deleted';

export interface AccountDeletionState {
  accountStatus?: AccountStatus;
  deletionRequestedAt?: string;
  deletionScheduledAt?: string;
  deletionCancelledAt?: string;
  deletionReason?: string;
  deletionMode?: 'grace_30d' | 'immediate';
}

export interface UserProfile extends AccountDeletionState {
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
  /** Nguồn cấp Pro gần nhất (payos/trial/admin/...). Set bởi Admin SDK. */
  billingProvider?: BillingProvider;
  /** Các orderId đã áp (idempotency). Set bởi Admin SDK. */
  billingOrderIds?: string[];
  /** ISO — thời điểm kích hoạt dùng thử. KHÔNG bao giờ xóa → chặn trial 1 lần/đời. */
  trialUsedAt?: string;
  /** SĐT user tự nhập / từ buyerPhone PayOS (consent). */
  phone?: string;
  /** Username đăng nhập ID/mật khẩu (tài khoản test admin tạo). */
  username?: string;
  /** Tài khoản test do admin tạo (cho bạn bè xem app) — KHÔNG mua, dễ dọn dẹp. */
  isTestAccount?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Năm sinh user (optional). Dùng cho rule gợi ý theo độ tuổi sau này. */
  yearOfBirth?: number;
  /** Ngày sinh đầy đủ YYYY-MM-DD (optional). Phục vụ Bát Tự, mệnh, sinh nhật. */
  birthDate?: string;
  /** Giờ sinh HH:mm (optional, dùng cho Bát Tự / Tử Vi). */
  birthTime?: string;
  /** Đồng ý đóng góp dữ liệu ẩn danh cho R&D (metric_snapshots). Mặc định KHÔNG.
   *  Dữ liệu nhạy cảm (Nghị định 13/2023) — không snapshot khi field này !== true. */
  analyticsConsent?: boolean;
  /** ISO — thời điểm user bật/tắt analyticsConsent gần nhất. */
  analyticsConsentAt?: string;
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
