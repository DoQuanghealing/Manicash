/* ═══ Handler — CFO_REPORT / ANALYZE_FINANCE / ADVICE_CUT_SPENDING (Phase 3) ═══
 * Flow:
 *   1. Charge credit (quota gate).
 *   2. Build MoneySnapshotV1 (clientSnapshot) -> CFOContextPack (số do engine tính).
 *   3. runCFOAnalysis: LLM đọc context (JSON schema) hoặc fallback deterministic.
 *   4. Compose markdown: "Số liệu chính" từ context (KHÔNG từ LLM) + diễn giải LLM.
 *   5. Lưu session bằng legacy snapshot (để follow-up Phase 4 tái dùng).
 *
 * NGUYÊN TẮC: mọi con số trong reply lấy từ CFOContextPack. LLM chỉ diễn giải.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, ClientSnapshotInput } from '../aggregation/types';
import type { AiMoneyQuotaChargeResult } from '../quota';
import type { ConversationTurn } from '../llm/promptBuilder';
import { generateLLMResponse } from '../llm/llmClient';
import { createSession, appendTurn } from '../llm/conversationStore';
import type { LLMMessage, LLMOptions } from '../llm/types';
import type { ChatIntent, ChatReply } from '../intent/types';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import { runCFOAnalysis, type CFOGenerateResult } from '../cfo/cfoService';
import type { CFOContextPackV1 } from '@/lib/moneyBrain';
import type { CFOAIResponse } from '../cfo/cfoResponseSchema';
import { formatVND } from '../response/formatMoney';

export interface CFOHandlerDeps {
  /** #2 POST-PAYMENT: kiểm tra hạn mức read-only TRƯỚC khi gọi LLM. Mặc định = charge (shim test). */
  peek?: (uid: string) => Promise<AiMoneyQuotaChargeResult>;
  charge: (uid: string) => Promise<AiMoneyQuotaChargeResult>;
  generate: (messages: LLMMessage[], options?: LLMOptions) => Promise<CFOGenerateResult>;
  history?: ConversationTurn[];
  /** Đọc/lưu hồ sơ dài hạn — giữ cho backward-compat signature (không dùng ở CFO JSON flow). */
  readProfile?: (uid: string) => Promise<string | null>;
  saveProfile?: (uid: string, note: string) => Promise<void>;
}

function defaultDeps(): CFOHandlerDeps {
  return {
    peek: async (uid) => {
      const { peekAiMoneyCfoNarrationCredit } = await import('../quota');
      return peekAiMoneyCfoNarrationCredit(uid);
    },
    charge: async (uid) => {
      const { chargeAiMoneyCfoNarrationCredit } = await import('../quota');
      return chargeAiMoneyCfoNarrationCredit(uid);
    },
    generate: generateLLMResponse,
  };
}

function numberedList(items: string[]): string {
  return items.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

/** Compose markdown chat — số liệu chính LẤY TỪ context pack, không từ LLM. */
function composeMarkdown(context: CFOContextPackV1, cfo: CFOAIResponse): string {
  const ex = context.executiveSummary;
  const lines = [
    '## Báo cáo CFO tháng này',
    '',
    cfo.summary,
    '',
    '### Số liệu chính',
    `- Thu nhập: ${formatVND(ex.totalIncome)}`,
    `- Chi tiêu: ${formatVND(ex.totalExpense)}`,
    `- Dòng tiền ròng: ${formatVND(ex.netCashflow)}`,
    `- Safe-to-spend: ${formatVND(ex.safeToSpend)}`,
    `- HealthScore: ${ex.healthScore}/100`,
    '',
    '### Chẩn đoán',
    numberedList(cfo.diagnosis),
  ];
  if (cfo.risks.length > 0) {
    lines.push('', '### Rủi ro', numberedList(cfo.risks));
  }
  if (cfo.opportunities.length > 0) {
    lines.push('', '### Cơ hội', numberedList(cfo.opportunities));
  }
  lines.push('', '### Kế hoạch 7 ngày', numberedList(cfo.actionPlan7Days));
  if (cfo.quickWins && cfo.quickWins.length > 0) {
    lines.push('', '### Quick wins', numberedList(cfo.quickWins));
  }
  return lines.join('\n');
}

export async function handleCFOReport(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
  deps: CFOHandlerDeps = defaultDeps(),
): Promise<ChatReply> {
  // 1) #2 POST-PAYMENT — peek hạn mức (read-only) TRƯỚC khi phân tích. CHƯA trừ credit.
  const peek = deps.peek ?? deps.charge;
  const quota = await peek(uid);
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

  // 2) Money snapshot (engine) + legacy snapshot (session/follow-up compat).
  const moneySnapshot = toMoneySnapshotV1((ctx.clientSnapshot ?? {}) as ClientSnapshotInput);
  const legacySnapshot = await getFinanceSnapshot(uid, {
    clientSnapshot: ctx.clientSnapshot,
    forceRefresh: true,
  });

  // 3) Run CFO analysis (LLM schema-guarded hoặc fallback deterministic).
  // T2: gắn usageContext để ai_usage_log gán chi phí đúng uid + loại lượt.
  const result = await runCFOAnalysis(moneySnapshot, {
    generate: (messages, options) =>
      deps.generate(messages, { ...options, usageContext: { uid, feature: 'cfo' } }),
  });
  const { context, cfo, deterministicFallback } = result;

  // 4) Compose markdown — số từ context, diễn giải từ LLM/fallback.
  const message = composeMarkdown(context, cfo);

  // #2 POST-PAYMENT — CHỈ trừ credit khi LLM THẬT SỰ chạy. Fallback deterministic
  // (LLM lỗi/không có key) tốn 0đ API -> user vẫn nhận báo cáo MIỄN PHÍ, không trừ.
  if (!deterministicFallback) {
    await deps.charge(uid);
  }

  // 5) Session (legacy snapshot) — nền tảng follow-up Phase 4.
  if (ctx.sessionId) {
    await createSession(ctx.sessionId, uid, legacySnapshot);
    await appendTurn(ctx.sessionId, {
      at: new Date().toISOString(),
      intent: intent.type,
      userMessage: intent.rawText,
      assistantMessage: message,
      tokensUsed: result.tokensUsed ?? 0,
    });
  }

  return {
    message,
    ui: {
      kind: 'cfo-card',
      payload: {
        healthScore: context.executiveSummary.healthScore,
        financialMode: context.financialMode,
        suggestions: cfo.actionPlan7Days.slice(0, 5),
        provider: result.provider,
        deterministicFallback,
      },
    },
    meta: {
      intent: intent.type,
      source: deterministicFallback ? 'deterministic' : 'llm',
      latencyMs: 0,
      tokensUsed: result.tokensUsed,
    },
  };
}
