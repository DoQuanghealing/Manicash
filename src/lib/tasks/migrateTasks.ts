/* ═══ Migrate nhiệm vụ v1 → v2 — THUẦN (không đụng store) ═══
 * Dùng ở 2 nơi: persist migrate của useTaskStore và Money Sync khi đọc dữ liệu cloud
 * (máy cũ chưa cập nhật có thể đẩy task v1 lên).
 */
import type { EarningTask, XPPenalty } from '@/types/task';
import { getTaskStage } from '@/types/task';

/** v1 → v2: thêm `stage` + `updatedAt`. KHÔNG tạo bù giao dịch thu cho task đã xong —
 * người dùng có thể đã tự ghi tay, tạo bù là đếm đôi. Idempotent. */
export function migrateTasksState(persisted: unknown): { tasks: EarningTask[]; xpPenalties: XPPenalty[] } {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  const rawTasks = Array.isArray(p.tasks) ? (p.tasks as EarningTask[]) : [];
  const tasks = rawTasks
    .filter((t) => t && typeof t === 'object' && typeof t.id === 'string')
    .map((t) => ({
      ...t,
      subTasks: Array.isArray(t.subTasks) ? t.subTasks : [],
      stage: getTaskStage(t),
      updatedAt: t.updatedAt ?? t.completedAt ?? t.deletedAt ?? t.createdAt,
    }));
  return {
    tasks,
    xpPenalties: Array.isArray(p.xpPenalties) ? (p.xpPenalties as XPPenalty[]) : [],
  };
}
