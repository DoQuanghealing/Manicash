/* ═══ Nhận tiền nhiệm vụ — khép vòng Việc → Tiền (Đợt 1) ═══
 * MỘT đường duy nhất cho cả UI (hộp "Nhận được bao nhiêu?") lẫn chat (COMPLETE_EARNING_TASK):
 *   tạo giao dịch thu thật → đánh dấu task đã nhận tiền (+ XP 1 lần) → emit popup thu nhập.
 * Trả kèm `undo` chụp CHÍNH XÁC trạng thái trước để hoàn tác: xoá đúng giao dịch, trả XP/streak,
 * khôi phục checklist + penalty + giai đoạn cũ.
 */
'use client';

import { useTaskStore } from '@/stores/useTaskStore';
import { useFinanceStore, type PaymentMethod, type Transaction, type WalletType } from '@/stores/useFinanceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { emitMoneyRecorded } from '@/lib/moneyEvents';
import { getTaskStage, type EarningTask, type SubTask, type TaskStage, type XPPenalty } from '@/types/task';
import { getEarningTemplate } from '@/data/earningTemplates';
import type { UserProgressSnapshot } from '@/stores/useAuthStore';

/** Danh mục thu mặc định khi task không đến từ mẫu. */
export const DEFAULT_TASK_INCOME_CATEGORY = 'freelance';

export interface ReceiveTaskPaymentInput {
  taskId: string;
  /** Số tiền thực nhận (đ). 0 = khép task không ghi giao dịch (vd. làm không công). */
  amount: number;
  wallet?: WalletType;
  method?: PaymentMethod;
  categoryId?: string;
  /** Ngày nhận — lùi tối đa 30 ngày (luật của addTransaction). Mặc định bây giờ. */
  receivedAt?: Date;
}

export interface ReceiveTaskPaymentUndo {
  taskId: string;
  transactionId?: string;
  stage: TaskStage;
  actualAmount?: number;
  /** Thiếu (bản ghi undo cũ) → giữ checklist/penalty hiện tại. */
  subTasks?: SubTask[];
  xpPenalties?: XPPenalty[];
  userProgress: UserProgressSnapshot | null;
}

export type ReceiveTaskPaymentResult =
  | { ok: true; task: EarningTask; transaction?: Transaction; undo: ReceiveTaskPaymentUndo }
  | { ok: false; message: string };

function captureUserProgress(): UserProgressSnapshot | null {
  const u = useAuthStore.getState().user;
  if (!u) return null;
  return {
    xp: u.xp,
    rank: u.rank,
    streak: u.streak,
    streakShields: u.streakShields ?? 0,
    shieldsUsedAt: u.shieldsUsedAt,
    lastActiveDate: u.lastActiveDate,
  };
}

/** Danh mục thu cho task: theo mẫu gốc nếu có, không thì freelance. */
export function incomeCategoryForTask(task: Pick<EarningTask, 'templateId'>): string {
  const tpl = task.templateId ? getEarningTemplate(task.templateId) : undefined;
  return tpl?.incomeCategory ?? DEFAULT_TASK_INCOME_CATEGORY;
}

