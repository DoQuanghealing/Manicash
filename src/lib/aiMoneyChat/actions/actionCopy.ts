/* ═══ AI Money Chat — Action Copy Helper (Phase 4A) ═══ */

import type { MoneyActionRequest } from './actionTypes';

const TITLE: Record<MoneyActionRequest['action'], string> = {
  MARK_BILL_PAID: 'Xác nhận thanh toán hóa đơn',
  CREATE_EXPENSE: 'Xác nhận ghi khoản chi',
  CREATE_INCOME: 'Xác nhận ghi thu nhập',
};

const RISK_LABEL: Record<MoneyActionRequest['riskLevel'], string> = {
  low: 'Rủi ro thấp',
  medium: 'Rủi ro trung bình',
  high: 'Rủi ro cao — hãy kiểm tra kỹ số tiền',
};

export function getActionConfirmTitle(request: MoneyActionRequest): string {
  return TITLE[request.action];
}

export function getActionRiskLabel(request: MoneyActionRequest): string {
  return RISK_LABEL[request.riskLevel];
}
