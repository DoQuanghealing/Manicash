/* ═══ PRISM (Lõi Kim Cương) — Store trí nhớ giao dịch lặp lại (P3) ═══
 * Lớp persist mỏng bọc các hàm pure ở transactionMemory.ts. Lưu localStorage,
 * xóa khi logout (account boundary — wire ở clearLocalPersistence).
 */
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  recordHabit,
  topHabits,
  type RecordHabitInput,
  type TopHabitsOptions,
  type TransactionHabit,
} from '@/lib/aiMoneyChat/prism/transactionMemory';

export const TRANSACTION_HABIT_STORAGE_KEY = 'manicash.prism.habits.v1';

interface TransactionHabitState {
  habits: TransactionHabit[];
  /** Ghi nhận 1 giao dịch đã xác nhận để học thói quen. */
  record: (input: RecordHabitInput) => void;
  /** Top giao dịch lặp lại để gợi ý ghi nhanh. */
  getTop: (opts?: TopHabitsOptions) => TransactionHabit[];
  clearAll: () => void;
}

export const useTransactionHabitStore = create<TransactionHabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      record: (input) =>
        set((s) => ({ habits: recordHabit(s.habits, input, new Date().toISOString()) })),
      getTop: (opts) => topHabits(get().habits, opts),
      clearAll: () => set({ habits: [] }),
    }),
    {
      name: TRANSACTION_HABIT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
