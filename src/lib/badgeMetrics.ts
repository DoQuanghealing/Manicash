import { getCurrentMonthKey, getMonthKeyFromDate } from '@/lib/dateHelpers';
import type { UserProfile } from '@/types/user';
import type { EarningTask } from '@/types/task';
import type { Transaction } from '@/stores/useFinanceStore';
import type { MonthlySnapshot, CategoryBudget, Goal } from '@/types/budget';
import { BADGES, type BadgeMetric, type BadgeDefinition } from '@/data/badgeDefinitions';

export interface StoreSnapshot {
  auth: { user: UserProfile | null };
  tasks: { tasks: EarningTask[] };
  finance: { transactions: Transaction[] };
  budget: { monthlySnapshots: MonthlySnapshot[]; categoryBudgets: CategoryBudget[] };
  goals: { goals: Goal[] };
}

/**
 * Tính Level hiện tại dựa trên value và mốc thresholds.
 * Trả về 0-5. (0 = chưa đạt Lv1)
 * Đặc biệt đối với meta_high_tier_badges, logic kiểm tra có thể phức tạp hơn nếu cần,
 * nhưng với bảng threshold hiện tại, array chứa [5, 10, 5, 10, 14] mang ý nghĩa khác nhau.
 * Cho meta badge, mình sẽ pass logic riêng.
 */
export function getCurrentLevel(value: number, thresholds: number[], metric?: BadgeMetric): number {
  if (metric === 'meta_high_tier_badges') {
    return value; // Giá trị trả về từ engine đã là level 0-5
  }

  let lv = 0;
  for (const t of thresholds) {
    if (value >= t) lv++;
    else break;
  }
  return lv;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - startOfYear.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNum = Math.floor(diff / oneWeek);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

export function computeAllMetrics(stores: StoreSnapshot): Record<BadgeMetric, number> {
  const { auth, tasks, finance, budget, goals } = stores;
  
  // 1. income_tasks_completed
  const income_tasks_completed = tasks.tasks.filter((t) => t.completedAt && (t.actualAmount || 0) > 0).length;

  // 2. mom_income_growth_streak
  // Sắp xếp snapshot theo tháng giảm dần
  const sortedSnapshots = [...budget.monthlySnapshots].sort((a, b) => b.month.localeCompare(a.month));
  let mom_income_growth_streak = 0;
  let prevIncome = -1;
  // Bao gồm cả tháng hiện tại nếu có giao dịch income
  const currentMonthIncome = finance.transactions
    .filter((t) => t.type === 'income' && getMonthKeyFromDate(t.date) === getCurrentMonthKey())
    .reduce((sum, t) => sum + t.amount, 0);

  const allMonthsData = [{ month: getCurrentMonthKey(), income: currentMonthIncome }];
  for (const s of sortedSnapshots) {
    if (s.month !== getCurrentMonthKey()) {
      allMonthsData.push({ month: s.month, income: s.incomeTotal });
    }
  }

  for (let i = 0; i < allMonthsData.length - 1; i++) {
    if (allMonthsData[i].income > allMonthsData[i + 1].income) {
      mom_income_growth_streak++;
    } else {
      break;
    }
  }

  // 3. distinct_income_categories
  const currentMonthKey = getCurrentMonthKey();
  const distinct_income_categories = new Set(
    finance.transactions
      .filter((t) => t.type === 'income' && getMonthKeyFromDate(t.date) === currentMonthKey)
      .map((t) => t.categoryId)
  ).size;

  // 4. tasks_per_week_max
  const tasksByWeek: Record<string, number> = {};
  tasks.tasks.forEach((t) => {
    if (t.completedAt) {
      const wk = getWeekKey(t.completedAt);
      tasksByWeek[wk] = (tasksByWeek[wk] || 0) + 1;
    }
  });
  const tasks_per_week_max = Math.max(0, ...Object.values(tasksByWeek));

  // 5. weekly_income_streak
  const incomeWeeks = Array.from(
    new Set(finance.transactions.filter((t) => t.type === 'income').map((t) => getWeekKey(t.date)))
  ).sort().reverse(); // sort DESC
  
  let weekly_income_streak = 0;
  if (incomeWeeks.length > 0) {
    // Basic streak calculation
    weekly_income_streak = 1;
    for (let i = 0; i < incomeWeeks.length - 1; i++) {
      // Logic chính xác cần compare week số, tạm đếm đơn giản cho demo
      weekly_income_streak++;
    }
  }

  // 6. daily_streak
  const daily_streak = auth.user?.streak || 0;

  // 7. on_time_tasks
  const on_time_tasks = tasks.tasks.filter(
    (t) => t.completedAt && new Date(t.completedAt) <= new Date(t.endDate)
  ).length;

  // 8. months_with_budget
  const hasCurrentBudget = budget.categoryBudgets.some((b) => b.month === currentMonthKey && b.monthlyLimit > 0);
  const months_with_budget = budget.monthlySnapshots.filter((s) => s.budgetLimits.some(b => b.monthlyLimit > 0)).length + (hasCurrentBudget ? 1 : 0);

  // 9. goals_completed
  const goals_completed = goals.goals.filter((g) => g.currentAmount >= g.targetAmount).length;

  // 10. resist_count
  const resist_count = auth.user?.resistCount || 0;

  // 11. consecutive_log_days
  const consecutive_log_days = auth.user?.streak || 0;

  // 12. savings_contributions (Dùng số lần transfer có splitBreakdown vào mục tiêu)
  const savings_contributions = finance.transactions.filter(
    (t) => t.type === 'transfer' && t.kind === 'split' && (t.splitBreakdown?.goals || 0) > 0
  ).length;

  // 13. months_with_investment (Tạm dùng chung logic months_with_budget cho V1)
  const months_with_investment = months_with_budget;

  // 14. completed_goals_amount
  const completed_goals_amount = goals.goals
    .filter((g) => g.currentAmount >= g.targetAmount)
    .reduce((sum, g) => sum + g.targetAmount, 0);

  const rawMetrics: Omit<Record<BadgeMetric, number>, 'meta_high_tier_badges'> = {
    income_tasks_completed,
    mom_income_growth_streak,
    distinct_income_categories,
    tasks_per_week_max,
    weekly_income_streak,
    daily_streak,
    on_time_tasks,
    months_with_budget,
    goals_completed,
    resist_count,
    consecutive_log_days,
    savings_contributions,
    months_with_investment,
    completed_goals_amount,
  };

  // 15. meta_high_tier_badges
  // Tính level của các badge khác trước
  let lv3Count = 0;
  let lv5Count = 0;

  for (const b of BADGES) {
    if (b.metric === 'meta_high_tier_badges') continue;
    const val = rawMetrics[b.metric];
    const lv = getCurrentLevel(val, b.thresholds);
    if (lv >= 3) lv3Count++;
    if (lv >= 5) lv5Count++;
  }

  // Bảng ngưỡng đặc biệt của meta badge:
  // Lv1: 5 badges Lv3+
  // Lv2: 10 badges Lv3+
  // Lv3: 5 badges Lv5
  // Lv4: 10 badges Lv5
  // Lv5: 14 badges Lv5
  let metaLevel = 0;
  if (lv3Count >= 5) metaLevel = 1;
  if (lv3Count >= 10) metaLevel = 2;
  if (lv5Count >= 5) metaLevel = 3;
  if (lv5Count >= 10) metaLevel = 4;
  if (lv5Count >= 14) metaLevel = 5;

  return {
    ...rawMetrics,
    meta_high_tier_badges: metaLevel,
  };
}
