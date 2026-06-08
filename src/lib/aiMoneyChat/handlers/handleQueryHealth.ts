/* ═══ Handler — QUERY_HEALTH_SCORE (deterministic, 0 token) ═══
 * "điểm sức khỏe tài chính" -> getFinancialHealthScore (Money Brain, 6 thành phần).
 * KHÔNG gọi LLM — score luôn deterministic.
 */

import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { buildMoneySnapshot, deterministicReply, NEED_SYNC_MESSAGE } from './engineContext';
import { bulletList } from '../response/formatMoney';
import { getFinancialHealthScore } from '@/lib/moneyBrain/healthScore';

export async function handleQueryHealth(
  _uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const money = buildMoneySnapshot(ctx);
  if (!money) {
    return deterministicReply(NEED_SYNC_MESSAGE, intent);
  }

  const hs = getFinancialHealthScore(money);

  const lines = [
    `Điểm sức khỏe tài chính hiện tại: **${hs.total}/100**.`,
    '',
    'Breakdown:',
    bulletList([
      `Dòng tiền: ${hs.cashflow}/25`,
      `Bill coverage: ${hs.billCoverage}/20`,
      `Quỹ dự phòng: ${hs.emergencyRunway}/20`,
      `Kỷ luật ngân sách: ${hs.budgetDiscipline}/15`,
      `Mục tiêu: ${hs.goalProgress}/10`,
      `Pipeline kiếm tiền: ${hs.incomePipeline}/10`,
    ]),
  ];

  return deterministicReply(lines.join('\n'), intent);
}
