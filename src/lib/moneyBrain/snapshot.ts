/* ═══ Money Brain — Snapshot Adapter (Phase 0) ═══
 * Chuyển ClientSnapshotInput (shape client cũ, mọi field optional) -> MoneySnapshotV1.
 * Đây là BOUNDARY shim: chuẩn hoá category, điền date keys theo timezone client.
 *
 * Lưu ý: fallback clientNow = new Date() CHỈ xảy ra khi client không gửi clientNow
 * (legacy). Engine tính period luôn đọc snapshot.clientNow, không tự lấy giờ.
 */

import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { getDateKey, getMonthKey, getISOWeekKey } from './dateRange';
import { normalizeCategoryId } from './normalize';
import type {
  MoneySnapshotV1,
  MoneyTxnType,
  MoneyTransactionSnapshot,
} from './types';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function coerceType(t: unknown): MoneyTxnType {
  return t === 'income' || t === 'transfer' ? t : 'expense';
}

export function toMoneySnapshotV1(input: ClientSnapshotInput): MoneySnapshotV1 {
  const timezone = input.timezone || DEFAULT_TZ;
  // Fallback chỉ cho legacy snapshot thiếu clientNow.
  const clientNow = input.clientNow || new Date().toISOString();

  const transactions: MoneyTransactionSnapshot[] = (input.transactions ?? []).map((t, i) => {
    const date = t.date || clientNow;
    return {
      id: t.id ?? `tx-${i}`,
      type: coerceType(t.type),
      amount: num(t.amount),
      categoryId: normalizeCategoryId(t.categoryId),
      categoryName: t.categoryName,
      wallet: t.wallet,
      toWallet: t.toWallet,
      note: t.note,
      date,
      dateKey: t.dateKey || getDateKey(date, timezone),
      weekKey: t.weekKey || getISOWeekKey(date, timezone),
      monthKey: t.monthKey || getMonthKey(date, timezone),
      time: t.time,
    };
  });

  return {
    version: 'money_snapshot_v1',
    clientNow,
    timezone,
    wallets: {
      main: num(input.wallets?.main),
      emergency: num(input.wallets?.emergency),
      billFund: num(input.wallets?.billFund),
    },
    transactions,
    budgets: (input.budgets ?? []).map((b) => ({
      categoryId: normalizeCategoryId(b.categoryId) ?? '',
      categoryName: b.name,
      monthlyLimit: num(b.limit),
      monthKey: input.monthKey || getMonthKey(clientNow, timezone),
    })),
    bills: (input.bills ?? []).map((b, i) => ({
      id: b.id ?? `bill-${i}`,
      name: b.name ?? '',
      amount: num(b.amount),
      dueDay: num(b.dueDay),
      isPaid: b.isPaid === true,
    })),
    goals: (input.goals ?? []).map((g, i) => ({
      id: g.id ?? `goal-${i}`,
      name: g.name ?? '',
      targetAmount: num(g.targetAmount),
      currentAmount: num(g.savedAmount),
      deadline: g.deadline,
      monthlyContributionTarget: g.monthlyContributionTarget ?? g.monthlyContribution,
    })),
    tasks: (input.tasks ?? []).map((t, i) => ({
      id: t.id ?? `task-${i}`,
      name: t.name ?? '',
      expectedAmount: num(t.expectedAmount),
      actualAmount: typeof t.actualAmount === 'number' ? t.actualAmount : undefined,
      startDate: t.startDate ?? '',
      endDate: t.endDate ?? '',
      completedAt: t.completedAt,
      deletedAt: t.deletedAt,
      subTasks: (t.subTasks ?? []).map((s, j) => ({
        id: `st-${i}-${j}`,
        isCompleted: s.isCompleted === true,
      })),
    })),
    // Phase 2: gamification user (cho QUERY_STREAK). Chỉ map khi client gửi.
    user: input.user
      ? {
          rank: input.user.rank,
          xp: typeof input.user.xp === 'number' ? input.user.xp : undefined,
          streak: typeof input.user.streak === 'number' ? input.user.streak : undefined,
          streakShields:
            typeof input.user.streakShields === 'number' ? input.user.streakShields : undefined,
        }
      : undefined,
    carryOver: input.carryOver,
  };
}
