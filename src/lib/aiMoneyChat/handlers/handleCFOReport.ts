/* ═══ Handler — CFO_REPORT / ANALYZE_FINANCE / ADVICE_CUT_SPENDING (LLM) ═══
 * Flow:
 *   1. Charge credit (cfoNarration) — quota gate.
 *   2. Tổng hợp snapshot ĐẦY ĐỦ (ưu tiên clientSnapshot real-time).
 *   3. Dựng prompt Lord Diamond + compact JSON snapshot.
 *   4. Gọi LLM client (OpenAI primary -> Groq fallback).
 *   5. Trả ChatReply kèm ui.kind = 'cfo-card'.
 *
 * Dependency Injection (deps) cho phép test mà không gọi Firestore/mạng thật.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext } from '../aggregation/types';
import type { AiMoneyQuotaChargeResult } from '../quota';
import { buildLLMMessages, type ConversationTurn } from '../llm/promptBuilder';
import { generateLLMResponse, type LLMResponse } from '../llm/llmClient';
import { createSession, appendTurn } from '../llm/conversationStore';
import type { LLMMessage, LLMOptions } from '../llm/types';
import type { ChatIntent, ChatReply } from '../intent/types';

export interface CFOHandlerDeps {
  charge: (uid: string) => Promise<AiMoneyQuotaChargeResult>;
  generate: (messages: LLMMessage[], options?: LLMOptions) => Promise<LLMResponse>;
  history?: ConversationTurn[];
  /** Đọc hồ sơ dài hạn (Phase 5). Mặc định Firestore, degrade null. */
  readProfile?: (uid: string) => Promise<string | null>;
  /** Lưu note hệ thống do LLM phát hiện. */
  saveProfile?: (uid: string, note: string) => Promise<void>;
}

function defaultDeps(): CFOHandlerDeps {
  return {
    // Dynamic import: tránh kéo firebase-admin vào graph khi không cần (vd test inject charge).
    charge: async (uid) => {
      const { chargeAiMoneyCfoNarrationCredit } = await import('../quota');
      return chargeAiMoneyCfoNarrationCredit(uid);
    },
    generate: generateLLMResponse,
    readProfile: async (uid) => {
      const { readAiProfile } = await import('../memory/longTermProfile');
      return readAiProfile(uid);
    },
    saveProfile: async (uid, note) => {
      const { saveAiProfile } = await import('../memory/longTermProfile');
      return saveAiProfile(uid, note);
    },
  };
}

/** Bóc các dòng action ("- ...") làm gợi ý cho cfo-card. */
function extractSuggestions(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/^-\s+/, ''))
    .slice(0, 5);
}

export async function handleCFOReport(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
  deps: CFOHandlerDeps = defaultDeps(),
): Promise<ChatReply> {
  // 1) Quota.
  const quota = await deps.charge(uid);
  if (!quota.allowed) {
    const isFree = quota.plan === 'free';
    return {
      message: isFree
        ? 'Phân tích tài chính chuyên sâu là tính năng Pro. Nâng cấp để Lord Diamond phục vụ ngài.'
        : `Ngài đã dùng hết hạn mức AI tháng này (${quota.usedCredits}/${quota.monthlyLimit} credits). Hẹn ngài sang tháng.`,
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  // 2) Snapshot đầy đủ (clientSnapshot ưu tiên; nếu không có -> Firestore fallback).
  const snapshot = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot, forceRefresh: true });

  // 2b) Đọc hồ sơ dài hạn (turn đầu) — degrade null nếu chưa có.
  const longTermProfile = deps.readProfile ? await deps.readProfile(uid).catch(() => null) : null;

  // 3) Prompt.
  const messages = buildLLMMessages({
    snapshot,
    userMessage: intent.rawText,
    intent: intent.type,
    history: deps.history,
    longTermProfile,
  });

  // 4) Gọi LLM — lỗi thì trả thông báo nhẹ (vẫn kèm health score deterministic).
  try {
    const result = await deps.generate(messages, { temperature: 0.3, maxTokens: 700 });

    // Bóc + lưu note hệ thống (nếu LLM gắn tag), rồi ẩn tag khỏi message hiển thị.
    const { extractProfileNote, stripProfileNote } = await import('../memory/longTermProfile');
    const profileNote = extractProfileNote(result.content);
    const displayMessage = stripProfileNote(result.content);
    if (profileNote && deps.saveProfile) {
      await deps.saveProfile(uid, profileNote).catch(() => {});
    }

    // Lưu vết phiên ngay turn đầu -> nền tảng cho follow-up (Phase 4).
    if (ctx.sessionId) {
      createSession(ctx.sessionId, uid, snapshot);
      appendTurn(ctx.sessionId, {
        at: new Date().toISOString(),
        intent: intent.type,
        userMessage: intent.rawText,
        assistantMessage: displayMessage,
        tokensUsed: result.tokensUsed,
      });
    }

    return {
      message: displayMessage,
      ui: {
        kind: 'cfo-card',
        payload: {
          healthScore: snapshot.health.score,
          tier: snapshot.health.tier,
          suggestions: extractSuggestions(displayMessage),
          provider: result.provider,
        },
      },
      meta: {
        intent: intent.type,
        source: 'llm',
        latencyMs: 0,
        tokensUsed: result.tokensUsed,
      },
    };
  } catch (error) {
    console.error('[handleCFOReport] LLM failed:', error);
    return {
      message:
        `Hệ thống phân tích AI tạm thời bận. Điểm sức khỏe tài chính tháng này của ngài là ` +
        `**${snapshot.health.score}/100** (${snapshot.health.tier}). Ngài thử lại sau ít phút nhé.`,
      ui: { kind: 'cfo-card', payload: { healthScore: snapshot.health.score, tier: snapshot.health.tier } },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }
}
