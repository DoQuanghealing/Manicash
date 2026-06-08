/* ═══ Handler — QUERY_SAFE_TO_SPEND (deterministic) ═══
 * "tháng này còn bao nhiêu để xài" -> safeToSpend + mức/ngày + cảnh báo lố.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

export async function handleQuerySafeToSpend(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const b = snap.budget;

  if (b.monthlyBudgetTotal <= 0) {
    return {
      message: 'Ngài chưa đặt ngân sách tháng này nên mình chưa tính được mức an toàn để chi. Hãy đặt hạn mức ở tab Money nhé.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  const lines = [
    `Ngân sách còn an toàn để chi: **${formatVnd(b.safeToSpend)}**`,
    `≈ **${formatVnd(b.safeToSpendPerDay)}/ngày** trong ${b.daysRemaining} ngày còn lại của tháng.`,
    '',
    `(Ngân sách ${formatVnd(b.monthlyBudgetTotal)} − đã chi ${formatVnd(b.spentSoFar)} − bill chưa trả ${formatVnd(snap.bills.totalDue)})`,
  ];
  if (b.categoriesOverBudget > 0) {
    lines.push('', `⚠️ Có **${b.categoriesOverBudget}** danh mục đã vượt hạn mức.`);
  }

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
