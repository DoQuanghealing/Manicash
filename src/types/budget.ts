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
