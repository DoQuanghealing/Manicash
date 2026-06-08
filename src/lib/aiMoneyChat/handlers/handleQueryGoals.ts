/* ═══ Handler — QUERY_GOAL_PROGRESS (deterministic) ═══
 * "mục tiêu mua xe tới đâu rồi" -> tiến độ các mục tiêu + cảnh báo at-risk.
 * Hỗ trợ lọc theo tên nếu user nhắc tên mục tiêu cụ thể.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, SnapshotGoal } from '../aggregation/types';
import { normalize } from '../intent/intentClassifier';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

function describeGoal(g: SnapshotGoal): string {
  const pct = Math.round(g.percent * 100);
  const remaining = Math.max(0, g.targetAmount - g.savedAmount);
  const pace =
    g.monthsToCompleteAtPace >= 999
      ? 'chưa rõ tiến độ (chưa tích lũy đều)'
      : `~${g.monthsToCompleteAtPace} tháng nữa ở tốc độ hiện tại`;
  const risk = g.atRisk ? ' ⚠️ có nguy cơ trễ hạn' : '';
  return `- **${g.name}**: ${formatVnd(g.savedAmount)}/${formatVnd(g.targetAmount)} (${pct}%) — còn ${formatVnd(remaining)}, ${pace}${risk}`;
}

export async function handleQueryGoals(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const goals = snap.goals.items;

  if (goals.length === 0) {
    return {
      message: 'Ngài chưa đặt mục tiêu tài chính nào. Tạo mục tiêu ở tab Mục tiêu để mình theo dõi tiến độ nhé.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  // Lọc theo tên nếu user nhắc tên cụ thể (so khớp fold dấu).
  const text = intent.normalizedText;
  const matched = goals.filter((g) => {
    const folded = normalize(g.name);
    return folded.split(' ').some((word) => word.length >= 3 && text.includes(word));
  });
  const list = matched.length > 0 ? matched : goals;

  const lines = [
    matched.length > 0 ? 'Tiến độ mục tiêu ngài hỏi:' : `Ngài đang có **${goals.length}** mục tiêu:`,
    ...list.map(describeGoal),
  ];

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
