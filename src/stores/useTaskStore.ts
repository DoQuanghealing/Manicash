/* ═══ Task Store — Earning Tasks + Sub-tasks + XP Penalties ═══ */
'use client';

import { create } from 'zustand';
import { simulationAwareStorage } from '@/stores/simulationStorage';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EarningTask, SubTask, TaskStage, TaskStatus, XPPenalty, OverdueReason, TaskAiEval } from '@/types/task';
import { getTaskStage, PAYER_NAME_MAX } from '@/types/task';
import { migrateTasksState } from '@/lib/tasks/migrateTasks';
import { useAuthStore } from '@/stores/useAuthStore';
import { STORE_KEYS, STORE_VERSIONS, onRehydrateMark } from '@/stores/persistConfig';

function genId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanPayer(name: string | undefined): string | undefined {
  const v = (name ?? '').trim().slice(0, PAYER_NAME_MAX);
  return v || undefined;
}

function getTaskStatus(task: EarningTask): TaskStatus {
  if (task.completedAt) return 'completed';
  if (task.deletedAt) return 'completed';
  // Xong việc, chờ khách trả: hạn làm việc không còn ý nghĩa → không bao giờ "trễ"
  // (khách trễ hẹn là lỗi của khách, không phạt người dùng).
  if (getTaskStage(task) === 'awaiting_payment') return 'active';
  const now = new Date();
  const start = new Date(task.startDate);
  const end = new Date(task.endDate);
  if (now < start) return 'pending';
  if (now > end) return 'overdue';
  return 'active';
}

// v1 → v2: xem src/lib/tasks/migrateTasks.ts (module thuần — Money Sync dùng chung khi đọc cloud).
export { migrateTasksState };

type NewTaskInput = Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'>
  & Partial<Pick<EarningTask, 'payerName' | 'paymentDueDate' | 'templateId'>>
  & { subTasks?: Omit<SubTask, 'id' | 'isCompleted'>[] };

interface TaskState {
  tasks: EarningTask[];
  xpPenalties: XPPenalty[];

