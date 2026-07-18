/* ═══ Task Eval — Cache hash (T5) ═══
 * PURE. Dấu vân ổn định của nhiệm vụ = tên + tiền kỳ vọng + danh sách subtask
 * (tên + trạng thái). Task đổi → hash đổi → gọi AI lại; không đổi → dùng cache trên task.
 */

export interface TaskEvalHashInput {
  name: string;
  expectedAmount: number;
  subTasks: Array<{ name?: string; isCompleted: boolean }>;
}

/** djb2 — nhỏ, ổn định, đủ phân biệt (không cần chống va chạm mật mã). */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function computeTaskEvalHash(task: TaskEvalHashInput): string {
  const subs = (task.subTasks ?? [])
    .map((s) => `${(s.name ?? '').trim()}:${s.isCompleted ? 1 : 0}`)
    .join('|');
  return djb2(`${task.name.trim()}~${Math.round(task.expectedAmount)}~${subs}`);
}
