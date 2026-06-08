/* ═══ Handler — QUERY_BALANCE (deterministic, 0 token) ═══
 * "tôi còn bao nhiêu tiền" -> liệt kê số dư 3 ví + tổng, định dạng vi-VN.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

export async function handleQueryBalance(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const { wallets } = snap;

  const lines = [
    'Số dư hiện tại của ngài:',
    `- Ví chính: **${formatVnd(wallets.main)}**`,
    `- Quỹ khẩn cấp: **${formatVnd(wallets.emergency)}**`,
    `- Quỹ trả bill: **${formatVnd(wallets.billFund)}**`,
    '',
    `Tổng cộng: **${formatVnd(wallets.total)}**`,
  ];

  if (snap.meta.source !== 'client' && snap.meta.warnings.length > 0) {
    lines.push('', `_${snap.meta.warnings[0]}_`);
  }

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
