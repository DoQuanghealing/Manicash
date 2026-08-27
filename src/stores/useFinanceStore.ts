/* ═══ Finance Store — Zustand (Transactions + Balances + Bills) ═══ */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { getMonthKeyFromDate, getCurrentMonthKey, getDateKey, getDateLabel } from '@/lib/dateHelpers';
import { STORE_KEYS, STORE_VERSIONS, onRehydrateMark } from '@/stores/persistConfig';

export type TxnType = 'income' | 'expense' | 'transfer';
export type WalletType = 'main' | 'emergency' | 'bill-fund';

/** Tiền đi qua đường nào. Không khai (giao dịch cũ) = coi như chuyển khoản. */
export type PaymentMethod = 'cash' | 'transfer';

/** Cảm xúc lúc chi tiêu — tự khai, không phán xét. Optional, chỉ áp cho expense. */
export type EmotionTag = 'self_reward' | 'stress' | 'sad' | 'preference' | 'excited' | 'anger' | 'jealousy';

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
  /** Gắn sau khi tạo giao dịch (không chặn lúc nhập) — xem updateTransactionEmotion. */
  emotionTag?: EmotionTag;
  /** Tiền mặt hay chuyển khoản. Thiếu = giao dịch cũ, mặc định chuyển khoản. */
  method?: PaymentMethod;
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

/** Một lần đóng hóa đơn — lưu SỐ TIỀN THỰC ĐÓNG của tháng đó.
 * Cần bản ghi riêng chứ không suy từ `FixedBill.amount`: tiền điện tháng này
 * 1.8tr, tháng sau 1.6tr — sửa amount là mất luôn quá khứ. */
export interface BillPayment {
  id: string;
  billId: string;
  /** Chụp lại tên + icon lúc đóng, để đổi tên hóa đơn không làm hỏng biểu đồ cũ. */
  billName: string;
  icon: string;
  amount: number;
  month: string;   // 'YYYY-MM'
  paidAt: string;  // ISO
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
  /** Phần TIỀN MẶT nằm trong ví chính (tập con của mainBalance, không cộng thêm).
   * Nhờ vậy "tiền trong túi" và "tiền trong tài khoản" luôn khớp tổng, và mọi
   * màn hình đang dùng mainBalance không đổi ý nghĩa. */
  cashBalance: number;
  emergencyBalance: number;
  billFundBalance: number;
  fixedBills: FixedBill[];
  billSnapshots: BillSnapshot[];
  /** Lịch sử đóng hóa đơn (append-only) — nguồn cho biểu đồ theo tháng/năm. */
  billPayments: BillPayment[];

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
  /** Số dư nằm ở ngân hàng = ví chính − tiền mặt. Không âm. */
  getBankBalance: () => number;

  // Calendar helpers
  getDailySummary: () => Record<string, { income: number; expense: number }>;

  // Bill management
  addBill: (bill: Omit<FixedBill, 'id' | 'isPaid'>) => FixedBill;
  updateBill: (billId: string, updates: Partial<Omit<FixedBill, 'id'>>) => void;
  removeBill: (billId: string) => void;
  payBill: (billId: string) => void;
  /** Phase 5/6A (undo): set trạng thái đã/chưa đóng. Nếu có `billFundOverride`,
   * set billFundBalance CHÍNH XÁC bằng giá trị đó (undo exact, tránh sai số clamp). */
  setBillPaidStatus: (billId: string, isPaid: boolean, billFundOverride?: number) => void;
  /** Phase 5 (undo): xóa 1 giao dịch + đảo ngược balance đã cộng/trừ. Trả false nếu không tìm thấy. */
  removeTransaction: (transactionId: string) => boolean;
  /** Gắn/sửa/gỡ emotionTag cho 1 giao dịch đã tồn tại (tự khai, không phán xét). */
  updateTransactionEmotion: (transactionId: string, tag: EmotionTag | null) => void;
  /** Reset tất cả bill về chưa đóng — gọi khi sang tháng mới (rollover). */
  resetBillsPaid: () => void;
  getTotalBills: () => number;
  /** Lịch sử đóng của 1 hóa đơn trong 1 năm, cũ → mới. */
  getBillPaymentsForYear: (billId: string, year: number) => BillPayment[];
  getAccumulatedBillTarget: () => { total: number; accumulated: number; bills: (FixedBill & { runningTotal: number; canPay: boolean; shortage: number })[] };
}

/** Ghi 1 lần đóng cho tháng hiện tại. Idempotent: đóng lại cùng tháng chỉ cập
 * nhật số tiền, không nhân đôi bản ghi. */