export function receiveTaskPayment(input: ReceiveTaskPaymentInput): ReceiveTaskPaymentResult {
  const task = useTaskStore.getState().tasks.find((t) => t.id === input.taskId);
  if (!task) return { ok: false, message: 'Không tìm thấy nhiệm vụ (dữ liệu đã thay đổi).' };
  if (task.deletedAt) return { ok: false, message: 'Nhiệm vụ này đã bị xóa.' };
  if (task.completedAt) return { ok: false, message: `Nhiệm vụ ${task.name} đã ghi nhận tiền trước đó rồi.` };
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: 'Số tiền không hợp lệ.' };

  const undo: ReceiveTaskPaymentUndo = {
    taskId: task.id,
    stage: getTaskStage(task),
    actualAmount: task.actualAmount,
    subTasks: task.subTasks.map((s) => ({ ...s })),
    xpPenalties: useTaskStore.getState().xpPenalties.map((p) => ({ ...p })),
    userProgress: captureUserProgress(),
  };

  let transaction: Transaction | undefined;
  if (amount > 0) {
    try {
      transaction = useFinanceStore.getState().addTransaction({
        type: 'income',
        amount,
        categoryId: input.categoryId || incomeCategoryForTask(task),
        note: `Nhiệm vụ: ${task.name}`,
        wallet: input.wallet ?? 'main',
        method: input.method,
        transactionDate: input.receivedAt,
      });
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Không ghi được giao dịch thu.' };
    }
    undo.transactionId = transaction.id;
  }

  const done = useTaskStore.getState().completeTask(task.id, amount, {
    incomeTxnId: transaction?.id,
    // Ngày nhận do người dùng chọn (có thể lùi) — để thẻ/CFO khớp ngày của giao dịch ở Sổ sách.
    receivedAt: transaction ? new Date(transaction.date) : input.receivedAt,
  });
  if (!done) {
    // Không thể xảy ra sau các kiểm tra trên, nhưng nếu có thì đừng để giao dịch mồ côi.
    if (transaction) useFinanceStore.getState().removeTransaction(transaction.id);
    if (undo.userProgress) useAuthStore.getState().restoreProgress(undo.userProgress);
    return { ok: false, message: 'Không ghi nhận được nhiệm vụ, vui lòng thử lại.' };
  }

  if (transaction) {
    emitMoneyRecorded({ type: 'income', amount, categoryId: transaction.categoryId, transactionId: transaction.id });
  }

  const updated = useTaskStore.getState().tasks.find((t) => t.id === task.id) ?? task;
  return { ok: true, task: updated, transaction, undo };
}

/** Hoàn tác `receiveTaskPayment`. false = dữ liệu đã đổi, không hoàn tác an toàn được. */
export function undoReceiveTaskPayment(undo: ReceiveTaskPaymentUndo): boolean {
  const task = useTaskStore.getState().tasks.find((t) => t.id === undo.taskId);
  if (!task || !task.completedAt) return false;
  // Task đã được nhận tiền lại bằng giao dịch KHÁC (nhiều tab / sync) → undo cũ không còn đúng,
  // làm tiếp sẽ để mồ côi giao dịch mới và lần nhận sau thành thu 2 lần.
  if ((task.incomeTxnId ?? undefined) !== (undo.transactionId ?? undefined)) return false;
  if (undo.transactionId) useFinanceStore.getState().removeTransaction(undo.transactionId);
  useTaskStore.getState().undoCompleteTask(undo.taskId, {
    actualAmount: undo.actualAmount,
    subTasks: undo.subTasks,
    xpPenalties: undo.xpPenalties,
    stage: undo.stage,
  });
  if (undo.userProgress) useAuthStore.getState().restoreProgress(undo.userProgress);
  return true;
}

/** Tổng khách còn nợ: cộng số kỳ vọng các việc đang Chờ thanh toán. */
export function getOutstandingSummary(tasks: EarningTask[]): { amount: number; count: number } {
  let amount = 0;
  let count = 0;
  for (const t of tasks) {
    if (t.deletedAt || getTaskStage(t) !== 'awaiting_payment') continue;
    amount += Math.max(0, t.expectedAmount || 0);
    count += 1;
  }
  return { amount, count };
}

/** "YYYY-MM-DD" → ngày theo giờ MÁY (new Date("YYYY-MM-DD") là UTC → lệch 1 ngày ở múi giờ âm).
 * Chuỗi ISO đầy đủ thì parse bình thường. */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Số ngày khách trễ hẹn trả (0 nếu chưa trễ / không hẹn). So theo ngày lịch địa phương. */
export function getPaymentLateDays(task: Pick<EarningTask, 'stage' | 'completedAt' | 'paymentDueDate'>, now: Date = new Date()): number {
  if (getTaskStage(task) !== 'awaiting_payment' || !task.paymentDueDate) return 0;
  const due = parseLocalDate(task.paymentDueDate);
  if (!due) return 0;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((today - dueDay) / 86_400_000));
}
