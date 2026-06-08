/* ═══ AI Money Chat — Client Snapshot Builder (FE wiring) ═══
 * Đóng gói dữ liệu Zustand (client) thành ClientSnapshotInput để POST lên
 * /api/chat. Pure function (không đụng store trực tiếp) -> dễ test.
 *
 * Server (snapshotBuilder.validateClientSnapshot) sẽ validate + coerce lại,
 * nên ở đây chỉ cần map shape cho gọn.
 */

import { getMonthKeyFromDate, getCurrentMonthKey } from '@/lib/dateHelpers';
import { getDateKey, getMonthKey, getISOWeekKey } from '@/lib/moneyBrain/dateRange';
import type { Transaction, FixedBill } from '@/stores/useFinanceStore';
import type { EarningTask } from '@/types/task';
import type { Goal, CategoryBudget } from '@/types/budget';
import type { ClientSnapshotInput } from './aggregation/types';

export interface BuildClientSnapshotParams {
  wallets: { main: number; emergency: number; billFund: number };
  transactions: Transaction[];
  fixedBills: FixedBill[];
  tasks: EarningTask[];
  goals: Goal[];
  categoryBudgets: CategoryBudget[];
  /** Map categoryId -> tên hiển thị (để LLM đọc tên thay vì id). */
  categoryName: (id: string) => string;
  /** Dư tháng trước (carryOver) — cho safe-to-spend. */
  carryOver?: number;
  /** "Bây giờ" theo client (ISO). Mặc định new Date(). Inject để test ổn định. */
  clientNow?: string;
  /** Timezone client. Mặc định lấy từ Intl, fallback Asia/Ho_Chi_Minh. */
  timezone?: string;
}

const HISTORY_MONTHS = 3;

function resolveTimezone(tz?: string): string {
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}

export function buildClientSnapshot(params: BuildClientSnapshotParams): ClientSnapshotInput {
  const monthKey = getCurrentMonthKey();
  const timezone = resolveTimezone(params.timezone);
  const clientNow = params.clientNow ?? new Date().toISOString();

  // Giao dịch tháng hiện tại — kèm date keys (tz client) để lọc theo ngày/tuần.
  const transactions = params.transactions
    .filter((t) => getMonthKeyFromDate(t.date) === monthKey)
    .map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      categoryName: params.categoryName(t.categoryId),
      wallet: t.wallet,
      // Transfer: ví đích = t.wallet -> để server tính savings (toWallet != main).
      toWallet: t.type === 'transfer' ? t.wallet : undefined,
      note: t.note,
      date: t.date,
      dateKey: getDateKey(t.date, timezone),
      weekKey: getISOWeekKey(t.date, timezone),
      monthKey: getMonthKey(t.date, timezone),
      time: t.time,
    }));

  // Lịch sử 3 tháng trước (chi theo danh mục) cho z-score anomaly.
  const byMonth = new Map<string, Record<string, number>>();
  for (const t of params.transactions) {
    if (t.type !== 'expense') continue;
    const mk = getMonthKeyFromDate(t.date);
    if (mk >= monthKey) continue; // chỉ tháng trước
    const rec = byMonth.get(mk) ?? {};
    rec[t.categoryId] = (rec[t.categoryId] ?? 0) + t.amount;
    byMonth.set(mk, rec);
  }
  const history = Array.from(byMonth.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // mới nhất trước
    .slice(0, HISTORY_MONTHS)
    .map(([mk, categorySpend]) => ({ monthKey: mk, categorySpend }));

  return {
    version: 'money_snapshot_v1',
    clientNow,
    timezone,
    monthKey,
    carryOver: params.carryOver,
    wallets: {
      main: params.wallets.main,
      emergency: params.wallets.emergency,
      billFund: params.wallets.billFund,
    },
    bills: params.fixedBills.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      isPaid: b.isPaid,
    })),
    tasks: params.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      expectedAmount: t.expectedAmount,
      startDate: t.startDate,
      endDate: t.endDate,
      completedAt: t.completedAt,
      deletedAt: t.deletedAt,
      subTasks: t.subTasks.map((s) => ({ isCompleted: s.isCompleted })),
    })),
    transactions,
    history,
    budgets: params.categoryBudgets
      .filter((b) => b.month === monthKey)
      .map((b) => ({
        categoryId: b.categoryId,
        name: params.categoryName(b.categoryId),
        limit: b.monthlyLimit,
      })),
    goals: params.goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.currentAmount,
      deadline: g.deadline,
      monthlyContributionTarget: g.monthlyContributionTarget,
    })),
  };
}