function appendBillPayment(current: BillPayment[], bill: FixedBill): BillPayment[] {
  const month = getCurrentMonthKey();
  const now = new Date();
  const record: BillPayment = {
    id: `bp-${bill.id}-${month}`,
    billId: bill.id,
    billName: bill.name,
    icon: bill.icon,
    amount: bill.amount,
    month,
    paidAt: now.toISOString(),
  };
  const rest = current.filter((p) => !(p.billId === bill.id && p.month === month));
  return [...rest, record];
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
  transactions: [],
  mainBalance: 0,
  cashBalance: 0,
  emergencyBalance: 0,
  billFundBalance: 0,
  fixedBills: [],
  billSnapshots: [],
  billPayments: [],

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
      let cash = state.cashBalance;

      if (txn.type === 'income') {
        if (txn.wallet === 'main') mainBal += txn.amount;
        else if (txn.wallet === 'emergency') emergBal += txn.amount;
        else if (txn.wallet === 'bill-fund') billFund += txn.amount;
      } else if (txn.type === 'expense') {
        if (txn.wallet === 'main') mainBal -= txn.amount;
        else if (txn.wallet === 'emergency') emergBal -= txn.amount;
      }

      // Tiền mặt chỉ theo dõi ở ví chính — quỹ dự phòng/hóa đơn nằm ở ngân hàng.
      if (txn.method === 'cash' && txn.wallet === 'main') {
        cash = txn.type === 'income' ? cash + txn.amount : Math.max(0, cash - txn.amount);
      }

      return {
        transactions: newTxns,
        mainBalance: mainBal,
        emergencyBalance: emergBal,
        billFundBalance: billFund,
        cashBalance: cash,
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

  getBankBalance: () => Math.max(0, get().mainBalance - get().cashBalance),

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

      return {
        fixedBills: updatedBills,
        billFundBalance: newFund,
        billPayments: appendBillPayment(state.billPayments, bill),
      };
    });
  },

  setBillPaidStatus: (billId, isPaid, billFundOverride) => {
    set((state) => {
      const bill = state.fixedBills.find((b) => b.id === billId);
      if (!bill || bill.isPaid === isPaid) return state;
      // Phase 6A: nếu có override -> set billFund CHÍNH XÁC (undo exact từ billFundBefore).
      // Nếu không -> hành vi đối xứng như payBill (dùng cho luồng thường).
      const billFundBalance =
        typeof billFundOverride === 'number'
          ? billFundOverride
          : isPaid
            ? Math.max(0, state.billFundBalance - bill.amount)
            : state.billFundBalance + bill.amount;
      return {
        fixedBills: state.fixedBills.map((b) => (b.id === billId ? { ...b, isPaid } : b)),
        billFundBalance,
        // Undo đánh dấu "chưa đóng" phải xoá luôn bản ghi tháng này, nếu không
        // biểu đồ năm vẫn tính là đã đóng.
        billPayments: isPaid
          ? appendBillPayment(state.billPayments, bill)
          : state.billPayments.filter(
              (p) => !(p.billId === billId && p.month === getCurrentMonthKey()),
            ),
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
      let cash = state.cashBalance;
      // Đảo ngược chính xác mutation của addTransaction.
      if (txn.type === 'income') {
        if (txn.wallet === 'main') mainBal -= txn.amount;
        else if (txn.wallet === 'emergency') emergBal -= txn.amount;
        else if (txn.wallet === 'bill-fund') billFund -= txn.amount;
      } else if (txn.type === 'expense') {
        if (txn.wallet === 'main') mainBal += txn.amount;
        else if (txn.wallet === 'emergency') emergBal += txn.amount;
      }
      // Đảo ngược đúng phần tiền mặt đã cộng/trừ lúc ghi.
      if (txn.method === 'cash' && txn.wallet === 'main') {
        cash = txn.type === 'income' ? Math.max(0, cash - txn.amount) : cash + txn.amount;
      }
      return {
        transactions: state.transactions.filter((t) => t.id !== transactionId),
        mainBalance: mainBal,
        emergencyBalance: emergBal,
        billFundBalance: billFund,
        cashBalance: cash,
      };
    });
    return true;
  },

  updateTransactionEmotion: (transactionId, tag) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === transactionId ? { ...t, emotionTag: tag ?? undefined } : t
      ),
    }));
  },

  resetBillsPaid: () =>
    set((state) => ({
      fixedBills: state.fixedBills.map((b) => ({ ...b, isPaid: false })),
    })),

  getTotalBills: () =>
    get().fixedBills.reduce((sum, b) => sum + b.amount, 0),

  getBillPaymentsForYear: (billId, year) =>
    get()
      .billPayments.filter((p) => p.billId === billId && p.month.startsWith(String(year)))
      .sort((a, b) => a.month.localeCompare(b.month)),

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
    }),
    {
      name: STORE_KEYS.finance,
      version: STORE_VERSIONS.finance,
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist dữ liệu nghiệp vụ; KHÔNG persist function.
      partialize: (s) => ({
        transactions: s.transactions,
        mainBalance: s.mainBalance,
        cashBalance: s.cashBalance,
        emergencyBalance: s.emergencyBalance,
        billFundBalance: s.billFundBalance,
        fixedBills: s.fixedBills,
        billSnapshots: s.billSnapshots,
        billPayments: s.billPayments,
      }),
      migrate: (persisted) => {
        // v1 baseline: đảm bảo field tồn tại, không crash với data cũ.
        const p = (persisted ?? {}) as Partial<FinanceState>;
        return {
          ...p,
          transactions: Array.isArray(p.transactions) ? p.transactions : [],
          fixedBills: Array.isArray(p.fixedBills) ? p.fixedBills : [],
          billSnapshots: Array.isArray(p.billSnapshots) ? p.billSnapshots : [],
          billPayments: Array.isArray(p.billPayments) ? p.billPayments : [],
          mainBalance: typeof p.mainBalance === 'number' ? p.mainBalance : 0,
          cashBalance: typeof p.cashBalance === 'number' ? p.cashBalance : 0,
          emergencyBalance: typeof p.emergencyBalance === 'number' ? p.emergencyBalance : 0,
          billFundBalance: typeof p.billFundBalance === 'number' ? p.billFundBalance : 0,
        } as FinanceState;
      },
      onRehydrateStorage: onRehydrateMark('finance'),
    },
  ),
);
