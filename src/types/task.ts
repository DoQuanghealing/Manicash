/* ═══ Task Types — Earning Task System + Sub-tasks ═══ */

/** Trạng thái nhiệm vụ kiếm tiền */
export type TaskStatus = 'pending' | 'active' | 'completed' | 'overdue';

/** Lý do xóa task trễ */
export type OverdueReason = 'not_relevant' | 'postponed' | 'plan_changed';

/** Sub-task / checklist item */
export interface SubTask {
  id: string;
  name: string;
  isCompleted: boolean;
}

/** Nhiệm vụ kiếm tiền */
export interface EarningTask {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount?: number;
  startDate: string;  // ISO date
  endDate: string;    // ISO date
  completedAt?: string;
  deletedAt?: string;
  deleteReason?: OverdueReason;
  subTasks: SubTask[];
  createdAt: string;
}

/** XP penalty từ trễ hạn */
export interface XPPenalty {
  taskId: string;
  penaltyMultiplier: number; // e.g. 0.7 = giảm 30%
  remainingTasks: number;    // Áp dụng cho N nhiệm vụ kế tiếp
}

/** Override reason labels */
export const OVERDUE_REASON_LABELS: Record<OverdueReason, string> = {
  not_relevant: 'Không còn phù hợp',
  postponed: 'Hoãn lại',
  plan_changed: 'Đã thay đổi kế hoạch',
};

/** XP Formula: (amount × 0.001) + (subTasks × 10) */
export function calculateTaskXP(amount: number, subTaskCount: number): number {
  return Math.round(amount * 0.001) + (subTaskCount * 10);
}
