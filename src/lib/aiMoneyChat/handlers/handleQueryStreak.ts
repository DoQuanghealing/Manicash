/* ═══ Handler — QUERY_STREAK (deterministic, 0 token) ═══
 * "streak của tôi bao nhiêu" -> đọc snapshot.user (gamification).
 * Nếu snapshot thiếu user -> báo thiếu dữ liệu, KHÔNG bịa 0.
 */

import type { ChatHandlerContext } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { buildMoneySnapshot, deterministicReply } from './engineContext';

export async function handleQueryStreak(
  _uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const money = buildMoneySnapshot(ctx);
  const user = money?.user;

  if (!user || typeof user.streak !== 'number') {
    return deterministicReply(
      'Tôi chưa có dữ liệu streak trong phiên hiện tại. Ngài thử mở lại app để đồng bộ nhé.',
      intent,
    );
  }

  const lines = [`Chuỗi ghi chép của ngài hiện là **${user.streak} ngày**.`];
  const shields = user.streakShields ?? 0;
  if (shields > 0) {
    lines.push('', `Ngài còn **${shields} khiên** bảo vệ streak.`);
  } else {
    lines.push('', 'Ngài chưa có khiên bảo vệ streak nào — giữ chuỗi đều để nhận khiên nhé.');
  }

  return deterministicReply(lines.join('\n'), intent);
}
