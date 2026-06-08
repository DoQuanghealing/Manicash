/* ═══ Handler — Tasks / Earning pipeline (deterministic, 0 token) ═══
 *   QUERY_TASKS_TODAY      -> "hôm nay tôi có việc gì" (liệt kê task)
 *   QUERY_EARNING_PIPELINE -> "nếu làm hết task thì có thêm bao nhiêu"
 *
 * Pipeline dùng Money Brain taskMetrics. List task giữ snapshot tổng hợp.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, SnapshotTask } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';
import { buildMoneySnapshot, deterministicReply, NEED_SYNC_MESSAGE } from './engineContext';
import {
  getExpectedIncomePipeline,
  getActualTaskIncomeForPeriod,
} from '@/lib/moneyBrain/taskMetrics';

function describeTask(task: SnapshotTask): string {
  const progress =
    task.subTasksTotal > 0 ? ` (${task.subTasksDone}/${task.subTasksTotal} việc nhỏ)` : '';
  const overdueTag = task.status === 'overdue' ? ' ⚠️ quá hạn' : '';
  const income = task.expectedAmount > 0 ? ` — dự kiến ${formatVnd(task.expectedAmount)}` : '';
  return `- **${task.name}**${income}${progress}${overdueTag}`;
}

/** True nếu câu hỏi về tổng tiền kỳ vọng nếu hoàn thành task. */
function isPipelineQuery(intent: ChatIntent, text: string): boolean {
  if (intent.type === 'QUERY_EARNING_PIPELINE') return true;
  return /lam het|them bao nhieu|pipeline|kiem them|hoan thanh het|tong thu nhap du kien|neu lam/.test(
    text,
  );
}

export async function handleQueryTasks(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  // ─── Pipeline: thu nhập kỳ vọng nếu hoàn thành task ───
  if (isPipelineQuery(intent, intent.normalizedText)) {
    const money = buildMoneySnapshot(ctx);
    if (!money) return deterministicReply(NEED_SYNC_MESSAGE, intent);

    const pipeline = getExpectedIncomePipeline(money);
    const actual = getActualTaskIncomeForPeriod(money, 'this_month');

    if (pipeline <= 0) {
      const tail =
        actual > 0
          ? ` Tháng này task đã hoàn thành đem về **${formatVnd(actual)}**.`
          : '';
      return deterministicReply(
        `Hiện ngài không có task nào đang mở để tạo thêm dòng tiền.${tail}`,
        intent,
      );
    }

    const lines = [
      `Nếu hoàn thành toàn bộ task đang mở, ngài có thể tạo thêm **${formatVnd(pipeline)}** dòng tiền.`,
    ];
    if (actual > 0) {
      lines.push('', `Tháng này task đã hoàn thành đem về **${formatVnd(actual)}**.`);
    }
    return deterministicReply(lines.join('\n'), intent);
  }

  // ─── List: việc cần làm (pending + active + overdue) ───
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const todo = snap.tasks.items.filter(
    (t) => t.status === 'pending' || t.status === 'active' || t.status === 'overdue',
  );

  if (todo.length === 0) {
    const warn =
      snap.meta.source !== 'client'
        ? snap.meta.warnings.find((w) => w.includes('Nhiệm vụ'))
        : undefined;
    return deterministicReply(
      warn
        ? `Hôm nay chưa có nhiệm vụ nào trong danh sách.\n\n_${warn}_`
        : 'Hôm nay ngài không có nhiệm vụ kiếm tiền nào đang chờ. Thư giãn một chút nhé.',
      intent,
    );
  }

  const totalExpected = todo.reduce((s, t) => s + t.expectedAmount, 0);
  const lines = [`Hôm nay ngài có **${todo.length}** nhiệm vụ cần xử lý:`, ...todo.map(describeTask)];
  if (totalExpected > 0) {
    lines.push('', `Tổng thu nhập dự kiến: **${formatVnd(totalExpected)}**.`);
  }

  return deterministicReply(lines.join('\n'), intent);
}
