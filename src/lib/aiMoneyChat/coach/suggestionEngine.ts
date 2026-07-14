/* ═══ Coach — Engine sinh đề xuất chủ động (PV-2) ═══
 * PURE + deterministic. Gom tín hiệu tài chính trong app → danh sách đề xuất đã xếp
 * ưu tiên. Component chỉ hiện đề xuất ĐẦU (không nài), dạng card xin phép — KHÔNG tự
 * thực thi thay đổi tiền (ETHICS_CHARTER §1.6). Chỉ dùng cho tier Phú Vương (gate ở component).
 */

import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import {
  getSafeToSpendBreakdown,
  getOverBudgetCategories,
  getExpenseForPeriod,
  getExpectedIncomePipeline,
  getActualTaskIncomeForPeriod,
  getPlannedMonthlyGoalContributions,
  getTodayKey,
} from '@/lib/moneyBrain';

export type CoachSuggestionType =
  | 'negative-safe'
  | 'overspend'
  | 'bill-due'
  | 'thin-emergency'
  | 'no-extra-income'
  | 'idle-surplus'
  | 'streak-praise';

export type CoachTone = 'urgent' | 'warn' | 'info' | 'positive';

export interface CoachSuggestion {
  /** ID ổn định theo loại (dùng cho dedup + cooldown). */
  id: CoachSuggestionType;
  priority: number;
  emoji: string;
  tone: CoachTone;
  title: string;
  body: string;
  actionLabel?: string;
  actionTarget?: string;
}

const IDLE_SURPLUS_THRESHOLD = 3_000_000;
const BILL_DUE_SOON_DAYS = 3;

function money(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString('vi-VN')}đ`;
}

/** Sinh danh sách đề xuất, xếp ưu tiên giảm dần. Xưng hô để component chèn (mặc định "ngài"). */
export function generateCoachSuggestions(snapshot: MoneySnapshotV1, addr = 'ngài'): CoachSuggestion[] {
  const out: CoachSuggestion[] = [];

  const breakdown = getSafeToSpendBreakdown(snapshot);
  const safe = breakdown.safeToSpend;
  const monthlyExpense = getExpenseForPeriod(snapshot, 'this_month');
  const emergency = snapshot.wallets.emergency;
  const over = getOverBudgetCategories(snapshot);
  const overAmount = over.reduce((s, c) => s + Math.max(0, c.spent - c.monthlyLimit), 0);
  const extraIncome =
    getExpectedIncomePipeline(snapshot) + getActualTaskIncomeForPeriod(snapshot, 'this_month');
  const goalContrib = getPlannedMonthlyGoalContributions(snapshot);
  const streak = snapshot.user?.streak ?? 0;
  const todayDay = Number(getTodayKey(snapshot.clientNow, snapshot.timezone).split('-')[2]);

  // ── Số dư khả dụng âm (khẩn nhất) ──
  if (safe < 0) {
    out.push({
      id: 'negative-safe', priority: 100, emoji: '🔴', tone: 'urgent',
      title: 'Số dư khả dụng đang âm',
      body: `${addr} đang chi nhiều hơn thu ${money(safe)}. Tôi cùng ${addr} lên kế hoạch kiếm thêm nhé?`,
      actionLabel: 'Tạo nguồn thu', actionTarget: '/money',
    });
  }

  // ── Bill sắp/đang tới hạn ──
  const dueSoon = snapshot.bills.filter((b) => !b.isPaid && b.dueDay - todayDay <= BILL_DUE_SOON_DAYS);
  if (dueSoon.length > 0) {
    const overdue = dueSoon.some((b) => b.dueDay < todayDay);
    out.push({
      id: 'bill-due', priority: 88, emoji: '📋', tone: overdue ? 'urgent' : 'warn',
      title: overdue ? 'Có bill đang trễ hạn' : 'Bill sắp tới hạn',
      body: `${dueSoon.length} bill cần ${addr} để mắt tới. Đóng sớm cho nhẹ đầu nhé.`,
      actionLabel: 'Xem & thanh toán', actionTarget: '/ledger?tab=bills',
    });
  }

  // ── Chi vượt ngưỡng ──
  if (over.length > 0) {
    out.push({
      id: 'overspend', priority: 80, emoji: '⚠️', tone: 'warn',
      title: 'Chi tiêu vượt ngưỡng',
      body: `${addr} đã vượt ${money(overAmount)} ở ${over.length} nhóm. Xem lại để siết một chút?`,
      actionLabel: 'Xem khoản vượt', actionTarget: '/ledger?tab=categories',
    });
  }

  // ── Quỹ khẩn cấp mỏng ──
  if (monthlyExpense > 0 && emergency < monthlyExpense) {
    out.push({
      id: 'thin-emergency', priority: 60, emoji: '🛟', tone: 'info',
      title: 'Quỹ khẩn cấp còn mỏng',
      body: `Quỹ khẩn cấp chưa đủ 1 tháng chi tiêu. Dành một ít mỗi tháng cho ${addr} an tâm hơn nhé?`,
      actionLabel: 'Đặt mục tiêu quỹ', actionTarget: '/goals',
    });
  }

  // ── Chưa có nguồn thu tăng thêm ──
  if (extraIncome <= 0) {
    out.push({
      id: 'no-extra-income', priority: 55, emoji: '💼', tone: 'info',
      title: 'Thử tạo nguồn thu tăng thêm',
      body: `Ngoài thu nhập cố định, một nhiệm vụ kiếm tiền nhỏ có thể giúp ${addr} bứt phá. Thử nhé?`,
      actionLabel: 'Xem mục Money', actionTarget: '/money',
    });
  }

  // ── Dư dả nhưng chưa đặt mục tiêu ──
  if (safe > IDLE_SURPLUS_THRESHOLD && goalContrib <= 0) {
    out.push({
      id: 'idle-surplus', priority: 40, emoji: '🎯', tone: 'info',
      title: 'Số dư đang dư dả',
      body: `${addr} còn ${money(safe)} khả dụng. Đặt một mục tiêu để tiền có đích đến nhé?`,
      actionLabel: 'Tạo mục tiêu', actionTarget: '/goals',
    });
  }

  // ── Khen streak (tích cực, thấp nhất) ──
  if (streak >= 7 && streak % 7 === 0) {
    out.push({
      id: 'streak-praise', priority: 20, emoji: '🔥', tone: 'positive',
      title: `Streak ${streak} ngày!`,
      body: `${addr} giữ thói quen ghi chép ${streak} ngày liền — thuộc nhóm top. Cứ đà này nhé!`,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
