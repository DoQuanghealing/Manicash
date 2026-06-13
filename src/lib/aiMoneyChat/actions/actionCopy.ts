/* ═══ AI Money Chat — Action Copy Helper (Phase 4A) ═══ */

import type { MoneyActionRequest } from './actionTypes';

const TITLE: Record<MoneyActionRequest['action'], string> = {
  MARK_BILL_PAID: 'Xác nhận thanh toán hóa đơn',
  CREATE_EXPENSE: 'Xác nhận ghi khoản chi',
  CREATE_INCOME: 'Xác nhận ghi thu nhập',
  CREATE_FIXED_BILL: 'Tạo bill cố định',
  SET_CATEGORY_BUDGET: 'Đặt ngân sách danh mục',
  ADD_GOAL_DEPOSIT: 'Nạp tiền vào mục tiêu',
  CREATE_EARNING_TASK: 'Tạo nhiệm vụ kiếm tiền',
  COMPLETE_EARNING_TASK: 'Hoàn thành nhiệm vụ kiếm tiền',
  ADD_WISHLIST_ITEM: 'Thêm vào wishlist',
  FLAG_TRANSACTION: 'Gắn cờ giao dịch',
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
