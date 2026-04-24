/* ═══ Budget & Wallet Types — Three-Bucket System ═══ */

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

/** Snapshot tài chính theo tháng — dùng cho rollover */
export interface MonthlySnapshot {
  month: string; // 'YYYY-MM'
  incomeTotal: number;
  expenseTotal: number;
  savingTotal: number;
  carryOver: number; // Dư tháng trước chuyển sang
  budgetLimits: CategoryBudget[];
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
