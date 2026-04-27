/* ═══ Finance Store — Zustand (Transactions + Balances + Bills) ═══ */
'use client';

import { create } from 'zustand';
import { useAuthStore } from '@/stores/useAuthStore';

export type TxnType = 'income' | 'expense' | 'transfer';
export type WalletType = 'main' | 'emergency' | 'bill-fund';

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  categoryId: string;
  note: string;
  wallet: WalletType;
  date: string;      // ISO string
  time: string;       // HH:mm
  dateLabel: string;  // 'Hôm nay', 'Hôm qua', or dd/MM
  dateKey: string;    // 'YYYY-MM-DD' for calendar grouping
}

export interface FixedBill {
  id: string;
  name: string;
  icon: string;
  amount: number;
  dueDay: number;    // Day of month
  isPaid: boolean;
}

interface FinanceState {
  transactions: Transaction[];
  mainBalance: number;
  emergencyBalance: number;
  billFundBalance: number;
  fixedBills: FixedBill[];

  addTransaction: (txn: Omit<Transaction, 'id' | 'date' | 'time' | 'dateLabel' | 'dateKey'>) => Transaction;
  getFilteredTransactions: (filter: 'all' | 'income' | 'expense') => Transaction[];
  getTotalIncome: () => number;
  getTotalExpense: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpense: () => number;
  getTotalFixedBillsAmount: () => number;
  getVirtualBalance: () => number;

  // Calendar helpers
  getDailySummary: () => Record<string, { income: number; expense: number }>;

  // Bill management
  addBill: (bill: Omit<FixedBill, 'id' | 'isPaid'>) => void;
  updateBill: (billId: string, updates: Partial<Omit<FixedBill, 'id'>>) => void;
  removeBill: (billId: string) => void;
  payBill: (billId: string) => void;
  addToBillFund: (amount: number) => void;
  /** Reset tất cả bill về chưa đóng — gọi khi sang tháng mới (rollover). */
  resetBillsPaid: () => void;
  getTotalBills: () => number;
  getAccumulatedBillTarget: () => { total: number; accumulated: number; bills: (FixedBill & { runningTotal: number; canPay: boolean; shortage: number })[] };
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txnDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - txnDay.getTime()) / (1000 * 60 * 60 * 24);

  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function getDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Generate historical demo data
