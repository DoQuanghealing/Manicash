/* ═══ Handler — QUERY_SPENDING (deterministic) ═══
 * "tháng này tôi đã chi bao nhiêu" -> tổng chi + top danh mục.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

export async function handleQuerySpending(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const cf = snap.cashflow;

  if (cf.expense <= 0) {
    return {
      message: 'Tháng này ngài chưa ghi nhận khoản chi nào.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
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

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
