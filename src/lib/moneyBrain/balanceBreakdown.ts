/* ═══ Money Brain — Chi tiết "Cách tính số dư khả dụng" (drill-down) ═══
 * PURE + deterministic. Cấp danh sách từng mục cho mỗi dòng breakdown trên card
 * Tổng quan (bấm dòng → xổ chi tiết). Tổng lấy từ getSafeToSpendBreakdown (single source),
 * danh sách gom trực tiếp từ snapshot → không lệch số.
 */

import type { MoneySnapshotV1 } from './types';
import { getCurrentMonthKey, getTodayKey } from './dateRange';
import { getBudgetCategoryProgress } from './budgetMetrics';
import { getSafeToSpendBreakdown } from './safeToSpend';

export interface BreakdownItem {
  label: string;
  amount: number;
  /** Ghi chú phụ (vd "trễ 2 ngày", "vượt 1.000.000đ"). */
  note?: string;
}

export interface BalanceBreakdownDetail {
  monthlyIncome: number;
  carryOver: number;
  plannedMonthlyBudget: number;
  totalUnpaidBills: number;
  plannedMonthlyGoalContributions: number;
  safeToSpend: number;
  incomes: BreakdownItem[];
  budgets: BreakdownItem[];
  unpaidBills: BreakdownItem[];
  goalContributions: BreakdownItem[];
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`;
}

/** Ghi chú hạn bill theo ngày trong tháng (so với hôm nay, cùng timezone). */
function billDueNote(dueDay: number, todayDay: number): string {
  if (dueDay < todayDay) return `trễ ${todayDay - dueDay} ngày`;
  if (dueDay === todayDay) return 'đến hạn hôm nay';
  return `còn ${dueDay - todayDay} ngày`;
}

export function getBalanceBreakdownDetail(snapshot: MoneySnapshotV1): BalanceBreakdownDetail {
  const totals = getSafeToSpendBreakdown(snapshot);
  const currentMK = getCurrentMonthKey(snapshot.clientNow, snapshot.timezone);
  const todayDay = Number(getTodayKey(snapshot.clientNow, snapshot.timezone).split('-')[2]);

  // ── Thu nhập tháng: gom theo danh mục ──
  const incomeMap = new Map<string, number>();
  for (const t of snapshot.transactions) {
    if (t.type !== 'income' || t.monthKey !== currentMK) continue;
    const label = t.categoryName || t.note || 'Thu nhập';
    incomeMap.set(label, (incomeMap.get(label) ?? 0) + t.amount);
  }
  const incomes: BreakdownItem[] = [...incomeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount }));

  // ── Ngưỡng chi tiêu: từng danh mục có hạn mức (kèm ghi chú vượt) ──
  const budgets: BreakdownItem[] = getBudgetCategoryProgress(snapshot)
    .filter((b) => b.monthlyLimit > 0)
    .map((b) => ({
      label: b.categoryName || b.categoryId,
      amount: b.monthlyLimit,
      note: b.isOverBudget ? `vượt ${money(b.spent - b.monthlyLimit)}` : undefined,
    }));

  // ── Bill chưa đóng: kèm ghi chú hạn ──
  const unpaidBills: BreakdownItem[] = snapshot.bills
    .filter((b) => !b.isPaid)
    .sort((a, b) => a.dueDay - b.dueDay)
    .map((b) => ({ label: b.name, amount: b.amount, note: billDueNote(b.dueDay, todayDay) }));

  // ── Tiết kiệm/tháng: từng mục tiêu có khoản đều hàng tháng ──
  const goalContributions: BreakdownItem[] = snapshot.goals
    .filter((g) => (g.monthlyContributionTarget ?? 0) > 0)
    .map((g) => ({ label: g.name, amount: g.monthlyContributionTarget as number }));

  return {
    monthlyIncome: totals.monthlyIncome,
    carryOver: totals.carryOver,
    plannedMonthlyBudget: totals.plannedMonthlyBudget,
    totalUnpaidBills: totals.totalUnpaidBills,
    plannedMonthlyGoalContributions: totals.plannedMonthlyGoalContributions,
    safeToSpend: totals.safeToSpend,
    incomes,
    budgets,
    unpaidBills,
    goalContributions,
  };
}
