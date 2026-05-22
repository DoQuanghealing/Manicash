/* ═══ Quest Metrics Collector ═══
 *
 * Đọc snapshot từ các store hiện có và tính ra metrics dùng cho:
 *   - Onboarding quest evaluation
 *   - Daily quest evaluation
 *
 * Tách riêng để dễ test + tránh import loop.
 */
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useWishlistStore } from '@/stores/useWishlistStore';
import { usePageVisitStore } from '@/stores/usePageVisitStore';
import { getDateKey, isInCurrentWeek } from '@/lib/dateHelpers';
import type { OnboardingMetric } from '@/data/onboardingQuests';
import type { DailyMetric } from '@/data/dailyQuestPool';
import type { WeeklyMetric } from '@/data/weeklyChallenges';
import type { SeasonalMetric } from '@/data/seasonalEvents';

/** Đếm số ngày unique user đã active (theo lastActiveDate + createdAt). */
function countAppOpenDays(): number {
  // Vì auth store chỉ tracking lastActiveDate, dùng streak làm xấp xỉ.
  // (Future: lưu activeDates[] để chính xác hơn.)
  const user = useAuthStore.getState().user;
  return user?.streak || 0;
}

/** Đếm giao dịch của ngày hôm nay theo type. */
function countTodayTransactions(type: 'income' | 'expense' | 'all'): number {
  const today = getDateKey(new Date());
  const txns = useFinanceStore.getState().transactions;
  return txns.filter((t) => {
    if (t.dateKey !== today) return false;
    if (type === 'all') return t.type === 'income' || t.type === 'expense';
    return t.type === type;
  }).length;
}

/** Số sub-task hoàn thành hôm nay (chính xác qua completedAt timestamp). */
function countSubtasksCompletedToday(): number {
  const tasks = useTaskStore.getState().tasks;
  const today = getDateKey(new Date());
  let count = 0;
  for (const t of tasks) {
    for (const st of t.subTasks) {
      if (st.isCompleted && st.completedAt) {
        if (getDateKey(new Date(st.completedAt)) === today) count++;
      }
    }
  }
  return count;
}

