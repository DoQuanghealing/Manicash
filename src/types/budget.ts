/* ═══ Budget & Wallet Types — Three-Bucket System ═══ */

import type { HealthTier } from '@/lib/cfoHealthScore';

/** Ba ví chính */
export type BucketType = 'income' | 'expense' | 'saving';

/** Phân ngăn chi tiêu */
export type ExpenseSubBucket = 'bills' | 'daily';

/** Ngân sách theo danh mục mỗi tháng */
export interface CategoryBudget {
  categoryId: string;
  monthlyLimit: number;
  spent: number;
  month: string; // 'YYYY-MM'
}

/** Báo cáo butler cuối tháng — generated tại checkAndRollover. */
export interface ButlerReport {
  summary: string;          // 2-3 câu tổng hợp + khích lệ
  xpEarned: number;         // Số XP grant trong tháng (delta)
  tier: HealthTier;         // Tier cảnh sức khỏe tháng
  generatedAt: string;      // ISO timestamp
  metrics: {
    transactionCount: number;
    billsPaidOnTime: number;
    billsTotal: number;
    categoriesOnTrack: number;
    categoriesTotal: number;
    surplus: number;        // income - expense (≥ 0; nếu âm → 0)
  };
}

/** Snapshot tài chính theo tháng — dùng cho rollover */
export interface MonthlySnapshot {
  month: string; // 'YYYY-MM'
  incomeTotal: number;
  expenseTotal: number;
  savingTotal: number;
  carryOver: number; // Dư tháng trước chuyển sang
  budgetLimits: CategoryBudget[];
  butlerReport?: ButlerReport;
}

/** Nguồn nạp tiền vào mục tiêu. */
export type GoalDepositSource =
  | 'main'           // Tài khoản chính (thu nhập)
  | 'reserve'        // Quỹ dự phòng
  | 'goals-fund'     // Quỹ mục tiêu chung (chia từ overview)
  | 'bank'           // Tài khoản ngân hàng linked
  | 'manual';        // Manual entry (cash, gift...)

export interface GoalDeposit {
  id: string;
  amount: number;
  source: GoalDepositSource;
  note?: string;
  createdAt: string; // ISO
}

/** Thông tin tài khoản ngân hàng liên kết với mục tiêu lớn. */
export interface GoalBankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder?: string;
  /** Số dư khai báo lúc liên kết — để đối chiếu với currentAmount. */
  declaredBalance: number;
  linkedAt: string;
}

/** Mục tiêu tài chính */
export interface Goal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO date or year string
  color: string;
  milestones: Milestone[];
  createdAt: string;
  /** Lịch sử nạp — append-only. */
  deposits?: GoalDeposit[];
  /** Tài khoản ngân hàng liên kết (gợi ý khi targetAmount > 100M). */
  bankInfo?: GoalBankInfo;
  /** Ảnh dán "ngôi nhà mơ ước" — data URL compressed. */
  photoUrl?: string;
  /** Lý do user muốn đạt — hiển thị khi yếu lòng. */
  whyNote?: string;
  /** % milestone cuối cùng đã hiện confetti (25/50/75/100). Tránh retrigger. */
  lastCelebratedMilestone?: 25 | 50 | 75 | 100;
}

/** Mốc nhỏ trong mục tiêu */
export interface Milestone {
  id: string;
  name: string;
  amount: number;
  targetDate: string; // ISO date
  isCompleted: boolean;
  completedAt?: string;
}
