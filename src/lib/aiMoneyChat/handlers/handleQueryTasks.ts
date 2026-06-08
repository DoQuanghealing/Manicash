/* ═══ Handler — QUERY_TASKS_TODAY (deterministic, 0 token) ═══
 * "hôm nay tôi có việc gì" -> liệt kê nhiệm vụ kiếm tiền đang active/pending
 * kèm tiến độ sub-task và thu nhập dự kiến.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, SnapshotTask } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

function describeTask(task: SnapshotTask): string {
  const progress =
    task.subTasksTotal > 0 ? ` (${task.subTasksDone}/${task.subTasksTotal} việc nhỏ)` : '';
  const overdueTag = task.status === 'overdue' ? ' ⚠️ quá hạn' : '';
  const income = task.expectedAmount > 0 ? ` — dự kiến ${formatVnd(task.expectedAmount)}` : '';
  return `- **${task.name}**${income}${progress}${overdueTag}`;
}

export async function handleQueryTasks(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });

  // Việc cần làm hôm nay = pending + active + overdue (chưa xong).
  const todo = snap.tasks.items.filter(
    (t) => t.status === 'pending' || t.status === 'active' || t.status === 'overdue',
  );

  if (todo.length === 0) {
    const warn = snap.meta.source !== 'client' ? snap.meta.warnings.find((w) => w.includes('Nhiệm vụ')) : undefined;
    return {
      message: warn
        ? `Hôm nay chưa có nhiệm vụ nào trong danh sách.\n\n_${warn}_`
        : 'Hôm nay ngài không có nhiệm vụ kiếm tiền nào đang chờ. Thư giãn một chút nhé.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  const totalExpected = todo.reduce((s, t) => s + t.expectedAmount, 0);
  const lines = [
    `Hôm nay ngài có **${todo.length}** nhiệm vụ cần xử lý:`,
    ...todo.map(describeTask),
  ];
  if (totalExpected > 0) {
    lines.push('', `Tổng thu nhập dự kiến: **${formatVnd(totalExpected)}**.`);
  }

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
