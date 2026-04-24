/* ═══ Task Store — Earning Tasks + Sub-tasks + XP Penalties ═══ */
'use client';

import { create } from 'zustand';
import type { EarningTask, SubTask, TaskStatus, XPPenalty, OverdueReason } from '@/types/task';

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
const SEED_TASKS: EarningTask[] = [
  {
    id: 'task-1', name: 'Freelance thiết kế logo',
    expectedAmount: 3_000_000,
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5).toISOString(),
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).toISOString(),
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
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10).toISOString(),
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString(),
    subTasks: [
      { id: 'st-2a', name: 'Chụp ảnh sản phẩm', isCompleted: false },
      { id: 'st-2b', name: 'Đăng listing', isCompleted: false },
      { id: 'st-2c', name: 'Xử lý đơn hàng', isCompleted: false },
    ],
  },
  {
    id: 'task-3', name: 'Dạy kèm tiếng Anh',
    expectedAmount: 2_000_000,
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString(),
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 12).toISOString(),
    subTasks: [
      { id: 'st-3a', name: 'Soạn giáo trình', isCompleted: true },
      { id: 'st-3b', name: 'Dạy 8 buổi', isCompleted: false },
    ],
  },
  {
    id: 'task-4', name: 'Viết bài blog công nghệ',
    expectedAmount: 800_000,
    actualAmount: 800_000,
    completedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).toISOString(),
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toISOString(),
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8).toISOString(),
    subTasks: [
      { id: 'st-4a', name: 'Research chủ đề', isCompleted: true },
      { id: 'st-4b', name: 'Viết bài 2000 từ', isCompleted: true },
      { id: 'st-4c', name: 'Submit và chỉnh sửa', isCompleted: true },
    ],
  },
  {
    id: 'task-5', name: 'Chụp ảnh sự kiện',
    expectedAmount: 5_000_000,
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14).toISOString(),
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

  addTask: (data: Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'> & { subTasks?: Omit<SubTask, 'id' | 'isCompleted'>[] }) => void;
  updateTask: (id: string, data: Partial<Pick<EarningTask, 'name' | 'expectedAmount' | 'startDate' | 'endDate'>>) => void;
  completeTask: (id: string, actualAmount: number) => void;
  deleteOverdueTask: (id: string, reason: OverdueReason) => void;
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

  addTask: (data) =>
    set((s) => ({
      tasks: [...s.tasks, {
        ...data,
        id: genId(),
        createdAt: new Date().toISOString(),
        subTasks: (data.subTasks || []).map((st) => ({ ...st, id: genId('st'), isCompleted: false })),
      }],
    })),

  updateTask: (id, data) =>
    set((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? { ...t, ...data } : t),
    })),

  completeTask: (id, actualAmount) =>
    set((s) => {
      const newPenalties = s.xpPenalties.map((p) =>
        p.remainingTasks > 0 ? { ...p, remainingTasks: p.remainingTasks - 1 } : p
      ).filter((p) => p.remainingTasks > 0);

      return {
        tasks: s.tasks.map((t) =>
          t.id === id
            ? { ...t, completedAt: new Date().toISOString(), actualAmount,
                subTasks: t.subTasks.map((st) => ({ ...st, isCompleted: true })) }
            : t
        ),
        xpPenalties: newPenalties,
      };
    }),

  deleteOverdueTask: (id, reason) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, deletedAt: new Date().toISOString(), deleteReason: reason } : t
      ),
      xpPenalties: [
        ...s.xpPenalties,
        { taskId: id, penaltyMultiplier: 0.7, remainingTasks: 3 },
      ],
    })),

  toggleSubTask: (taskId, subTaskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subTasks: t.subTasks.map((st) => st.id === subTaskId ? { ...st, isCompleted: !st.isCompleted } : st) }
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
