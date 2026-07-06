/* ═══ Groq Client — CFO Payload/Insight Types ═══
 * Types dùng chung cho useCFOSnapshot/useCFOReport/CFOInsightCard.
 * Narrative generation (Groq call + fallback) đã chuyển sang aiMoneyChat/cfo/.
 */

/**
 * Detail của 1 danh mục cần AI chú ý — đính kèm tên + số tiền thực tế để AI
 * gợi ý cụ thể theo danh mục (vd "giảm 30% Cà phê" thay vì gợi ý chung).
 */
export interface WatchedCategoryDetail {
  name: string;
  spent: number;
  limit: number;       // 0 nếu user chưa đặt ngưỡng
  overBy: number;      // 0 nếu chưa vượt
  percent: number;     // 0..∞ — spent/limit*100, 0 nếu limit=0
  isFlagged: boolean;  // User chủ động flag ⚑
  isOver: boolean;     // System detect vượt ngưỡng
  /** Tiết kiệm tháng nếu cắt 20% — preview cho AI. */
  savingsAt20pct: number;
}

/**
 * 1 giao dịch user đã flag ⚑ riêng (per-transaction level — granular hơn category).
 * AI sẽ dùng note + categoryName để gợi ý CỤ THỂ vào hành vi user (vd "ăn sushi
 * cuối tuần" thay vì cả "Ăn uống").
 */
export interface FlaggedTransactionDetail {
  /** Tên category — "Ăn uống", "Mua sắm khác", ... */
  categoryName: string;
  /** Note user nhập khi tạo txn — vd "Sushi cuối tuần". Có thể empty. */
  note: string;
  /** Số tiền (VND). */
  amount: number;
  /** Số ngày trước (0 = hôm nay). Giúp AI hiểu mức độ recent. */
  daysAgo: number;
}

/** Snapshot data thô gửi cho AI (không kèm healthScore — AI không quyết score). */
export interface CFOPayload {
  monthlyIncome: number;
  monthlyExpense: number;
  savingsRate: number;         // 0-1 (có thể âm)
  safeToSpend: number;
  emergencyBalance: number;
  categoriesTotal: number;
  categoriesOverBudget: number;
  billsDueByNow: number;
  billsPaidOfDue: number;
  transactionCount: number;
  /**
   * Danh mục user đã flag ⚑ HOẶC system phát hiện vượt ngưỡng.
   * Cap ≤5 để giữ prompt gọn. Flagged ưu tiên trước over-budget.
   * Có thể empty array nếu không có gì cần chú ý.
   */
  watchedCategories: WatchedCategoryDetail[];
  /**
   * Top giao dịch user đã flag ⚑ riêng — sort desc by amount, cap ≤5.
   * Empty nếu user chưa flag txn nào.
   */
  topFlaggedTransactions: FlaggedTransactionDetail[];
}

/** Response cuối cùng từ /api/cfo (healthScore inject từ backend, không phải AI). */
export interface CFOInsight {
  summary: string;
  suggestions: string[];
  healthScore: number; // 0-100 (từ computeHealthScore)
  // 'ai' = Groq narrative thật; 'quick' = fallback (thiếu key hoặc Groq fail).
  // Chi tiết "no-key" vs "error" chỉ ở server log — client không cần biết.
  source: 'ai' | 'quick';
}
