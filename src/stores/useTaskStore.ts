/* ═══ Task Store — Earning Tasks + Sub-tasks + XP Penalties ═══ */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EarningTask, SubTask, TaskStatus, XPPenalty, OverdueReason, TaskAiEval } from '@/types/task';
import { useAuthStore } from '@/stores/useAuthStore';
import { STORE_KEYS, STORE_VERSIONS, onRehydrateMark } from '@/stores/persistConfig';
import { DEMO_TASKS } from '@/data/demoSeed';

function genId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getTaskStatus(task: EarningTask): TaskStatus {
  if (task.completedAt) return 'completed';
  if (task.deletedAt) return 'completed';
  const now = new Date();
  const start = new Date(task.startDate);
  const end = new Date(task.endDate);
  if (now < start) return 'pending';
  if (now > end) return 'overdue';
  return 'active';
}

interface TaskState {
  tasks: EarningTask[];
  xpPenalties: XPPenalty[];

  addTask: (data: Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'> & { subTasks?: Omit<SubTask, 'id' | 'isCompleted'>[] }) => EarningTask;
  updateTask: (id: string, data: Partial<Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'>>) => void;
  /** T5: cache kết quả AI thẩm định NGAY trên task (đổi task → hash đổi → gọi lại). */
  setTaskAiEval: (id: string, aiEval: TaskAiEval) => void;
  completeTask: (id: string, actualAmount: number) => void;
  deleteOverdueTask: (id: string, reason: OverdueReason) => void;
  /** Phase 5 (undo): xóa hẳn 1 task (dùng cho undo task vừa tạo). Trả false nếu không thấy. */
  removeTask: (id: string) => boolean;
  /** Phase 5/6A (undo): bỏ trạng thái hoàn thành. Nếu có `before`, khôi phục CHÍNH XÁC
   * actualAmount + subTasks + xpPenalties (penalty đã bị completeTask tiêu hao). XP do caller restore. */
  undoCompleteTask: (id: string, before?: { actualAmount?: number; subTasks?: SubTask[]; xpPenalties?: XPPenalty[] }) => boolean;
  toggleSubTask: (taskId: string, subTaskId: string) => void;

  getStatus: (task: EarningTask) => TaskStatus;
  getActiveXPMultiplier: () => number;
  getTasksByStatus: (status: TaskStatus) => EarningTask[];
  getTotalEarned: () => number;
  getSubTaskProgress: (taskId: string) => { done: number; total: number };
}

const isDemoSeed = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
  tasks: isDemoSeed ? DEMO_TASKS : [],
  xpPenalties: [],

  addTask: (data) => {
    const task: EarningTask = {
      ...data,
      id: genId(),
      createdAt: new Date().toISOString(),
      subTasks: (data.subTasks || []).map((st) => ({ ...st, id: genId('st'), isCompleted: false })),
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  removeTask: (id) => {
    if (!get().tasks.some((t) => t.id === id)) return false;
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
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
      tasks: s.tasks.map((t) => t.id === id ? { ...t, ...data } : t),
    })),

  setTaskAiEval: (id, aiEval) =>
    set((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? { ...t, aiEval } : t),
    })),

  completeTask: (id, actualAmount) => {
    // Tính daysEarly TRƯỚC khi mutate state — cần raw task để đọc endDate.
    const task = get().tasks.find((t) => t.id === id);
    const completedAt = new Date();
    let daysEarly = 0;
    if (task) {
      const end = new Date(task.endDate);
      const diffMs = end.getTime() - completedAt.getTime();
      daysEarly = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    set((s) => {
      const newPenalties = s.xpPenalties.map((p) =>
        p.remainingTasks > 0 ? { ...p, remainingTasks: p.remainingTasks - 1 } : p
      ).filter((p) => p.remainingTasks > 0);

      return {
        tasks: s.tasks.map((t) =>
          t.id === id
            ? { ...t, completedAt: completedAt.toISOString(), actualAmount,
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
  },

  deleteOverdueTask: (id, reason) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, deletedAt: new Date().toISOString(), deleteReason: reason } : t
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
              subTasks: t.subTasks.map((st) => {
                if (st.id !== subTaskId) return st;
                const nextCompleted = !st.isCompleted;
                return {
                  ...st,
                  isCompleted: nextCompleted,
                  // Set timestamp khi chuyển false → true; xóa khi un-tick
                  completedAt: nextCompleted ? new Date().toISOString() : undefined,
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
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tasks: s.tasks, xpPenalties: s.xpPenalties }),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<TaskState>;
        return {
          ...p,
          tasks: Array.isArray(p.tasks) ? p.tasks : [],
          xpPenalties: Array.isArray(p.xpPenalties) ? p.xpPenalties : [],
        } as TaskState;
      },
      onRehydrateStorage: onRehydrateMark('tasks'),
    },
  ),
);
