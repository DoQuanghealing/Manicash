/* ═══ Chat types (dùng chung component + store lịch sử) ═══ */

import type { CapacityResult } from '@/lib/aiMoneyChat/prism/capacity/capacityEngine';

export interface ChatReceipt {
  txnType: 'income' | 'expense';
  amount: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  todayIncome: number;
  todayExpense: number;
  description?: string;
}

/** P2 — nút gợi ý inline dưới câu trả lời (bấm để hỏi tiếp). */
export interface ChatSuggestion {
  /** Nhãn hiển thị trên chip. */
  label: string;
  /** Câu sẽ gửi khi bấm (đi qua PRISM offline-first). */
  query: string;
  /** Emoji đầu chip. */
  icon?: string;
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
  /** P2 — gợi ý hành động tiếp theo (chỉ render ở tin nhắn mới nhất). */
  suggestions?: ChatSuggestion[];
  /** P5 — kết quả đo năng lực (render thẻ radar). */
  capacity?: CapacityResult;
  /** P6a — render thẻ khảo sát năng lực. */
  survey?: boolean;
}
