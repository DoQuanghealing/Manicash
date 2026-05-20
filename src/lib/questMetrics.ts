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
import { getDateKey } from '@/lib/dateHelpers';
import type { OnboardingMetric } from '@/data/onboardingQuests';
import type { DailyMetric } from '@/data/dailyQuestPool';

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

/** Số sub-task hoàn thành hôm nay (xấp xỉ qua isCompleted, không có timestamp riêng). */
function countSubtasksCompletedToday(): number {
  // Task store hiện tại không tracking khi sub-task được tick. Tạm dùng tổng
  // sub-task completed như xấp xỉ — sẽ cải thiện khi thêm completedAt cho sub-task.
  const tasks = useTaskStore.getState().tasks;
  let count = 0;
  for (const t of tasks) {
    if (t.completedAt) continue; // task chính chưa xong
    for (const st of t.subTasks) {
      if (st.isCompleted) count++;
    }
  }
  // Trả 0 nếu không có sub-task vừa tick — daily quest sẽ chờ
  // user thực sự tick để engine tăng. Đây là limitation hiện tại.
  // Workaround: dùng total > baseline (đã handle bằng baselineValue trong instance).
  return count;
}

/** Collect tất cả metrics — đọc 1 lần, dùng cho cả onboarding & daily. */
export function collectAllMetrics(): {
  onboarding: Record<OnboardingMetric, number>;
  daily: Record<DailyMetric, number>;
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
      resist_today: 0,        // future: cần resistEvents[] có timestamp
      subtask_today: countSubtasksCompletedToday(),
      streak_advanced: streakAdvancedToday,
      overview_opened: 1,
      budget_viewed: 0,       // future: cần page visit tracking
      wishlist_viewed: 0,     // future: cần page visit tracking
    },
  };
}
