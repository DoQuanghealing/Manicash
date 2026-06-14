/* ═══ Handler — FOLLOW_UP (LLM, tái dùng snapshot phiên) ═══
 * "tại sao mục đó lố?", "cắt thế nào?" — nối tiếp báo cáo CFO trước đó.
 *
 * NGUYÊN TẮC: KHÔNG re-aggregate DB. Tái dùng snapshot đã chốt trong session
 * (do handleCFOReport.createSession lưu ở turn đầu) + lịch sử turns -> promptBuilder.
 *
 * Hết phiên -> mời tạo báo cáo mới (ui follow-up-buttons), không gọi LLM.
 */

import type { ChatHandlerContext } from '../aggregation/types';
import type { AiMoneyQuotaChargeResult } from '../quota';
import { buildLLMMessages } from '../llm/promptBuilder';
import { generateLLMResponse, type LLMResponse } from '../llm/llmClient';
import { getOrCreateSession, appendTurn } from '../llm/conversationStore';
import type { LLMMessage, LLMOptions } from '../llm/types';
import type { ChatIntent, ChatReply } from '../intent/types';

export interface FollowUpHandlerDeps {
  charge: (uid: string) => Promise<AiMoneyQuotaChargeResult>;
  generate: (messages: LLMMessage[], options?: LLMOptions) => Promise<LLMResponse>;
  /** Lưu note hệ thống do LLM phát hiện (cuối chu kỳ — Phase 5). */
  saveProfile?: (uid: string, note: string) => Promise<void>;
}

function defaultDeps(): FollowUpHandlerDeps {
  return {
    // Dynamic import: không kéo firebase-admin vào graph khi test inject deps.
    charge: async (uid) => {
      const { chargeAiMoneyCfoNarrationCredit } = await import('../quota');
      return chargeAiMoneyCfoNarrationCredit(uid);
    },
    generate: generateLLMResponse,
    saveProfile: async (uid, note) => {
      const { saveAiProfile } = await import('../memory/longTermProfile');
      return saveAiProfile(uid, note);
    },
  };
}

const EXPIRED_REPLY = (intent: ChatIntent): ChatReply => ({
  message: 'Phiên hội thoại trước đã hết hạn. Ngài có muốn tôi lên một báo cáo CFO mới không?',
  ui: { kind: 'follow-up-buttons', payload: { actions: ['cfo-report'] } },
  meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
});

export async function handleFollowUp(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
  deps: FollowUpHandlerDeps = defaultDeps(),
): Promise<ChatReply> {
  const sessionId = ctx.sessionId;
  const session = sessionId ? await getOrCreateSession(sessionId, uid) : null;

  // Không có phiên (hết hạn / chưa có báo cáo nào) -> mời tạo mới.
  if (!session) return EXPIRED_REPLY(intent);

  // Quota.
  const quota = await deps.charge(uid);
  if (!quota.allowed) {
    const isFree = quota.plan === 'free';
    return {
      message: isFree
        ? 'Hỏi tiếp nối phân tích là tính năng Pro. Nâng cấp để tiếp tục cùng Lord Diamond.'
        : `Ngài đã dùng hết hạn mức AI tháng này (${quota.usedCredits}/${quota.monthlyLimit} credits).`,
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  // TÁI DÙNG snapshot + history của phiên — KHÔNG re-aggregate.
  const messages = buildLLMMessages({
    snapshot: session.snapshot,
    userMessage: intent.rawText,
    intent: intent.type,
    history: session.turns,
  });

  try {
    const result = await deps.generate(messages, { temperature: 0.3, maxTokens: 500 });

    // Bóc + lưu note hệ thống (cuối chu kỳ follow-up), ẩn tag khỏi message.
    const { extractProfileNote, stripProfileNote } = await import('../memory/longTermProfile');
    const profileNote = extractProfileNote(result.content);
    const displayMessage = stripProfileNote(result.content);
    if (profileNote && deps.saveProfile) {
      await deps.saveProfile(uid, profileNote).catch(() => {});
    }

    await appendTurn(sessionId!, {
      at: new Date().toISOString(),
      intent: intent.type,
      userMessage: intent.rawText,
      assistantMessage: displayMessage,
      tokensUsed: result.tokensUsed,
    });

    return {
      message: displayMessage,
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'llm-cached', latencyMs: 0, tokensUsed: result.tokensUsed },
    };
  } catch (error) {
    console.error('[handleFollowUp] LLM failed:', error);
    return {
      message: 'Hệ thống phân tích AI tạm thời bận. Ngài thử lại câu hỏi sau ít phút nhé.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }
}
