/* ═══ Finance Store — Zustand (Transactions + Balances + Bills) ═══ */
'use client';

import { create } from 'zustand';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { getMonthKeyFromDate, getCurrentMonthKey, getDateKey, getDateLabel } from '@/lib/dateHelpers';

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
  kind?: 'income' | 'expense' | 'split';
  splitBreakdown?: { billFund: number; reserve: number; goals: number; investment: number; };
  sourceTransactionId?: string;
}

export interface BillSnapshot {
  month: string;           // 'YYYY-MM'
  totalFixedBills: number;
  billFundBalance: number;
  isFullyFunded: boolean;
  bills: Array<{
    id: string;
    name: string;
    icon: string;
    amount: number;
    dueDay: number;
    isPaid: boolean;
  }>;
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
  billSnapshots: BillSnapshot[];

  addTransaction: (txn: Omit<Transaction, 'id' | 'date' | 'time' | 'dateLabel' | 'dateKey'> & { transactionDate?: Date }) => Transaction;
  addSplitTransaction: (params: { splitBreakdown: { billFund: number; reserve: number; goals: number; investment: number; }; sourceTransactionId?: string; note?: string; occurredAt?: Date; }) => Transaction;
  getFilteredTransactions: (filter: 'all' | 'income' | 'expense') => Transaction[];
  getTotalIncome: () => number;
  getTotalExpense: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpense: () => number;
  getIncomeForMonth: (monthKey: string) => number;
  getExpenseForMonth: (monthKey: string) => number;
  getCurrentMonthKey: () => string;
  getTotalFixedBillsAmount: () => number;
  getVirtualBalance: () => number;

  // Calendar helpers
  getDailySummary: () => Record<string, { income: number; expense: number }>;

  // Bill management
  addBill: (bill: Omit<FixedBill, 'id' | 'isPaid'>) => FixedBill;
  updateBill: (billId: string, updates: Partial<Omit<FixedBill, 'id'>>) => void;
  removeBill: (billId: string) => void;
  payBill: (billId: string) => void;
  /** Phase 5 (undo): set trạng thái đã/chưa đóng tường minh + hoàn billFund. */
  setBillPaidStatus: (billId: string, isPaid: boolean) => void;
  /** Phase 5 (undo): xóa 1 giao dịch + đảo ngược balance đã cộng/trừ. Trả false nếu không tìm thấy. */
  removeTransaction: (transactionId: string) => boolean;
  /** Reset tất cả bill về chưa đóng — gọi khi sang tháng mới (rollover). */
  resetBillsPaid: () => void;
  getTotalBills: () => number;
  getAccumulatedBillTarget: () => { total: number; accumulated: number; bills: (FixedBill & { runningTotal: number; canPay: boolean; shortage: number })[] };
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

const isDemoSeed = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: isDemoSeed ? generateSeedData() : [],
  mainBalance: isDemoSeed ? 15000000 : 0,
  emergencyBalance: isDemoSeed ? 5000000 : 0,
  billFundBalance: isDemoSeed ? 8500000 : 0,
  fixedBills: SEED_BILLS,
  billSnapshots: [],

