/* ═══ Task Store — Earning Tasks + Sub-tasks + XP Penalties ═══ */
'use client';

import { create } from 'zustand';
import type { EarningTask, SubTask, TaskStatus, XPPenalty, OverdueReason } from '@/types/task';
import { useAuthStore } from '@/stores/useAuthStore';

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

const today = new Date();
const msPerDay = 1000 * 60 * 60 * 24;
const getDayStr = (offsetDays: number) => new Date(today.getTime() + offsetDays * msPerDay).toISOString();

const SEED_TASKS: EarningTask[] = [
  {
    id: 'task-1', name: 'Freelance thiết kế logo',
    expectedAmount: 3_000_000,
    startDate: getDayStr(-2),
    endDate: getDayStr(5),
    createdAt: getDayStr(-3),
    subTasks: [
      { id: 'st-1a', name: 'Liên hệ khách hàng', isCompleted: true },
      { id: 'st-1b', name: 'Gửi bản nháp v1', isCompleted: true },
      { id: 'st-1c', name: 'Chỉnh sửa theo feedback', isCompleted: false },
      { id: 'st-1d', name: 'Giao file final', isCompleted: false },
      { id: 'st-1e', name: 'Nhận thanh toán', isCompleted: false },
    ],
  },
  {
    id: 'task-2', name: 'Bán hàng online Shopee',
    expectedAmount: 1_500_000,
    startDate: getDayStr(2),
    endDate: getDayStr(10),
    createdAt: getDayStr(-1),
    subTasks: [
      { id: 'st-2a', name: 'Chụp ảnh sản phẩm', isCompleted: false },
      { id: 'st-2b', name: 'Đăng listing', isCompleted: false },
      { id: 'st-2c', name: 'Xử lý đơn hàng', isCompleted: false },
    ],
  },
  {
    id: 'task-3', name: 'Dạy kèm tiếng Anh',
    expectedAmount: 2_000_000,
    startDate: getDayStr(-10),
    endDate: getDayStr(-1),
    createdAt: getDayStr(-12),
    subTasks: [
      { id: 'st-3a', name: 'Soạn giáo trình', isCompleted: true },
      { id: 'st-3b', name: 'Dạy 8 buổi', isCompleted: false },
    ],
  },
  {
    id: 'task-4', name: 'Viết bài blog công nghệ',
    expectedAmount: 800_000,
    actualAmount: 800_000,
    completedAt: getDayStr(-3),
    startDate: getDayStr(-7),
    endDate: getDayStr(-2),
    createdAt: getDayStr(-8),
    subTasks: [
      { id: 'st-4a', name: 'Research chủ đề', isCompleted: true },
      { id: 'st-4b', name: 'Viết bài 2000 từ', isCompleted: true },
      { id: 'st-4c', name: 'Submit và chỉnh sửa', isCompleted: true },
    ],
  },
  {
    id: 'task-5', name: 'Chụp ảnh sự kiện',
    expectedAmount: 5_000_000,
    startDate: getDayStr(7),
    endDate: getDayStr(14),
    createdAt: today.toISOString(),
    subTasks: [
      { id: 'st-5a', name: 'Xác nhận lịch với khách', isCompleted: false },
      { id: 'st-5b', name: 'Chuẩn bị thiết bị', isCompleted: false },
      { id: 'st-5c', name: 'Chụp & chỉnh ảnh', isCompleted: false },
      { id: 'st-5d', name: 'Giao ảnh', isCompleted: false },
    ],
  },
];

interface TaskState {
  tasks: EarningTask[];
  xpPenalties: XPPenalty[];

  addTask: (data: Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'> & { subTasks?: Omit<SubTask, 'id' | 'isCompleted'>[] }) => EarningTask;
  updateTask: (id: string, data: Partial<Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'>>) => void;
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

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: SEED_TASKS,
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
}));
