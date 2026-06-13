/* ═══ AI Money Chat — Action Protocol Types (Phase 4A) ═══
 * Client-executed action protocol: server CHỈ tạo actionRequest, KHÔNG execute.
 * Client confirm rồi mới gọi Zustand action.
 */

export type MoneyActionType = 'MARK_BILL_PAID' | 'CREATE_EXPENSE' | 'CREATE_INCOME';

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

export type MoneyActionRequest =
  | (BaseMoneyActionRequest & { action: 'MARK_BILL_PAID'; payload: MarkBillPaidPayload })
  | (BaseMoneyActionRequest & { action: 'CREATE_EXPENSE'; payload: CreateExpensePayload })
  | (BaseMoneyActionRequest & { action: 'CREATE_INCOME'; payload: CreateIncomePayload });

/** Ngưỡng chi tiêu phải đi qua BreathGate (nhập chậm ở tab Nhập). */
export const BREATH_GATE_THRESHOLD = 3_000_000;