  addTransaction: (txnData) => {
    const { transactionDate, ...restTxnData } = txnData;
    const txnDate = transactionDate ?? new Date();
    
    // Compare calendar DATES in local time, not raw milliseconds.
    // Using UTC offsets causes off-by-one: e.g. "today noon" in UTC+7 is
    // "today 05:00 UTC" which appears "in the future" to Date.now() before
    // that UTC time, even though the calendar date is today.
    const txnDateOnly = new Date(txnDate.getFullYear(), txnDate.getMonth(), txnDate.getDate());
    const todayOnly = new Date();
    todayOnly.setHours(0, 0, 0, 0);
    const daysAgo = (todayOnly.getTime() - txnDateOnly.getTime()) / (1000 * 60 * 60 * 24);

    if (daysAgo > 30) {
      throw new Error('Không thể backdate quá 30 ngày');
    }
    if (daysAgo < 0) {
      throw new Error('Không thể nhập transaction ngày trong tương lai');
    }

    const txn: Transaction = {
      ...restTxnData,
      kind: restTxnData.kind ?? (restTxnData.type === 'income' ? 'income' : restTxnData.type === 'expense' ? 'expense' : undefined),
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: txnDate.toISOString(),
      time: txnDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      dateLabel: getDateLabel(txnDate.toISOString()),
      dateKey: getDateKey(txnDate),
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

    // === BUDGET SYNC — cập nhật spent trong category budget khi chi tiêu ===
    if (txn.type === 'expense') {
      useBudgetStore.getState().addSpending(txn.categoryId, txn.amount);
    }

    // === SNAPSHOT RECALC — cập nhật snapshot tháng cũ khi backdate ===
    const txnMonthKey = getMonthKeyFromDate(txnDate);
    const currentMonthKey = get().getCurrentMonthKey();
    if (txnMonthKey !== currentMonthKey) {
      useBudgetStore.getState().updateSnapshotTotals(txnMonthKey);
    }

    return txn;
  },

  addSplitTransaction: ({ splitBreakdown, sourceTransactionId, note, occurredAt }) => {
    const now = occurredAt ?? new Date();
    const amount = splitBreakdown.billFund + splitBreakdown.reserve +
      splitBreakdown.goals + splitBreakdown.investment;
    const txn: Transaction = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'transfer',
      kind: 'split',
      amount,
      categoryId: 'split-funds',
      note: note || 'Phan bo tien vao cac quy',
      wallet: 'main',
      date: now.toISOString(),
      time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      dateLabel: getDateLabel(now.toISOString()),
      dateKey: getDateKey(now),
      splitBreakdown,
      sourceTransactionId,
    };

    set((state) => ({
      transactions: [txn, ...state.transactions],
    }));

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
    return get().getIncomeForMonth(getCurrentMonthKey());
  },

  /** Chi tiêu tháng hiện tại (từ ngày 1 đến nay) */
  getMonthlyExpense: () => {
    return get().getExpenseForMonth(getCurrentMonthKey());
  },

  getIncomeForMonth: (monthKey) => {
    return get().transactions
      .filter((t) => t.type === 'income' && getMonthKeyFromDate(t.date) === monthKey)
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getExpenseForMonth: (monthKey) => {
    return get().transactions
      .filter((t) => t.type === 'expense' && getMonthKeyFromDate(t.date) === monthKey)
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getCurrentMonthKey: () => getCurrentMonthKey(),

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
      id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isPaid: false,
    };
    set((state) => ({ fixedBills: [...state.fixedBills, bill].sort((a, b) => a.dueDay - b.dueDay) }));
    return bill;
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

  setBillPaidStatus: (billId, isPaid) => {
    set((state) => {
      const bill = state.fixedBills.find((b) => b.id === billId);
      if (!bill || bill.isPaid === isPaid) return state;
      // paid -> trừ billFund (như payBill); unpaid (undo) -> hoàn lại billFund.
      // Lưu ý: nếu lúc trả billFund < amount (bị clamp 0), undo cộng đủ amount có thể
      // dư nhẹ — chấp nhận ở Phase 5 (đa số quỹ bill đủ trả).
      const billFundBalance = isPaid
        ? Math.max(0, state.billFundBalance - bill.amount)
        : state.billFundBalance + bill.amount;
      return {
        fixedBills: state.fixedBills.map((b) => (b.id === billId ? { ...b, isPaid } : b)),
        billFundBalance,
      };
    });
  },

  removeTransaction: (transactionId) => {
    const txn = get().transactions.find((t) => t.id === transactionId);
    if (!txn) return false;
    set((state) => {
      let mainBal = state.mainBalance;
      let emergBal = state.emergencyBalance;
      let billFund = state.billFundBalance;
      // Đảo ngược chính xác mutation của addTransaction.
      if (txn.type === 'income') {
        if (txn.wallet === 'main') mainBal -= txn.amount;
        else if (txn.wallet === 'emergency') emergBal -= txn.amount;
        else if (txn.wallet === 'bill-fund') billFund -= txn.amount;
      } else if (txn.type === 'expense') {
        if (txn.wallet === 'main') mainBal += txn.amount;
        else if (txn.wallet === 'emergency') emergBal += txn.amount;
      }
      return {
        transactions: state.transactions.filter((t) => t.id !== transactionId),
        mainBalance: mainBal,
        emergencyBalance: emergBal,
        billFundBalance: billFund,
      };
    });
    return true;
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