  addTask: (data: NewTaskInput) => EarningTask;
  updateTask: (id: string, data: Partial<Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate' | 'payerName' | 'paymentDueDate'>>) => void;
  /** T5: cache kết quả AI thẩm định NGAY trên task (đổi task → hash đổi → gọi lại). */
  setTaskAiEval: (id: string, aiEval: TaskAiEval) => void;
  /** v2: xong việc nhưng khách chưa trả → "Chờ thanh toán". Không cộng XP (XP chỉ khi nhận tiền).
   * Trả false nếu task không tồn tại / đã xoá / đã nhận tiền / đang chờ rồi. */
  markWorkDone: (id: string, opts?: { payerName?: string; paymentDueDate?: string }) => boolean;
  /** v2 (undo): đưa task "Chờ thanh toán" về "Đang làm", khôi phục checklist cũ. */
  undoMarkWorkDone: (id: string, before?: { subTasks?: SubTask[] }) => boolean;
  /** Đánh dấu ĐÃ NHẬN TIỀN + cộng XP TASK_COMPLETE. Chỉ ghi task — giao dịch thu do
   * `receiveTaskPayment` tạo rồi truyền `incomeTxnId` vào. Gọi lần 2 trên cùng task → false,
   * không cộng XP lần nữa. */
  completeTask: (id: string, actualAmount: number, opts?: { incomeTxnId?: string; receivedAt?: Date }) => boolean;
  deleteOverdueTask: (id: string, reason: OverdueReason) => void;
  /** Phase 5 (undo): xóa hẳn 1 task (dùng cho undo task vừa tạo). Trả false nếu không thấy. */
  removeTask: (id: string) => boolean;
  /** Phase 5/6A (undo): bỏ trạng thái hoàn thành. Nếu có `before`, khôi phục CHÍNH XÁC
   * actualAmount + subTasks + xpPenalties + stage (penalty đã bị completeTask tiêu hao). XP do caller restore. */
  undoCompleteTask: (id: string, before?: { actualAmount?: number; subTasks?: SubTask[]; xpPenalties?: XPPenalty[]; stage?: TaskStage }) => boolean;
  toggleSubTask: (taskId: string, subTaskId: string) => void;

  getStatus: (task: EarningTask) => TaskStatus;
  getActiveXPMultiplier: () => number;
  getTasksByStatus: (status: TaskStatus) => EarningTask[];
  getTotalEarned: () => number;
  getSubTaskProgress: (taskId: string) => { done: number; total: number };
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
  tasks: [],
  xpPenalties: [],

  addTask: (data) => {
    const { subTasks, payerName, ...rest } = data;
    const now = nowIso();
    const task: EarningTask = {
      ...rest,
      payerName: cleanPayer(payerName),
      id: genId(),
      createdAt: now,
      updatedAt: now,
      stage: 'doing',
      subTasks: (subTasks || []).map((st) => ({ ...st, id: genId('st'), isCompleted: false })),
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  removeTask: (id) => {
    if (!get().tasks.some((t) => t.id === id)) return false;
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    return true;
  },

  markWorkDone: (id, opts) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.deletedAt || getTaskStage(task) !== 'doing') return false;
    const now = nowIso();
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              stage: 'awaiting_payment' as const,
              workDoneAt: now,
              updatedAt: now,
              payerName: opts?.payerName !== undefined ? cleanPayer(opts.payerName) : t.payerName,
              paymentDueDate: opts?.paymentDueDate ?? t.paymentDueDate,
              subTasks: t.subTasks.map((st) => (st.isCompleted ? st : { ...st, isCompleted: true, completedAt: now })),
            }
          : t
      ),
    }));
    return true;
  },

  undoMarkWorkDone: (id, before) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || getTaskStage(task) !== 'awaiting_payment') return false;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, stage: 'doing' as const, workDoneAt: undefined, updatedAt: nowIso(), subTasks: before?.subTasks ?? t.subTasks }
          : t
      ),
    }));
    return true;
  },

  undoCompleteTask: (id, before) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || !task.completedAt) return false;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              completedAt: undefined,
              incomeTxnId: undefined,
              stage: before?.stage && before.stage !== 'paid' ? before.stage : 'doing',
              updatedAt: nowIso(),
              actualAmount: before?.actualAmount,
              // Phase 6A: khôi phục chính xác sub-task nếu có snapshot; nếu không, giữ nguyên.
              subTasks: before?.subTasks ?? t.subTasks,
            }
          : t
      ),
      // Phase 6A: khôi phục penalty đã bị completeTask tiêu hao (nếu có snapshot).
      xpPenalties: before?.xpPenalties ?? s.xpPenalties,
    }));
    // XP TASK_COMPLETE do caller (undo executor) restore qua useAuthStore.restoreProgress.
    return true;
  },

  updateTask: (id, data) =>
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...data, updatedAt: nowIso() };
        if ('payerName' in data) next.payerName = cleanPayer(data.payerName);
        return next;
      }),
    })),

  setTaskAiEval: (id, aiEval) =>
    set((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? { ...t, aiEval, updatedAt: nowIso() } : t),
    })),

  completeTask: (id, actualAmount, opts) => {
    // Tính daysEarly TRƯỚC khi mutate state — cần raw task để đọc endDate.
    const task = get().tasks.find((t) => t.id === id);
    // Chặn hoàn thành 2 lần (bấm đúp / chat + UI) → không cộng XP 2 lần.
    if (!task || task.completedAt || task.deletedAt) return false;
    const now = new Date();
    // completedAt = NGÀY NHẬN TIỀN (có thể lùi theo giao dịch) để khớp Sổ sách; updatedAt luôn là bây giờ.
    let completedAt = opts?.receivedAt && !Number.isNaN(opts.receivedAt.getTime()) ? opts.receivedAt : now;
    // Không để "Nhận ngày" sớm hơn ngày tạo việc (vd. ghi một việc đã xong từ trước rồi chọn ngày nhận cũ hơn).
    const created = Date.parse(task.createdAt);
    if (!Number.isNaN(created) && completedAt.getTime() < created) completedAt = new Date(created);
    // Đã xong việc từ trước (Chờ thanh toán) → tính sớm/trễ theo lúc xong việc, không phải lúc khách trả.
    // Thưởng "xong sớm" tính theo lúc xong việc THẬT (workDoneAt hoặc bây giờ) — ngày nhận lùi không được cộng XP.
    const doneAt = task.workDoneAt ? new Date(task.workDoneAt) : now;
    const end = new Date(task.endDate);
    const daysEarly = Math.max(0, Math.floor((end.getTime() - doneAt.getTime()) / (1000 * 60 * 60 * 24)));

    set((s) => {
      const newPenalties = s.xpPenalties.map((p) =>
        p.remainingTasks > 0 ? { ...p, remainingTasks: p.remainingTasks - 1 } : p
      ).filter((p) => p.remainingTasks > 0);

      return {
        tasks: s.tasks.map((t) =>
          t.id === id
            ? { ...t, completedAt: completedAt.toISOString(), updatedAt: now.toISOString(), actualAmount,
                stage: 'paid' as const,
                incomeTxnId: opts?.incomeTxnId,
                subTasks: t.subTasks.map((st) => ({ ...st, isCompleted: true })) }
            : t
        ),
        xpPenalties: newPenalties,
      };
    });

    // TASK_COMPLETE XP — formula = max(20, base + earlyBonus). Penalty multiplier
    // (nếu user đang gánh penalty từ task trễ trước) đã được apply trong awardXP.
    useAuthStore.getState().awardXP({
      type: 'TASK_COMPLETE',
      earnedAmount: actualAmount,
      daysEarly,
    });
    return true;
  },

  deleteOverdueTask: (id, reason) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, deletedAt: nowIso(), updatedAt: nowIso(), deleteReason: reason } : t
      ),
      xpPenalties: [
        ...s.xpPenalties,
        { taskId: id, penaltyMultiplier: 0.7, remainingTasks: 3 },
      ],
    }));

    // TASK_OVERDUE XP — penalty -15 (negative). awardXP không apply task multiplier
    // cho XP âm (chỉ apply cho positive) → user mất đúng -15.
    useAuthStore.getState().awardXP({ type: 'TASK_OVERDUE' });
  },

  toggleSubTask: (taskId, subTaskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              updatedAt: nowIso(),
              subTasks: t.subTasks.map((st) => {
                if (st.id !== subTaskId) return st;
                const nextCompleted = !st.isCompleted;
                return {
                  ...st,
                  isCompleted: nextCompleted,
                  // Set timestamp khi chuyển false → true; xóa khi un-tick
                  completedAt: nextCompleted ? nowIso() : undefined,
                };
              }),
            }
          : t
      ),
    })),

  getStatus: (task) => getTaskStatus(task),

  getActiveXPMultiplier: () => {
    const penalties = get().xpPenalties.filter((p) => p.remainingTasks > 0);
    if (penalties.length === 0) return 1;
    return Math.min(...penalties.map((p) => p.penaltyMultiplier));
  },

  getTasksByStatus: (status) =>
    get().tasks.filter((t) => !t.deletedAt && getTaskStatus(t) === status),

  getTotalEarned: () =>
    get().tasks
      .filter((t) => t.completedAt && t.actualAmount)
      .reduce((sum, t) => sum + (t.actualAmount || 0), 0),

  getSubTaskProgress: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return { done: 0, total: 0 };
    return {
      done: task.subTasks.filter((st) => st.isCompleted).length,
      total: task.subTasks.length,
    };
  },
    }),
    {
      name: STORE_KEYS.tasks,
      version: STORE_VERSIONS.tasks,
      storage: createJSONStorage(() => simulationAwareStorage),
      partialize: (s) => ({ tasks: s.tasks, xpPenalties: s.xpPenalties }),
      migrate: (persisted) => migrateTasksState(persisted) as unknown as TaskState,
      onRehydrateStorage: onRehydrateMark('tasks'),
    },
  ),
);
