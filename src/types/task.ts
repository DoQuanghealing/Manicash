/* ═══ Task Types — Earning Task System + Sub-tasks ═══ */

/** Trạng thái nhiệm vụ kiếm tiền */
export type TaskStatus = 'pending' | 'active' | 'completed' | 'overdue';

/** Giai đoạn của vòng việc → tiền (v2).
 * doing = đang làm · awaiting_payment = xong việc, chờ khách trả · paid = đã nhận tiền.
 * Thiếu (dữ liệu v1 / máy cũ đồng bộ lên) → suy từ completedAt, xem `getTaskStage`. */
export type TaskStage = 'doing' | 'awaiting_payment' | 'paid';

/** Lý do xóa task trễ */
export type OverdueReason = 'not_relevant' | 'postponed' | 'plan_changed';

/** Sub-task / checklist item */
export interface SubTask {
  id: string;
  name: string;
  isCompleted: boolean;
  /** ISO timestamp khi sub-task chuyển sang true. Undefined nếu chưa bao giờ tick. */
  completedAt?: string;
}

/** Kết quả AI thẩm định nhiệm vụ, cache NGAY TRÊN task (T5).
 * hash = dấu vân của (tên + tiền + subtasks); đổi task → hash đổi → gọi lại AI. */
export interface TaskAiEval {
  hash: string;
  feasibility: number;
  missingSubtasks: string[];
  risks: string[];
  suggestedPriceRange?: { min: number; max: number };
  oneLineCoach: string;
  /** Bản deterministic (LLM lỗi) — không tốn credit. */
  deterministicFallback: boolean;
  /** ISO thời điểm thẩm định. */
  at: string;
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
  /** Cache AI thẩm định (T5) — chỉ có khi user đã bấm "Quản gia thẩm định". */
  aiEval?: TaskAiEval;
  /** v2. 'paid' ⇔ completedAt có giá trị. Optional để dữ liệu v1 vẫn hợp lệ. */
  stage?: TaskStage;
  /** v2. ISO, đổi ở MỌI thao tác sửa → bộ gộp Money Sync chọn đúng bản mới hơn. */
  updatedAt?: string;
  /** v2. Tên khách / người trả tiền. Dữ liệu cá nhân bên thứ ba — KHÔNG đưa vào snapshot/CRM. */
  payerName?: string;
  /** v2. Hẹn ngày khách trả (ISO date). */
  paymentDueDate?: string;
  /** v2. Lúc bấm "Xong việc" (vào Chờ thanh toán). */
  workDoneAt?: string;
  /** v2. id giao dịch thu tạo khi nhận tiền — để hoàn tác xoá đúng giao dịch. */
  incomeTxnId?: string;
  /** v2. Mẫu gốc trong thư viện ý tưởng (`src/data/earningTemplates.ts`). */
  templateId?: string;
}

/** Giai đoạn hiện tại — chịu được dữ liệu v1 thiếu `stage`. */
export function getTaskStage(task: Pick<EarningTask, 'stage' | 'completedAt'>): TaskStage {
  if (task.completedAt) return 'paid';
  return task.stage === 'awaiting_payment' ? 'awaiting_payment' : 'doing';
}

/** Độ dài tối đa tên khách. */
export const PAYER_NAME_MAX = 60;

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
