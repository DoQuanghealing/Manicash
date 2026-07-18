/* ═══ Task Eval — Context builder (T5) ═══
 * PURE. (EarningTask + toàn bộ task + kỹ năng + clientNow) → TaskEvalContext gửi lên
 * route. Điểm khả thi tính SẴN ở đây (deterministic) — client hiện ngay, AI không bịa.
 * Dùng EarningTask (có TÊN subtask) vì snapshot đã lược tên; EarningTask ⊇ MoneyTaskSnapshot.
 */

import type { EarningTask } from '@/types/task';
import type { MoneyTaskSnapshot } from '@/lib/moneyBrain/types';
import { computeTaskFeasibility } from './taskFeasibility';
import type { TaskEvalContext } from './taskEvalPrompt';

export function buildTaskEvalContext(
  task: EarningTask,
  allTasks: EarningTask[],
  skills: string[],
  clientNow: string,
): TaskEvalContext {
  const { score, signals } = computeTaskFeasibility(
    task as MoneyTaskSnapshot,
    allTasks as MoneyTaskSnapshot[],
    clientNow,
  );
  return {
    name: task.name,
    expectedAmount: task.expectedAmount,
    daysLeft: signals.daysLeft,
    totalDays: signals.totalDays,
    feasibility: score,
    subtaskProgress: signals.subtaskProgress,
    subtaskDone: signals.subtaskDone,
    subtaskTotal: signals.subtaskTotal,
    historicalRate: signals.historicalRate,
    subtasks: (task.subTasks ?? []).map((s) => s.name ?? '').filter(Boolean),
    skills: skills.filter(Boolean),
  };
}
