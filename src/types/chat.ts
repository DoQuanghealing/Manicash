/* ═══ Chat types (dùng chung component + store lịch sử) ═══ */

export interface ChatReceipt {
  txnType: 'income' | 'expense';
  amount: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  todayIncome: number;
  todayExpense: number;
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  /** True nếu text là markdown (báo cáo CFO) -> render định dạng. */
  markdown?: boolean;
  /** Phiếu ghi nhận thu/chi gọn + tổng thu/chi trong ngày (render badge màu). */
  receipt?: ChatReceipt;
  /** ISO timestamp (Phase I) — để lưu lịch sử theo ngày + tự xóa sau 7 ngày. */
  createdAt?: string;
}
