import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import {
  peekAiMoneyCfoNarrationCredit,
  chargeAiMoneyCfoNarrationCredit,
} from '@/lib/aiMoneyChat/quota';
import { getCurrentAiMoneyMonthKey } from '@/lib/aiMoneyChat/quotaCore';
import { readNarrationCache, writeNarrationCache } from '@/lib/aiMoneyChat/cfoNarrationCache';
import {
  buildCfoNarrationPrompt,
  CFO_NARRATION_SYSTEM_PROMPT,
  computeNarrationFingerprint,
  validateNarration,
  type CfoNarrationInput,
  type CfoNarrationSource,
} from '@/lib/aiMoneyChat/cfoNarration';
import { checkSpendBreaker, checkUserCostCeiling, logAiUsage } from '@/lib/aiMoneyChat/llm/aiUsageLog';
import { estimateCostVnd } from '@/lib/aiMoneyChat/llm/aiCostCore';
import { resolveProviderPool, callChatCompletion } from '@/lib/aiMoneyChat/llm/chatProvider';

function toFiniteInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function parsePayload(body: unknown): CfoNarrationInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const tier = b.tier === 'good' || b.tier === 'fair' || b.tier === 'poor' ? b.tier : null;
  const monthLabel = typeof b.monthLabel === 'string' ? b.monthLabel.slice(0, 40) : '';
  if (!tier || !monthLabel) return null;

  const topCategory =
    b.topCategory && typeof b.topCategory === 'object'
      ? {
          name: String((b.topCategory as Record<string, unknown>).name ?? '').slice(0, 60),
          amount: toFiniteInt((b.topCategory as Record<string, unknown>).amount),
        }
      : null;

  const topGoal =
    b.topGoal && typeof b.topGoal === 'object'
      ? {
          name: String((b.topGoal as Record<string, unknown>).name ?? '').slice(0, 60),
          progress: toFiniteInt((b.topGoal as Record<string, unknown>).progress),
          remaining: toFiniteInt((b.topGoal as Record<string, unknown>).remaining),
        }
      : null;

  return {
    monthLabel,
    tier,
    healthScore: toFiniteInt(b.healthScore),
    income: toFiniteInt(b.income),
    expense: toFiniteInt(b.expense),
    savings: toFiniteInt(b.savings),
    savingsRate: toFiniteInt(b.savingsRate),
    topCategory: topCategory && topCategory.name ? topCategory : null,
    topGoal: topGoal && topGoal.name ? topGoal : null,
    budgetOnTrack: toFiniteInt(b.budgetOnTrack),
    budgetTotal: toFiniteInt(b.budgetTotal),
  };
}

function jsonResult(source: CfoNarrationSource, reason: string, text: string | null = null, status = 200) {
  return NextResponse.json({ source, reason, text, cached: false }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResult('error', 'Invalid JSON payload.', null, 400);
  }

  const input = parsePayload(body);
  if (!input) {
    return jsonResult('error', 'Invalid CFO narration payload.', null, 400);
  }

  if (process.env.AI_MONEY_CHAT_AI_FALLBACK_ENABLED !== 'true') {
    return jsonResult('disabled', 'AI narration is disabled by server flag.');
  }

  const pool = resolveProviderPool();
  if (pool.length === 0) {
    return jsonResult('no-key', 'No LLM provider key configured (CEREBRAS/GROQ/AGNES/AI_LLM).');
  }

  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) {
      return jsonResult('unauthorized', 'AI narration requires a verified signed-in user.', null, 401);
    }

    const monthKey = getCurrentAiMoneyMonthKey();
    const fingerprint = computeNarrationFingerprint(input);

    // Cost lock: reuse this month's narration when the numbers are unchanged.
    const cached = await readNarrationCache(uid, monthKey);
    if (cached && cached.fingerprint === fingerprint) {
      return NextResponse.json({
        source: 'ai',
        reason: 'Narration served from cache (no credit charged).',
        text: cached.text,
        cached: true,
      });
    }

    // T2 — cầu dao ngân sách ngày: SAU cache-hit (cache 0đ không chặn), TRƯỚC charge credit.
    const breaker = await checkSpendBreaker();
    if (!breaker.allowed) {
      return jsonResult('disabled', 'Ngân sách AI hôm nay đã chạm trần an toàn. Thử lại sau ít giờ nhé.');
    }

    // #2 POST-PAYMENT — kiểm tra hạn mức (read-only) TRƯỚC, CHƯA trừ credit.
    const peek = await peekAiMoneyCfoNarrationCredit(uid);
    if (!peek.allowed) {
      return jsonResult('quota-exceeded', peek.reason, null, 402);
    }

    // T6 — TRẦN FIX CỨNG chi phí/user/tháng: vượt → degrade (client dùng narration deterministic).
    const ceiling = await checkUserCostCeiling(uid, peek.plan);
    if (!ceiling.allowed) {
      return jsonResult('disabled', 'Quản gia đã dốc sức viết cho ngài cả tháng — xin nghỉ ít hôm. Mời ngài xem bản tóm tắt cơ bản, đầu tháng sau tôi lại chấp bút.');
    }

    // Cả pool lỗi -> throw -> catch -> 'error', CHƯA trừ credit.
    const llm = await callChatCompletion(pool, {
      system: CFO_NARRATION_SYSTEM_PROMPT,
      user: buildCfoNarrationPrompt(input),
      temperature: 0.6,
      // Headroom cho reasoning model (gpt-oss tiêu token suy luận trước output).
      maxTokens: 600,
    });
    // T2 — ghi sổ ai_usage_log (token đã tiêu kể cả khi validate fail / không charge).
    await logAiUsage({
      uid,
      feature: 'cfo_narration',
      model: llm.model,
      provider: llm.providerLabel,
      tokensIn: llm.tokensIn,
      tokensOut: llm.tokensOut,
      tokensTotal: llm.tokensTotal,
      costVnd: estimateCostVnd(llm.model, llm.tokensIn, llm.tokensOut),
      fallbackUsed: false,
      latencyMs: 0,
    });
    const narration = validateNarration(llm.content);
    if (!narration) {
      // Groq trả rác (validate fail) -> user không nhận được gì -> KHÔNG trừ credit.
      return jsonResult('error', 'AI narration failed validation.');
    }

    await writeNarrationCache(uid, monthKey, fingerprint, narration);

    // #2 — có narration dùng được, đã lưu cache -> trừ credit BÂY GIỜ.
    const quota = await chargeAiMoneyCfoNarrationCredit(uid);

    return NextResponse.json({
      source: 'ai',
      reason: 'AI narration generated.',
      text: narration,
      cached: false,
      quota: {
        monthKey: quota.monthKey,
        plan: quota.plan,
        usedCredits: quota.usedCredits,
        remainingCredits: quota.remainingCredits,
        chargedCredits: quota.chargedCredits,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'AI narration failed.';
    return jsonResult('error', reason);
  }
}
