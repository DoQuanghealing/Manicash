/* ═══ Task Eval — Service Orchestrator (T5) ═══
 * ctx (đã digest) → LLM (schema-guarded) → TaskEvalAIResponse | deterministic fallback.
 * KHÔNG throw — luôn trả kết quả dùng được. Điểm khả thi LUÔN từ engine (ctx.feasibility).
 */

import type { LLMMessage, LLMOptions } from '../llm/types';
import {
  buildTaskEvalSystemPrompt,
  buildTaskEvalUserPrompt,
  type TaskEvalContext,
} from './taskEvalPrompt';
import { parseTaskEvalAIResponse, type TaskEvalAIResponse } from './taskEvalSchema';

export interface TaskEvalGenerateResult {
  content: string;
  provider?: string;
  tokensUsed?: number;
}

export interface RunTaskEvalDeps {
  generate?: (messages: LLMMessage[], options?: LLMOptions) => Promise<TaskEvalGenerateResult>;
  options?: LLMOptions;
}

export interface TaskEvalResult {
  /** Điểm khả thi deterministic (từ engine, không phải LLM). */
  feasibility: number;
  ai: TaskEvalAIResponse;
  deterministicFallback: boolean;
  provider?: string;
  tokensUsed?: number;
}

/** Fallback deterministic: gợi ý/rủi ro/coach suy từ chính tín hiệu trong ctx (0đ). */
export function buildDeterministicTaskEval(ctx: TaskEvalContext): TaskEvalAIResponse {
  const missingSubtasks: string[] = [];
  if (ctx.subtaskTotal === 0) {
    missingSubtasks.push('Chia nhiệm vụ thành các bước cụ thể để dễ theo dõi');
  } else if (ctx.subtaskProgress < 50) {
    missingSubtasks.push('Đặt một mốc kiểm tra giữa kỳ để không dồn về cuối');
  }

  const risks: string[] = [];
  if (ctx.daysLeft < 0) risks.push('Nhiệm vụ đã quá hạn — cần xử lý hoặc gia hạn ngay');
  else if (ctx.daysLeft <= 2) risks.push('Sắp tới hạn mà tiến độ chưa xong');
  if (ctx.feasibility < 40) risks.push('Khả năng hoàn thành đang thấp theo tiến độ hiện tại');
  if (ctx.historicalRate < 50) risks.push('Tỷ lệ hoàn thành lịch sử thấp — dễ bỏ dở giữa chừng');

  const oneLineCoach =
    ctx.feasibility >= 70
      ? 'Đang đi đúng hướng — giữ nhịp này là về đích thôi.'
      : ctx.feasibility >= 40
        ? 'Còn kịp nếu bắt tay vào bước tiếp theo ngay hôm nay.'
        : 'Chia nhỏ và làm ngay một bước — momentum quan trọng hơn hoàn hảo.';

  return { missingSubtasks, risks, oneLineCoach };
}

export async function runTaskEval(
  ctx: TaskEvalContext,
  deps: RunTaskEvalDeps = {},
): Promise<TaskEvalResult> {
  if (!deps.generate) {
    return { feasibility: ctx.feasibility, ai: buildDeterministicTaskEval(ctx), deterministicFallback: true };
  }

  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: buildTaskEvalSystemPrompt() },
      { role: 'user', content: buildTaskEvalUserPrompt(ctx) },
    ];
    const result = await deps.generate(messages, deps.options ?? { temperature: 0.4, maxTokens: 450 });
    const parsed = parseTaskEvalAIResponse(result.content);
    if (!parsed) {
      return { feasibility: ctx.feasibility, ai: buildDeterministicTaskEval(ctx), deterministicFallback: true };
    }
    return {
      feasibility: ctx.feasibility,
      ai: parsed,
      deterministicFallback: false,
      provider: result.provider,
      tokensUsed: result.tokensUsed,
    };
  } catch {
    return { feasibility: ctx.feasibility, ai: buildDeterministicTaskEval(ctx), deterministicFallback: true };
  }
}