/** Collect tất cả metrics — đọc 1 lần, dùng cho onboarding + daily + weekly. */
export function collectAllMetrics(): {
  onboarding: Record<OnboardingMetric, number>;
  daily: Record<DailyMetric, number>;
  weekly: Record<WeeklyMetric, number>;
  lastMonthIncome: number;
} {
  const user = useAuthStore.getState().user;
  const wishlist = useWishlistStore.getState().items || [];
  const goals = useGoalsStore.getState().goals || [];
  const tasks = useTaskStore.getState().tasks || [];

  const expenseToday = countTodayTransactions('expense');
  const incomeToday = countTodayTransactions('income');
  const txnToday = expenseToday + incomeToday;

  // Onboarding metrics: cumulative (không reset theo ngày)
  const expenseTotal = useFinanceStore
    .getState()
    .transactions.filter((t) => t.type === 'expense').length;
  const incomeTotal = useFinanceStore
    .getState()
    .transactions.filter((t) => t.type === 'income').length;

  const profileCompleted =
    !!(user?.displayName && user.displayName.trim().length > 0 && user.yearOfBirth);

  const today = getDateKey(new Date());
  const lastActive = (user?.lastActiveDate || '').slice(0, 10);
  const streakAdvancedToday = lastActive === today ? 1 : 0;

  // Resist hôm nay từ resistByDate map mới
  const resistToday = user?.resistByDate?.[today] || 0;

  // Page visits hôm nay
  const pageVisits = usePageVisitStore.getState();

  // ── Weekly metrics ──────────────────────────────────────────
  const finance = useFinanceStore.getState();

  // saved_this_week: tổng tiền transfer kind=split vào goals/reserve/investment trong tuần
  let savedThisWeek = 0;
  for (const txn of finance.transactions) {
    if (txn.type !== 'transfer' || txn.kind !== 'split') continue;
    if (!isInCurrentWeek(txn.date)) continue;
    const split = txn.splitBreakdown;
    if (split) {
      savedThisWeek += (split.reserve || 0) + (split.goals || 0) + (split.investment || 0);
    }
  }

  // resist_count_this_week: sum resistByDate trong các ngày tuần này
  let resistThisWeek = 0;
  if (user?.resistByDate) {
    for (const [dateStr, count] of Object.entries(user.resistByDate)) {
      // dateStr là YYYY-MM-DD; parse và check isInCurrentWeek
      if (isInCurrentWeek(dateStr)) resistThisWeek += count;
    }
  }

  // tasks_completed_this_week: earning task có completedAt trong tuần này
  let tasksThisWeek = 0;
  for (const t of tasks) {
    if (t.completedAt && isInCurrentWeek(t.completedAt)) tasksThisWeek++;
  }

  // wishlist_rejected_this_week: items status=rejected với resolvedAt trong tuần
  let wishlistRejectedThisWeek = 0;
  for (const item of wishlist) {
    if (item.status === 'rejected' && item.resolvedAt && isInCurrentWeek(item.resolvedAt)) {
      wishlistRejectedThisWeek++;
    }
  }

  // lastMonthIncome: thu nhập tháng trước (dùng tính dynamic threshold)
  const now = new Date();
  const lastMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
  const lastMonthKey = `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  const lastMonthIncome = finance.getIncomeForMonth(lastMonthKey);

  return {
    onboarding: {
      profile_completed: profileCompleted ? 1 : 0,
      expense_logged_count: expenseTotal,
      income_logged_count: incomeTotal,
      wishlist_count: wishlist.length,
      goal_created: goals.length > 0 ? 1 : 0,
      earning_task_created: tasks.length > 0 ? 1 : 0,
      app_open_days: countAppOpenDays(),
      overview_visit_count: 1, // luôn 1 khi đang ở overview
    },
    daily: {
      expense_today: expenseToday,
      income_today: incomeToday,
      transactions_today: txnToday,
      resist_today: resistToday,
      subtask_today: countSubtasksCompletedToday(),
      streak_advanced: streakAdvancedToday,
      overview_opened: 1,
      budget_viewed: pageVisits.visitedToday('ledger') ? 1 : 0,
      wishlist_viewed: pageVisits.visitedToday('wishlist') ? 1 : 0,
    },
    weekly: {
      saved_this_week: savedThisWeek,
      resist_count_this_week: resistThisWeek,
      tasks_completed_this_week: tasksThisWeek,
      wishlist_rejected_this_week: wishlistRejectedThisWeek,
    },
    lastMonthIncome,
  };
}

/**
 * Tính delta metric cho seasonal event — count từ startedAt đến now.
 * Khác `collectAllMetrics` (giá trị tuyệt đối/theo period cố định).
 */
export function collectSeasonalDelta(startedAt: string): Record<SeasonalMetric, number> {
  const startTs = new Date(startedAt).getTime();
  if (!startTs) {
    return {
      event_saved: 0,
      event_resist: 0,
      event_income_logged: 0,
      event_task_completed: 0,
      event_app_days: 0,
    };
  }

  const finance = useFinanceStore.getState();
  const tasks = useTaskStore.getState().tasks || [];
  const user = useAuthStore.getState().user;

  // event_saved: tổng split vào quỹ từ startTs
  let eventSaved = 0;
  for (const txn of finance.transactions) {
    if (txn.type !== 'transfer' || txn.kind !== 'split') continue;
    if (new Date(txn.date).getTime() < startTs) continue;
    const split = txn.splitBreakdown;
    if (split) {
      eventSaved += (split.reserve || 0) + (split.goals || 0) + (split.investment || 0);
    }
  }

  // event_income_logged: số income txn từ startTs
  const eventIncomeLogged = finance.transactions.filter(
    (t) => t.type === 'income' && new Date(t.date).getTime() >= startTs
  ).length;

  // event_task_completed: earning task hoàn thành từ startTs
  const eventTaskCompleted = tasks.filter(
    (t) => t.completedAt && new Date(t.completedAt).getTime() >= startTs
  ).length;

  // event_resist: sum resistByDate từ startTs (chỉ counts theo ngày, không chính xác giờ)
  const startDateKey = getDateKey(new Date(startTs));
  let eventResist = 0;
  if (user?.resistByDate) {
    for (const [dateStr, count] of Object.entries(user.resistByDate)) {
      if (dateStr >= startDateKey) eventResist += count;
    }
  }

  // event_app_days: ước lượng qua streak (nếu streak >= delta-ngày-từ-startedAt)
  // Đơn giản: số ngày unique đã active từ startedAt = min(streak, daysSinceStart)
  const daysSinceStart = Math.floor((Date.now() - startTs) / (24 * 60 * 60 * 1000)) + 1;
  const eventAppDays = Math.min(user?.streak || 0, daysSinceStart);

  return {
    event_saved: eventSaved,
    event_resist: eventResist,
    event_income_logged: eventIncomeLogged,
    event_task_completed: eventTaskCompleted,
    event_app_days: eventAppDays,
  };
}