function generateSeedData(): Transaction[] {
  const now = new Date();
  const txns: Transaction[] = [];
  const cats = [
    { id: 'food', note: 'Ăn uống' },
    { id: 'coffee', note: 'Cà phê' },
    { id: 'transport', note: 'Di chuyển' },
    { id: 'shopping', note: 'Mua sắm' },
    { id: 'entertainment', note: 'Giải trí' },
  ];

  // Deterministic PRNG to avoid hydration mismatch
  function seededRandom(seed: number): number {
    let t = (seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Last 14 days of data
  for (let daysAgo = 0; daysAgo < 14; daysAgo++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const dk = getDateKey(d);
    const dl = getDateLabel(d.toISOString());

    // 1 income on day 0 (today)
    if (daysAgo === 0) {
      txns.push({ id: `s-inc-${daysAgo}`, type: 'income', amount: 15000000, categoryId: 'salary', note: 'Lương tháng 3', wallet: 'main', date: d.toISOString(), time: '09:00', dateLabel: dl, dateKey: dk });
    }
    // Smaller income every 3 days
    if (daysAgo % 3 === 0 && daysAgo > 0) {
      const incAmt = 500000 + Math.floor(seededRandom(daysAgo * 100) * 1000000);
      txns.push({ id: `s-inc2-${daysAgo}`, type: 'income', amount: incAmt, categoryId: 'freelance', note: 'Thu nhập phụ', wallet: 'main', date: d.toISOString(), time: '18:00', dateLabel: dl, dateKey: dk });
    }

    // 2-3 expenses per day (deterministic)
    const expCount = 2 + Math.floor(seededRandom(daysAgo * 200) * 2);
    for (let e = 0; e < expCount; e++) {
      const seed = daysAgo * 1000 + e * 137;
      const catIdx = Math.floor(seededRandom(seed) * cats.length);
      const cat = cats[catIdx];
      const amt = 30000 + Math.floor(seededRandom(seed + 7) * 200000);
      const hour = 7 + Math.floor(seededRandom(seed + 13) * 14);
      txns.push({
        id: `s-exp-${daysAgo}-${e}`,
        type: 'expense',
        amount: amt,
        categoryId: cat.id,
        note: cat.note,
        wallet: 'main',
        date: d.toISOString(),
        time: `${String(hour).padStart(2, '0')}:${String(Math.floor(seededRandom(seed + 19) * 60)).padStart(2, '0')}`,
        dateLabel: dl,
        dateKey: dk,
      });
    }
  }

  return txns;
}

const SEED_BILLS: FixedBill[] = [
  { id: 'bill-rent', name: 'Tiền nhà', icon: '🏠', amount: 2500000, dueDay: 1, isPaid: false },
  { id: 'bill-tuition', name: 'Tiền học', icon: '📚', amount: 1200000, dueDay: 3, isPaid: false },
  { id: 'bill-installment', name: 'Trả góp', icon: '💳', amount: 800000, dueDay: 5, isPaid: false },
  { id: 'bill-electric', name: 'Tiền điện', icon: '⚡', amount: 350000, dueDay: 10, isPaid: true },
  { id: 'bill-water', name: 'Tiền nước', icon: '💧', amount: 100000, dueDay: 15, isPaid: false },
  { id: 'bill-internet', name: 'Internet', icon: '📡', amount: 200000, dueDay: 20, isPaid: false },
];

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: generateSeedData(),
  mainBalance: 15000000,
  emergencyBalance: 5000000,
  billFundBalance: 8500000, // Demo: partially funded
  fixedBills: SEED_BILLS,

  addTransaction: (txnData) => {
    const now = new Date();
    const txn: Transaction = {
      ...txnData,
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: now.toISOString(),
      time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      dateLabel: getDateLabel(now.toISOString()),
      dateKey: getDateKey(now),
    };

    set((state) => {
      const newTxns = [txn, ...state.transactions];
      let mainBal = state.mainBalance;
      let emergBal = state.emergencyBalance;
      let billFund = state.billFundBalance;

      if (txn.type === 'income') {
        if (txn.wallet === 'main') mainBal += txn.amount;
        else if (txn.wallet === 'emergency') emergBal += txn.amount;
        else if (txn.wallet === 'bill-fund') billFund += txn.amount;
      } else if (txn.type === 'expense') {
        if (txn.wallet === 'main') mainBal -= txn.amount;
        else if (txn.wallet === 'emergency') emergBal -= txn.amount;
      }

      return {
        transactions: newTxns,
        mainBalance: mainBal,
        emergencyBalance: emergBal,
        billFundBalance: billFund,
      };
    });

    // === DAILY_STREAK XP — chỉ tính cho income/expense, KHÔNG tính transfer ===
    // Streak dựa vào ngày HÔM NAY, không phải txn.date (user có thể backdate).
    // updateStreak idempotent: cùng ngày gọi nhiều lần chỉ grant 1 lần.
    if (txn.type === 'income' || txn.type === 'expense') {
      useAuthStore.getState().updateStreak();
    }

    return txn;
  },

  getFilteredTransactions: (filter) => {
    const txns = get().transactions;
    if (filter === 'all') return txns;
    return txns.filter((t) => t.type === filter);
  },

  getTotalIncome: () =>
    get().transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),

  getTotalExpense: () =>
    get().transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),

  /** Thu nhập tháng hiện tại (từ ngày 1 đến nay) */
  getMonthlyIncome: () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return get().transactions
      .filter((t) => t.type === 'income' && new Date(t.date) >= startOfMonth)
      .reduce((sum, t) => sum + t.amount, 0);
  },

  /** Chi tiêu tháng hiện tại (từ ngày 1 đến nay) */
  getMonthlyExpense: () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return get().transactions
      .filter((t) => t.type === 'expense' && new Date(t.date) >= startOfMonth)
      .reduce((sum, t) => sum + t.amount, 0);
  },

  /** Tổng bill cố định hàng tháng */
  getTotalFixedBillsAmount: () =>
    get().fixedBills.reduce((sum, b) => sum + b.amount, 0),

  getVirtualBalance: () => {
    const state = get();
    const fixedCosts = state.fixedBills.reduce((s, b) => s + b.amount, 0);
    const savings = state.mainBalance * 0.2;
    return Math.max(0, state.mainBalance - fixedCosts - savings);
  },

  // Calendar: group by dateKey
  getDailySummary: () => {
    const txns = get().transactions;
    const summary: Record<string, { income: number; expense: number }> = {};
    for (const t of txns) {
      if (!summary[t.dateKey]) summary[t.dateKey] = { income: 0, expense: 0 };
      if (t.type === 'income') summary[t.dateKey].income += t.amount;
      if (t.type === 'expense') summary[t.dateKey].expense += t.amount;
    }
    return summary;
  },

  // Bill management
  addBill: (billData) => {
    const bill: FixedBill = {
      ...billData,
      id: `bill-${Date.now()}`,
      isPaid: false,
    };
    set((state) => ({ fixedBills: [...state.fixedBills, bill].sort((a, b) => a.dueDay - b.dueDay) }));
  },

  updateBill: (billId, updates) => {
    set((state) => ({
      fixedBills: state.fixedBills
        .map((b) => (b.id === billId ? { ...b, ...updates } : b))
        .sort((a, b) => a.dueDay - b.dueDay),
    }));
  },

  removeBill: (billId) => {
    set((state) => ({
      fixedBills: state.fixedBills.filter((b) => b.id !== billId),
    }));
  },

  payBill: (billId) => {
    set((state) => {
      const bill = state.fixedBills.find((b) => b.id === billId);
      if (!bill || bill.isPaid) return state;

      // Deduct from bill fund
      const newFund = Math.max(0, state.billFundBalance - bill.amount);
      const updatedBills = state.fixedBills.map((b) =>
        b.id === billId ? { ...b, isPaid: true } : b
      );

      return { fixedBills: updatedBills, billFundBalance: newFund };
    });
  },

  addToBillFund: (amount) => {
    set((state) => ({
      billFundBalance: state.billFundBalance + amount,
      mainBalance: state.mainBalance - amount,
    }));
  },

  resetBillsPaid: () =>
    set((state) => ({
      fixedBills: state.fixedBills.map((b) => ({ ...b, isPaid: false })),
    })),

  getTotalBills: () =>
    get().fixedBills.reduce((sum, b) => sum + b.amount, 0),

  getAccumulatedBillTarget: () => {
    const state = get();
    const sorted = [...state.fixedBills].sort((a, b) => a.dueDay - b.dueDay);
    let runningTotal = 0;
    const bills = sorted.map((b) => {
      runningTotal += b.amount;
      const canPay = state.billFundBalance >= runningTotal;
      const shortage = Math.max(0, runningTotal - state.billFundBalance);
      return { ...b, runningTotal, canPay, shortage };
    });
    const total = sorted.reduce((s, b) => s + b.amount, 0);
    return { total, accumulated: state.billFundBalance, bills };
  },
}));
