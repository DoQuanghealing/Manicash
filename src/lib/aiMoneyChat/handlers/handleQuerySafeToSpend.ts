/* ═══ Handler — QUERY_SAFE_TO_SPEND (deterministic, 0 token) ═══
 * "tháng này còn bao nhiêu để xài" -> getSafeToSpendBreakdown (Money Brain v1.1).
 * Isomorphic với UI SafeToSpendCard — cùng công thức, cùng con số.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';
import { buildMoneySnapshot, deterministicReply } from './engineContext';
import { formatVND } from '../response/formatMoney';
import { getSafeToSpendBreakdown } from '@/lib/moneyBrain/safeToSpend';

const FORMULA_NOTE = [
  'Công thức:',
  'Thu nhập tháng + dư tháng trước',
  '− ngân sách dự kiến',
  '− bill chưa đóng',
  '− mục tiêu tiết kiệm/tháng',
].join('\n');

export async function handleQuerySafeToSpend(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const money = buildMoneySnapshot(ctx);

  // Đường chính: engine v1.1 (isomorphic với UI).
  if (money) {
    const b = getSafeToSpendBreakdown(money);

    if (b.status === 'danger') {
      return deterministicReply(
        [
          `Ngài đang ở vùng **nguy hiểm**: số dư an toàn là **${formatVND(b.safeToSpend)}**.`,
          '',
          'Ưu tiên: dừng chi tự do, khóa bill chưa đóng, và rà lại 2 danh mục chi lớn nhất.',
          '',
          FORMULA_NOTE,
        ].join('\n'),
        intent,
      );
    }

    const tone = b.status === 'caution' ? ' (số dư đang mỏng)' : '';
    return deterministicReply(
      [
        `Số dư **an toàn** tháng này của ngài là **${formatVND(b.safeToSpend)}**${tone}.`,
        '',
        `Tính theo ${b.daysLeftInMonth} ngày còn lại, ngài nên giữ mức chi khoảng **${formatVND(b.safeToSpendPerDay)}/ngày**.`,
        '',
        FORMULA_NOTE,
      ].join('\n'),
      intent,
    );
  }

  // Fallback (không có client snapshot): snapshot tổng hợp.
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const bud = snap.budget;
  if (bud.monthlyBudgetTotal <= 0) {
    return deterministicReply(
      'Ngài chưa đặt ngân sách tháng này nên mình chưa tính được mức an toàn để chi. Hãy đặt hạn mức ở tab Money nhé.',
      intent,
    );
  }
  const lines = [
    `Ngân sách còn an toàn để chi: **${formatVnd(bud.safeToSpend)}**`,
    `≈ **${formatVnd(bud.safeToSpendPerDay)}/ngày** trong ${bud.daysRemaining} ngày còn lại của tháng.`,
  ];
  if (bud.categoriesOverBudget > 0) {
    lines.push('', `⚠️ Có **${bud.categoriesOverBudget}** danh mục đã vượt hạn mức.`);
  }
  return deterministicReply(lines.join('\n'), intent);
}
