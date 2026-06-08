/* ═══ AI Money Chat — Aggregation Types (Phase 2) ═══
 * MonthlyFinancialSnapshot bản RÚT GỌN cho các handler deterministic.
 * Shape giữ ổn định để Phase 3 (LLM) mở rộng thêm cashflow/budget/anomaly
 * mà không phá vỡ chữ ký getFinanceSnapshot().
 *
 * Nguồn dữ liệu (hybrid):
 *  - 'client'   : client tự đóng gói từ Zustand rồi POST lên (real-time, primary).
 *  - 'firestore': fallback đọc users/{uid}/finance_core/state + collection bills/tasks.
 *  - 'empty'    : không có client snapshot và Firestore trống/lỗi.
 */

export type SnapshotSource = 'client' | 'firestore' | 'empty';

export type BillStatus = 'paid' | 'due' | 'overdue';

export type SnapshotTaskStatus = 'pending' | 'active' | 'completed' | 'overdue';

export interface SnapshotWallets {
  /** Ví chính (chi tiêu hằng ngày). */
  main: number;
  /** Quỹ khẩn cấp. */
  emergency: number;
  /** Quỹ trả bill. */
  billFund: number;
  /** Tổng 3 ví. */
  total: number;
}

export interface SnapshotBill {
  id: string;
  name: string;
  amount: number;
  /** Ngày đến hạn trong tháng (1-31). */
  dueDay?: number;
  /** Trạng thái đã tính sẵn theo ngày hiện tại. */
  status: BillStatus;
}

export interface SnapshotTask {
  id: string;
  name: string;
  expectedAmount: number;
  status: SnapshotTaskStatus;
  /** ISO date hạn chót nếu có. */
  dueDate?: string;
  subTasksDone: number;
  subTasksTotal: number;
}

/* ─────────── Phase 3: cashflow / budget / categories / goals / health ─────────── */

export interface SnapshotCashflow {
  income: number;
  expense: number;
  net: number; // income - expense
  savings: number; // tổng transfer vào quỹ (toWallet != main)
  savingsRate: number; // (income - expense) / income, có thể âm
  avgDailyExpense: number;
}

export interface SnapshotBudget {
  monthlyBudgetTotal: number;
  spentSoFar: number;
  safeToSpend: number; // budget - đã chi - bill chưa trả
  safeToSpendPerDay: number;
  daysRemaining: number;
  categoriesTotal: number;
  categoriesOverBudget: number;
}

export interface SnapshotCategory {
  categoryId: string;
  name: string;
  spent: number;
  limit: number;
  overBy: number; // max(0, spent - limit)
  percentOfLimit: number; // 0..n (1 = đúng hạn mức)
}

export interface SnapshotAnomaly {
  categoryId: string;
  name: string;
  thisMonth: number;
  avgPrev: number; // trung bình 3 tháng trước
  zScore: number;
}

export interface SnapshotGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  percent: number; // 0..1
  deadline?: string; // ISO date
  monthsToCompleteAtPace: number; // cap 999
  atRisk: boolean; // không kịp deadline ở tốc độ hiện tại
}

export type HealthTierLabel = 'poor' | 'fair' | 'good';

export interface SnapshotHealth {
  score: number; // 0-100
  tier: HealthTierLabel;
  breakdown: {
    savingsRate: number;
    budgetAdherence: number;
    billsOnTime: number;
    emergencyFund: number;
    safeToSpend: number;
  };
}

export interface MonthlyFinancialSnapshot {
  meta: {
    uid: string;
    monthKey: string; // 'YYYY-MM'
    generatedAt: string; // ISO
    dayOfMonth: number; // 1-31
    daysInMonth: number;
    source: SnapshotSource;
    /** Cảnh báo dữ liệu thiếu/suy luận — handler có thể hiển thị nhẹ. */
    warnings: string[];
  };
  wallets: SnapshotWallets;
  cashflow: SnapshotCashflow;
  budget: SnapshotBudget;
  bills: {
    items: SnapshotBill[];
    totalDue: number; // tổng các bill CHƯA trả (due + overdue)
    totalPaid: number; // tổng các bill đã trả tháng này
  };
  categories: {
    topBySpend: SnapshotCategory[]; // top 5 chi nhiều nhất
    overspent: SnapshotCategory[]; // các mục vượt hạn mức
    anomalies: SnapshotAnomaly[]; // z-score > 2.0
  };
  goals: {
    items: SnapshotGoal[];
    atRisk: SnapshotGoal[];
  };
  tasks: {
    items: SnapshotTask[];
    activeCount: number; // pending + active
    completedCount: number;
  };
  health: SnapshotHealth;
}

/* ─────────── Client input (chưa validate) ─────────── */

/** Shape client gửi lên — mọi field optional, builder sẽ validate + coerce. */
export interface ClientSnapshotInput {
  monthKey?: string;
  wallets?: {
    main?: number;
    emergency?: number;
    billFund?: number;
  };
  bills?: Array<{
    id?: string;
    name?: string;
    amount?: number;
    dueDay?: number;
    isPaid?: boolean;
  }>;
  tasks?: Array<{
    id?: string;
    name?: string;
    expectedAmount?: number;
    startDate?: string;
    endDate?: string;
    completedAt?: string;
    deletedAt?: string;
    subTasks?: Array<{ isCompleted?: boolean }>;
  }>;
  /** Giao dịch tháng hiện tại — để tính cashflow + chi theo danh mục. */
  transactions?: Array<{
    type?: string; // 'income' | 'expense' | 'transfer'
    amount?: number;
    categoryId?: string;
    toWallet?: string;
  }>;
  /** Tổng chi theo danh mục của các tháng TRƯỚC — để tính z-score anomaly. */
  history?: Array<{
    monthKey?: string;
    categorySpend?: Record<string, number>;
  }>;
  /** Ngân sách theo danh mục tháng hiện tại. */
  budgets?: Array<{
    categoryId?: string;
    name?: string;
    limit?: number;
  }>;
  /** Mục tiêu tích lũy. */
  goals?: Array<{
    id?: string;
    name?: string;
    targetAmount?: number;
    savedAmount?: number;
    deadline?: string;
    /** Số tiền tích lũy đều mỗi tháng (nếu có); thiếu thì builder ước từ savings. */
    monthlyContribution?: number;
  }>;
}

/** Options cho getFinanceSnapshot — giữ chữ ký ổn định cho Phase 3. */
export interface GetSnapshotOptions {
  /** Snapshot client gửi lên (primary). Nếu hợp lệ sẽ dùng ngay, bỏ qua Firestore. */
  clientSnapshot?: unknown;
  /** Giới hạn phạm vi build (forward-compat; Phase 2 build full rút gọn). */
  scope?: 'full' | 'wallets-only' | 'bills-only' | 'tasks-only';
  /** Bỏ qua cache, ép build lại. */
  forceRefresh?: boolean;
  /** Override tháng (mặc định tháng hiện tại). */
  monthKey?: string;
}

/** Context truyền vào handler từ route. */
export interface ChatHandlerContext {
  clientSnapshot?: unknown;
  /** ID phiên hội thoại — dùng cho conversation state (Phase 4). */
  sessionId?: string;
}
