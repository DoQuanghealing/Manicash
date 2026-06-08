/* ═══ Money Brain — Snapshot Contract V1 (Phase 0) ═══
 * Hợp đồng dữ liệu DUY NHẤT giữa client, server, UI và AI.
 *
 * Nguyên tắc bất biến (xem docs/MONEY_BRAIN_ROADMAP.md):
 *  - Đây là PURE TYPES — không import React / Zustand / API.
 *  - `clientNow` + `timezone` BẮT BUỘC: engine không bao giờ tự lấy giờ server
 *    (Vercel chạy UTC). Mọi logic period phải tính theo timezone của client.
 *  - Versioned: đổi shape => tăng version, không phá ngầm.
 */

export type MoneySnapshotVersion = 'money_snapshot_v1';

/** IANA timezone string; mặc định sản phẩm là Asia/Ho_Chi_Minh. */
export type MoneyTimezone = 'Asia/Ho_Chi_Minh' | string;

export type MoneyTxnType = 'income' | 'expense' | 'transfer';

export type MoneyWallet = 'main' | 'emergency' | 'bill-fund' | string;

export interface MoneyTransactionSnapshot {
  id: string;
  type: MoneyTxnType;
  amount: number;
  categoryId?: string;
  categoryName?: string;
  wallet?: MoneyWallet;
  /** Ví đích cho transfer (để tính savings: toWallet != main). */
  toWallet?: MoneyWallet;
  note?: string;
  /** ISO string gốc. */
  date: string;
  /** YYYY-MM-DD theo timezone client. */
  dateKey: string;
  /** ISO-8601 week, format YYYY-Www, tuần bắt đầu thứ 2. */
  weekKey: string;
  /** YYYY-MM theo timezone client. */
  monthKey: string;
  /** HH:mm. */
  time?: string;
}

export interface MoneyBudgetSnapshot {
  categoryId: string;
  categoryName?: string;
  monthlyLimit: number;
  monthKey: string;
}

export interface MoneyBillSnapshot {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  isPaid: boolean;
}

export interface MoneyGoalSnapshot {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  /** Khoản tiết kiệm ĐỀU mỗi tháng cho mục tiêu — dùng cho safe-to-spend.
   * KHÔNG dùng currentAmount (tổng đã tích lũy) để trừ safe-to-spend. */
  monthlyContributionTarget?: number;
}

export interface MoneyTaskSnapshot {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount?: number;
  startDate: string;
  endDate: string;
  completedAt?: string;
  deletedAt?: string;
  subTasks?: Array<{
    id: string;
    name?: string;
    isCompleted: boolean;
    completedAt?: string;
  }>;
}

export interface MoneyUserSnapshot {
  rank?: string;
  xp?: number;
  streak?: number;
  streakShields?: number;
}

export interface MoneySnapshotV1 {
  version: MoneySnapshotVersion;
  /** ISO string "bây giờ" theo đồng hồ client. BẮT BUỘC. */
  clientNow: string;
  /** Timezone client. BẮT BUỘC. */
  timezone: MoneyTimezone;

  wallets: {
    main: number;
    emergency: number;
    billFund: number;
  };

  transactions: MoneyTransactionSnapshot[];
  budgets: MoneyBudgetSnapshot[];
  bills: MoneyBillSnapshot[];
  goals: MoneyGoalSnapshot[];
  tasks: MoneyTaskSnapshot[];
  user?: MoneyUserSnapshot;

  /** Dư tháng trước chuyển sang (carryOver) — cho safe-to-spend. */
  carryOver?: number;
}

// Phase 3: CFO Context Pack types (re-export để consumer import từ "./types").
export type { FinancialMode, CFOContextPackVersion, CFOContextPackV1 } from './cfoTypes';
