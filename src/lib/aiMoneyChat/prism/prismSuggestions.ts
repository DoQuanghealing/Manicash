/* ═══ PRISM (Lõi Kim Cương) — Gợi ý inline + Lệnh "/" (P2) ═══
 *
 * Thuần client, offline. Hai thứ:
 *  1) suggestForIntent(intent) -> 2-3 nút gợi ý hành động tiếp theo (chip) khoác
 *     dưới câu trả lời, dẫn dắt người dùng (phong cách Telegram bot).
 *  2) SLASH_COMMANDS + resolveSlashCommand() -> bảng lệnh "/" ánh xạ sang câu hỏi
 *     tự nhiên mà PRISM trả lời được ngay (đa số offline; /baocao đi server).
 *
 * Mọi `query` đều là câu tiếng Việt tự nhiên -> đi qua đúng pipeline parseInput
 * (PRISM offline trước, khó mới lên /api/chat). KHÔNG hardcode câu trả lời.
 */

import type { ChatSuggestion } from '@/types/chat';
import type { ChatIntentType } from '../intent/types';

/** Các câu hỏi "hạt giống" tái dùng để dựng gợi ý — giữ DRY. */
const Q = {
  balance: { label: 'Số dư các ví', query: 'tôi còn bao nhiêu tiền', icon: '💰' },
  safeToSpend: { label: 'An toàn chi tiêu', query: 'tháng này còn bao nhiêu để xài', icon: '🛡️' },
  spendToday: { label: 'Chi hôm nay', query: 'hôm nay tôi đã chi bao nhiêu', icon: '🧾' },
  overBudget: { label: 'Danh mục vượt ngân sách', query: 'danh mục nào vượt ngân sách', icon: '📊' },
  bills: { label: 'Hóa đơn sắp tới', query: 'bill nào sắp tới hạn', icon: '📋' },
  goals: { label: 'Tiến độ mục tiêu', query: 'mục tiêu của tôi tới đâu rồi', icon: '🎯' },
  health: { label: 'Sức khỏe tài chính', query: 'điểm sức khỏe tài chính của tôi', icon: '❤️' },
  cfo: { label: 'Báo cáo CFO tháng', query: 'lên báo cáo CFO tháng này', icon: '📈' },
} satisfies Record<string, ChatSuggestion>;

const DEFAULT_SUGGESTIONS: ChatSuggestion[] = [Q.balance, Q.safeToSpend, Q.goals];

/** Bản đồ intent -> gợi ý tiếp theo (2-3 cái, không lặp chính nó). */
const BY_INTENT: Partial<Record<ChatIntentType, ChatSuggestion[]>> = {
  QUERY_BALANCE: [Q.safeToSpend, Q.bills, Q.goals],
  QUERY_INCOME: [Q.spendToday, Q.safeToSpend, Q.goals],
  QUERY_SAFE_TO_SPEND: [Q.spendToday, Q.overBudget, Q.health],
  QUERY_SPENDING: [Q.safeToSpend, Q.overBudget, Q.health],
  QUERY_BILL_STATUS: [Q.balance, Q.safeToSpend, Q.goals],
  QUERY_UPCOMING_BILLS: [Q.balance, Q.safeToSpend],
  QUERY_BILL_COVERAGE: [Q.balance, Q.safeToSpend],
  QUERY_BUDGET_STATUS: [Q.spendToday, Q.safeToSpend, Q.health],
  QUERY_CATEGORY_SPENDING: [Q.spendToday, Q.safeToSpend, Q.health],
  QUERY_SAVINGS: [Q.goals, Q.health, Q.balance],
  QUERY_GOAL_PROGRESS: [Q.balance, Q.safeToSpend, Q.health],
  QUERY_HEALTH_SCORE: [Q.safeToSpend, Q.overBudget, Q.cfo],
  QUERY_TASKS_TODAY: [Q.balance, Q.goals, Q.safeToSpend],
  QUERY_EARNING_PIPELINE: [Q.balance, Q.goals, Q.safeToSpend],
  QUERY_STREAK: [Q.balance, Q.health, Q.goals],
  CFO_REPORT: [Q.safeToSpend, Q.overBudget, Q.goals],
  ANALYZE_FINANCE: [Q.health, Q.safeToSpend, Q.goals],
  ADVICE_CUT_SPENDING: [Q.overBudget, Q.safeToSpend, Q.health],
};

/** Gợi ý hành động tiếp theo theo intent. Luôn trả ít nhất 2 chip. */
export function suggestForIntent(intent?: ChatIntentType | string): ChatSuggestion[] {
  if (intent && intent in BY_INTENT) {
    const list = BY_INTENT[intent as ChatIntentType];
    if (list && list.length > 0) return list;
  }
  return DEFAULT_SUGGESTIONS;
}

/* ─────────── Bảng lệnh "/" ─────────── */

export interface SlashCommand {
  /** Cú pháp gõ, vd "/sodu". */
  cmd: string;
  /** Nhãn hiển thị trong menu. */
  label: string;
  /** Câu hỏi tự nhiên gửi đi khi chọn. */
  query: string;
  icon: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: '/sodu', label: 'Số dư các ví', query: 'tôi còn bao nhiêu tiền', icon: '💰' },
  { cmd: '/antoan', label: 'An toàn chi tiêu tháng', query: 'tháng này còn bao nhiêu để xài', icon: '🛡️' },
  { cmd: '/chitieu', label: 'Chi tiêu hôm nay', query: 'hôm nay tôi đã chi bao nhiêu', icon: '🧾' },
  { cmd: '/bill', label: 'Hóa đơn sắp tới', query: 'bill nào sắp tới hạn', icon: '📋' },
  { cmd: '/muctieu', label: 'Tiến độ mục tiêu', query: 'mục tiêu của tôi tới đâu rồi', icon: '🎯' },
  { cmd: '/suckhoe', label: 'Sức khỏe tài chính', query: 'điểm sức khỏe tài chính của tôi', icon: '❤️' },
  { cmd: '/baocao', label: 'Báo cáo CFO tháng', query: 'lên báo cáo CFO tháng này', icon: '📈' },
];

/** Lọc lệnh theo chuỗi sau dấu "/" (prefix cmd hoặc khớp nhãn). */
export function filterSlashCommands(rawInput: string): SlashCommand[] {
  if (!rawInput.startsWith('/')) return [];
  const q = rawInput.slice(1).trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.cmd.slice(1).startsWith(q) || c.label.toLowerCase().includes(q),
  );
}

/**
 * Ánh xạ một câu lệnh "/..." sang câu hỏi tự nhiên.
 * Khớp khi token đầu = đúng cmd (vd "/sodu"). Trả null nếu không khớp lệnh nào.
 */
export function resolveSlashCommand(rawInput: string): string | null {
  const token = rawInput.trim().split(/\s+/)[0]?.toLowerCase();
  if (!token || !token.startsWith('/')) return null;
  const hit = SLASH_COMMANDS.find((c) => c.cmd === token);
  return hit ? hit.query : null;
}
