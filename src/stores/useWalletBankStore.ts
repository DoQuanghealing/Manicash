/* ═══ Wallet-Bank Store — Quản lý ví & liên kết ngân hàng ═══ */
'use client';

import { create } from 'zustand';

export type WalletGroup = 'income' | 'expense' | 'saving';

export interface SubWallet {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: number;
}

export interface WalletGroupData {
  id: WalletGroup;
  label: string;
  icon: string;
  color: string;
  bankName: string;
  accountNumber: string;
  subWallets: SubWallet[];
}

interface WalletBankState {
  wallets: WalletGroupData[];

  // Actions
  updateBank: (groupId: WalletGroup, bankName: string, accountNumber: string) => void;
  addSubWallet: (groupId: WalletGroup, name: string) => void;
  removeSubWallet: (groupId: WalletGroup, subId: string) => void;
  updateSubWallet: (groupId: WalletGroup, subId: string, updates: Partial<SubWallet>) => void;
}

const DEFAULT_WALLETS: WalletGroupData[] = [
  {
    id: 'income',
    label: 'Thu nhập',
    icon: '💰',
    color: '#22C55E',
    bankName: '',
    accountNumber: '',
    subWallets: [],
  },
  {
    id: 'expense',
    label: 'Chi tiêu',
    icon: '💳',
    color: '#F97316',
    bankName: '',
    accountNumber: '',
    subWallets: [
      { id: 'exp-daily', name: 'Chi tiêu hằng ngày', bankName: '', accountNumber: '', balance: 0 },
      { id: 'exp-bills', name: 'Hóa đơn', bankName: '', accountNumber: '', balance: 0 },
    ],
  },
  {
    id: 'saving',
    label: 'Tiết kiệm',
    icon: '🏦',
    color: '#7C3AED',
    bankName: '',
    accountNumber: '',
    subWallets: [
      { id: 'sav-reserve', name: 'Quỹ dự phòng', bankName: '', accountNumber: '', balance: 0 },
      { id: 'sav-goals', name: 'Mục tiêu', bankName: '', accountNumber: '', balance: 0 },
      { id: 'sav-invest', name: 'Đầu tư', bankName: '', accountNumber: '', balance: 0 },
    ],
  },
];

export const useWalletBankStore = create<WalletBankState>((set) => ({
  wallets: DEFAULT_WALLETS,

  updateBank: (groupId, bankName, accountNumber) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === groupId ? { ...w, bankName, accountNumber } : w
      ),
    })),

  addSubWallet: (groupId, name) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === groupId
          ? {
              ...w,
              subWallets: [
                ...w.subWallets,
                {
                  id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  name,
                  bankName: '',
                  accountNumber: '',
                  balance: 0,
                },
              ],
            }
          : w
      ),
    })),

  removeSubWallet: (groupId, subId) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === groupId
          ? { ...w, subWallets: w.subWallets.filter((s) => s.id !== subId) }
          : w
      ),
    })),

  updateSubWallet: (groupId, subId, updates) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === groupId
          ? {
              ...w,
              subWallets: w.subWallets.map((s) =>
                s.id === subId ? { ...s, ...updates } : s
              ),
            }
          : w
      ),
    })),
}));
