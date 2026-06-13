/* ═══ AI Money Chat — Action Protocol Types (Phase 4A) ═══
 * Client-executed action protocol: server CHỈ tạo actionRequest, KHÔNG execute.
 * Client confirm rồi mới gọi Zustand action.
 */

export type MoneyActionType =
  | 'MARK_BILL_PAID'
  | 'CREATE_EXPENSE'
  | 'CREATE_INCOME'
  // Phase 4B
  | 'CREATE_FIXED_BILL'
  | 'SET_CATEGORY_BUDGET'
  | 'ADD_GOAL_DEPOSIT'
  | 'CREATE_EARNING_TASK'
  | 'COMPLETE_EARNING_TASK'
  | 'ADD_WISHLIST_ITEM'
  | 'FLAG_TRANSACTION';

export type MoneyActionStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export type MoneyActionRiskLevel = 'low' | 'medium' | 'high';

export interface BaseMoneyActionRequest {
  type: 'action_request';
  action: MoneyActionType;
  requestId: string;
  createdAt: string;
  expiresAt: string;
  snapshotVersion: 'money_snapshot_v1';
  preview: string;
  requiresConfirmation: true;
  status: 'pending_confirmation';
  riskLevel: MoneyActionRiskLevel;
}

export interface MarkBillPaidPayload {
  billId: string;
  billName: string;
  amount: number;
  dueDay?: number;
}

export interface CreateExpensePayload {
  amount: number;
  categoryId: string;
  categoryName?: string;
  note?: string;
  wallet?: 'main' | 'emergency' | 'bill-fund';
  dateKey?: string;
}

export interface CreateIncomePayload {
  amount: number;
  categoryId?: string;
  categoryName?: string;
  note?: string;
  wallet?: 'main' | 'emergency' | 'bill-fund';
  dateKey?: string;
}

// ─── Phase 4B payloads ───────────────────────────────────────────────────────

export interface CreateFixedBillPayload {
  name: string;
  amount: number;
  dueDay: number;
  icon?: string;
}

export interface SetCategoryBudgetPayload {
  categoryId: string;
  categoryName?: string;
  monthlyLimit: number;
}

export interface AddGoalDepositPayload {
  goalId: string;
  goalName: string;
  amount: number;
  source?: string;
  note?: string;
}

export interface CreateEarningTaskPayload {
  name: string;
  description?: string;
  expectedAmount: number;
  startDate?: string;
  endDate: string;
  subTasks?: Array<{ name: string }>;
}

export interface CompleteEarningTaskPayload {
  taskId: string;
  taskName: string;
  expectedAmount: number;
  actualAmount?: number;
}

export interface AddWishlistItemPayload {
  name: string;
  expectedPrice?: number;
  reason?: string;
  cooldownHours?: number;
}

export interface FlagTransactionPayload {
  transactionId: string;
  amount?: number;
  categoryId?: string;
  categoryName?: string;
  note?: string;
  dateKey?: string;
  reason?: string;
}

export type MoneyActionRequest =
  | (BaseMoneyActionRequest & { action: 'MARK_BILL_PAID'; payload: MarkBillPaidPayload })
  | (BaseMoneyActionRequest & { action: 'CREATE_EXPENSE'; payload: CreateExpensePayload })
  | (BaseMoneyActionRequest & { action: 'CREATE_INCOME'; payload: CreateIncomePayload })
  | (BaseMoneyActionRequest & { action: 'CREATE_FIXED_BILL'; payload: CreateFixedBillPayload })
  | (BaseMoneyActionRequest & { action: 'SET_CATEGORY_BUDGET'; payload: SetCategoryBudgetPayload })
  | (BaseMoneyActionRequest & { action: 'ADD_GOAL_DEPOSIT'; payload: AddGoalDepositPayload })
  | (BaseMoneyActionRequest & { action: 'CREATE_EARNING_TASK'; payload: CreateEarningTaskPayload })
  | (BaseMoneyActionRequest & { action: 'COMPLETE_EARNING_TASK'; payload: CompleteEarningTaskPayload })
  | (BaseMoneyActionRequest & { action: 'ADD_WISHLIST_ITEM'; payload: AddWishlistItemPayload })
  | (BaseMoneyActionRequest & { action: 'FLAG_TRANSACTION'; payload: FlagTransactionPayload });

/** Ngưỡng chi tiêu phải đi qua BreathGate (nhập chậm ở tab Nhập). */
export const BREATH_GATE_THRESHOLD = 3_000_000;
