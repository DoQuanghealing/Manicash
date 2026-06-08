/* ═══ Handler — QUERY_SPENDING (deterministic, period-aware) ═══
 * "hôm nay / tuần này / tháng này tôi đã chi bao nhiêu" -> tổng chi đúng period
 * + top danh mục. Phase 0: dùng Money Brain (isomorphic) để lọc theo dateKey,
 * KHÔNG còn trả cả tháng cho câu hỏi "hôm nay".
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, ClientSnapshotInput } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain/snapshot';
import { getExpenseForPeriod } from '@/lib/moneyBrain/financeSummary';
import {
  detectPeriod,
  isTransactionInPeriod,
  getCurrentMonthKey,
  type MoneyPeriod,
} from '@/lib/moneyBrain/dateRange';

const PERIOD_LABEL: Record<MoneyPeriod, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  all: 'Tổng cộng',
};

function reply(message: string, intent: ChatIntent): ChatReply {
  return {
    message,
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}

export async function handleQuerySpending(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const period = detectPeriod(intent.rawText);
  const label = PERIOD_LABEL[period];

  // Đường chính: có client snapshot -> dùng Money Brain lọc theo period.
  if (ctx.clientSnapshot && typeof ctx.clientSnapshot === 'object') {
    const money = toMoneySnapshotV1(ctx.clientSnapshot as ClientSnapshotInput);
    const expense = getExpenseForPeriod(money, period);

    if (expense <= 0) {
      // Snapshot hiện chỉ mang giao dịch THÁNG HIỆN TẠI (xem buildClientSnapshot).
      // Với câu hỏi tháng trước mà không có dữ liệu tháng cũ trong phiên,
      // KHÔNG được trả "0đ / chưa chi" như thể đó là sự thật.
      const currentMK = getCurrentMonthKey(money.clientNow, money.timezone);
      const hasPriorMonthData = money.transactions.some((t) => (t.monthKey ?? '') < currentMK);
      if (period === 'last_month' && !hasPriorMonthData) {
        return reply(
          'Phiên hiện tại chưa có dữ liệu giao dịch **tháng trước**, nên mình chưa thể tính chi tiêu tháng trước chính xác. Ngài thử mở lại app để đồng bộ dữ liệu cũ nhé.',
          intent,
        );
      }
      return reply(`${label} ngài chưa ghi nhận khoản chi nào.`, intent);
    }

    // Top danh mục theo đúng period.
    const nameMap = new Map<string, string>();
    for (const b of money.budgets) {
      if (b.categoryId) nameMap.set(b.categoryId, b.categoryName ?? b.categoryId);
    }
    const periodCtx = { clientNow: money.clientNow, timezone: money.timezone };
    const byCat = new Map<string, number>();
    for (const t of money.transactions) {
      if (t.type !== 'expense') continue;
      if (!isTransactionInPeriod(t, period, periodCtx)) continue;
      const cid = t.categoryId ?? 'other';
      if (t.categoryName && !nameMap.has(cid)) nameMap.set(cid, t.categoryName);
      byCat.set(cid, (byCat.get(cid) ?? 0) + t.amount);
    }
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const lines = [`${label} ngài đã chi **${formatVnd(expense)}**.`];
    if (top.length > 0) {
      lines.push('', 'Chi nhiều nhất:');
      for (const [cid, amt] of top) {
        lines.push(`- ${nameMap.get(cid) ?? cid}: ${formatVnd(amt)}`);
      }
    }
    return reply(lines.join('\n'), intent);
  }

  // Fallback (không có client snapshot): dùng snapshot tổng hợp tháng hiện tại.
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const cf = snap.cashflow;
  if (cf.expense <= 0) {
    return reply('Tháng này ngài chưa ghi nhận khoản chi nào.', intent);
  }
  const lines = [
    `Tháng này ngài đã chi **${formatVnd(cf.expense)}** (trung bình ~${formatVnd(cf.avgDailyExpense)}/ngày).`,
  ];
  const top = snap.categories.topBySpend.slice(0, 3);
  if (top.length > 0) {
    lines.push('', 'Chi nhiều nhất:');
    for (const c of top) {
      const over = c.overBy > 0 ? ` (lố ${formatVnd(c.overBy)})` : '';
      lines.push(`- ${c.name}: ${formatVnd(c.spent)}${over}`);
    }
  }
  return reply(lines.join('\n'), intent);
}
