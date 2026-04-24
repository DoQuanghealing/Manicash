/* ═══ Category Store — CRUD Expense Categories (syncs Ledger ↔ Input) ═══ */
'use client';

import { create } from 'zustand';
import { EXPENSE_CATEGORIES, type CategoryItem } from '@/data/categories';

interface CategoryState {
  expenseCategories: CategoryItem[];

  // Actions
  addCategory: (cat: CategoryItem) => void;
  updateCategory: (id: string, updates: Partial<Omit<CategoryItem, 'id'>>) => void;
  removeCategory: (id: string) => void;
  resetToDefaults: () => void;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  expenseCategories: [...EXPENSE_CATEGORIES],

  addCategory: (cat) =>
    set((state) => ({
      expenseCategories: [...state.expenseCategories, cat],
    })),

  updateCategory: (id, updates) =>
    set((state) => ({
      expenseCategories: state.expenseCategories.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeCategory: (id) =>
    set((state) => ({
      expenseCategories: state.expenseCategories.filter((c) => c.id !== id),
    })),

  resetToDefaults: () =>
    set({ expenseCategories: [...EXPENSE_CATEGORIES] }),
}));
