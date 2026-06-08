/* ═══ Handler — QUERY_SAVINGS (deterministic) ═══
 * "tiết kiệm tháng này được bao nhiêu" -> savings tháng + tỷ lệ + số dư các quỹ.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

export async function handleQuerySavings(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const cf = snap.cashflow;
  const ratePct = Math.round(cf.savingsRate * 100);

  const lines = [
    `Tháng này ngài để dành **${formatVnd(cf.savings)}** (chuyển vào quỹ).`,
    `Tỷ lệ tiết kiệm trên thu nhập: **${ratePct}%** (thu ${formatVnd(cf.income)} − chi ${formatVnd(cf.expense)}).`,
    '',
    `Quỹ khẩn cấp: **${formatVnd(snap.wallets.emergency)}** · Quỹ trả bill: **${formatVnd(snap.wallets.billFund)}**`,
  ];

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
