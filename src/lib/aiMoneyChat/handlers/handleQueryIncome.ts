/* ═══ Handler — QUERY_INCOME (deterministic, 0 token) ═══
 * "tháng này tôi thu bao nhiêu" / "hôm nay kiếm được bao nhiêu"
 * -> thu nhập đúng period (Money Brain isomorphic).
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { extractSlots } from '../intent/slotExtractor';
import { buildMoneySnapshot, deterministicReply } from './engineContext';
import { formatVND } from '../response/formatMoney';
import { getIncomeForPeriod } from '@/lib/moneyBrain/financeMetrics';
import { getCurrentMonthKey, type MoneyPeriod } from '@/lib/moneyBrain/dateRange';

const PERIOD_LABEL: Record<MoneyPeriod, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  all: 'Tổng cộng',
};

export async function handleQueryIncome(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const slots = extractSlots(intent.rawText);
  const period: MoneyPeriod = slots.period ?? 'this_month';
  const label = PERIOD_LABEL[period];

  const money = buildMoneySnapshot(ctx);
  if (money) {
    const income = getIncomeForPeriod(money, period);

    // Guard: hỏi "tháng trước" nhưng phiên không có dữ liệu tháng cũ -> không trả 0 giả.
    if (income <= 0 && period === 'last_month') {
      const currentMK = getCurrentMonthKey(money.clientNow, money.timezone);
      const hasPrior = money.transactions.some((t) => (t.monthKey ?? '') < currentMK);
      if (!hasPrior) {
        return deterministicReply(
          'Phiên hiện tại chưa có dữ liệu thu nhập **tháng trước** để tính chính xác. Ngài thử mở lại app để đồng bộ dữ liệu cũ nhé.',
          intent,
        );
      }
    }

    if (income <= 0) {
      return deterministicReply(`${label} ngài chưa ghi nhận khoản thu nào.`, intent);
    }
    return deterministicReply(`${label} ngài đã ghi nhận thu nhập **${formatVND(income)}**.`, intent);
  }

  // Fallback: snapshot tổng hợp tháng hiện tại.
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const income = snap.cashflow.income;
  if (income <= 0) {
    return deterministicReply('Tháng này ngài chưa ghi nhận khoản thu nào.', intent);
  }
  return deterministicReply(`Tháng này ngài đã ghi nhận thu nhập **${formatVND(income)}**.`, intent);
}
