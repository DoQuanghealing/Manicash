/* ═══ Task Eval — Prompt Builder (T5) ═══
 * PURE. Dựng system + user prompt cho AI "thẩm định nhiệm vụ kiếm tiền".
 * Input BUDGETED (≤~1.200 tok): cắt số subtask/kỹ năng để prompt không phình.
 * Điểm khả thi (feasibility) do engine tính SẴN — đưa vào prompt để AI KHÔNG bịa số.
 */

/** Ngữ cảnh gọn (đã digest) truyền vào prompt + fallback. */
export interface TaskEvalContext {
  name: string;
  expectedAmount: number;
  daysLeft: number;
  totalDays: number;
  /** Điểm khả thi deterministic (0–100) + tín hiệu. */
  feasibility: number;
  subtaskProgress: number;
  subtaskDone: number;
  subtaskTotal: number;
  historicalRate: number;
  /** Tên các subtask hiện có (đã cắt). */
  subtasks: string[];
  /** Kỹ năng từ khảo sát năng lực (đã cắt). */
  skills: string[];
}

const MAX_SUBTASKS_IN_PROMPT = 10;
const MAX_SKILLS_IN_PROMPT = 12;
const MAX_NAME_LEN = 80;

function money(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString('vi-VN')}đ`;
}

export function buildTaskEvalSystemPrompt(): string {
  return [
    'Bạn là quản gia tài chính thẩm định NHIỆM VỤ KIẾM TIỀN của chủ nhân.',
    'Nhiệm vụ của bạn: chỉ ra nhiệm vụ phụ (subtask) còn THIẾU, rủi ro, khoảng giá đề xuất, và MỘT câu động viên ngắn.',
    'QUY TẮC:',
    '- KHÔNG tự tính "điểm khả thi" — hệ thống đã tính sẵn, bạn chỉ diễn giải quanh nó.',
    '- Chỉ đề xuất subtask CÒN THIẾU (không lặp lại subtask đã có).',
    '- suggestedPriceRange chỉ nêu khi có cơ sở (theo tiền kỳ vọng + độ phức tạp); đơn vị VND.',
    '- Trả về DUY NHẤT JSON đúng schema, không markdown ngoài JSON:',
    '{"missingSubtasks": string[], "risks": string[], "suggestedPriceRange": {"min": number, "max": number} | null, "oneLineCoach": string}',
  ].join('\n');
}

export function buildTaskEvalUserPrompt(ctx: TaskEvalContext): string {
  const lines = [
    'NHIỆM VỤ CẦN THẨM ĐỊNH:',
    `- Tên: ${ctx.name.slice(0, MAX_NAME_LEN)}`,
    `- Tiền kỳ vọng: ${money(ctx.expectedAmount)}`,
    `- Thời hạn: còn ${ctx.daysLeft} ngày (tổng ${ctx.totalDays} ngày)`,
    '',
    'SỐ LIỆU HỆ THỐNG (đã tính sẵn — KHÔNG thay đổi):',
    `- Điểm khả thi: ${ctx.feasibility}/100`,
    `- Tiến độ subtask: ${ctx.subtaskDone}/${ctx.subtaskTotal} (${ctx.subtaskProgress}%)`,
    `- Tỷ lệ hoàn thành lịch sử của chủ nhân: ${ctx.historicalRate}%`,
    '',
    `SUBTASK HIỆN CÓ (${ctx.subtasks.length}):`,
    ctx.subtasks.length
      ? ctx.subtasks.slice(0, MAX_SUBTASKS_IN_PROMPT).map((s) => `  • ${s.slice(0, MAX_NAME_LEN)}`).join('\n')
      : '  (chưa có subtask nào)',
    '',
    `KỸ NĂNG CHỦ NHÂN (từ khảo sát): ${ctx.skills.slice(0, MAX_SKILLS_IN_PROMPT).join(', ') || '(chưa khảo sát)'}`,
    '',
    'Yêu cầu: nêu subtask còn thiếu để hoàn thành, rủi ro chính, khoảng giá hợp lý, và một câu coach.',
  ];
  return lines.join('\n');
}
