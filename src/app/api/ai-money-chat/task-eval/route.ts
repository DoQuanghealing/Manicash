/* ═══ API — AI đánh giá nhiệm vụ kiếm tiền (T5 · Cấp 3) ═══
 * POST digest nhiệm vụ (đã gồm điểm khả thi deterministic client tính) → AI gợi ý
 * subtask thiếu / rủi ro / khoảng giá / coach. Billing POST-PAYMENT (#2): peek quota
 * TRƯỚC, CHỈ trừ credit khi LLM thật sự giao kết quả (fallback deterministic → 0đ).
 * Dùng CHUNG "kho" report (double-cap) nhưng ghi ai_usage feature 'task_eval' để đối soát.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import {
  peekAiMoneyCfoNarrationCredit,
  chargeAiMoneyCfoNarrationCredit,
  readTasteUsed,
  incrementTasteUsed,
} from '@/lib/aiMoneyChat/quota';
import { billingLevelCap, evaluateFeatureTaste, describeTaste } from '@/lib/monetization/butlerFeatures';
import { checkSpendBreaker, checkUserCostCeiling, logAiUsage } from '@/lib/aiMoneyChat/llm/aiUsageLog';
import { estimateCostVnd } from '@/lib/aiMoneyChat/llm/aiCostCore';
import {
  buildTaskEvalSystemPrompt,
  buildTaskEvalUserPrompt,
  type TaskEvalContext,
} from '@/lib/aiMoneyChat/taskEval/taskEvalPrompt';
import { runTaskEval } from '@/lib/aiMoneyChat/taskEval/taskEvalService';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_NAME = 120;

type Src = 'ai' | 'deterministic' | 'disabled' | 'no-key' | 'unauthorized' | 'quota-exceeded' | 'upgrade-required' | 'error';

function clampInt(v: unknown, lo: number, hi: number, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return n < lo ? lo : n > hi ? hi : n;
}

function strArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);
}

function parsePayload(body: unknown): TaskEvalContext | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, MAX_NAME) : '';
  if (!name) return null;
  return {
    name,
    expectedAmount: clampInt(b.expectedAmount, 0, 1_000_000_000),
    daysLeft: clampInt(b.daysLeft, -3650, 3650),
    totalDays: clampInt(b.totalDays, 1, 3650, 1),
    feasibility: clampInt(b.feasibility, 0, 100),
    subtaskProgress: clampInt(b.subtaskProgress, 0, 100),
    subtaskDone: clampInt(b.subtaskDone, 0, 999),
    subtaskTotal: clampInt(b.subtaskTotal, 0, 999),
    historicalRate: clampInt(b.historicalRate, 0, 100),
    subtasks: strArray(b.subtasks, 12, 100),
    skills: strArray(b.skills, 15, 40),
  };
}

interface GroqResult { content: string; model: string; tokensIn: number; tokensOut: number }

async function callGroq(apiKey: string, ctx: TaskEvalContext): Promise<GroqResult> {
  const model = process.env.AI_MONEY_CHAT_GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildTaskEvalSystemPrompt() },
        { role: 'user', content: buildTaskEvalUserPrompt(ctx) },
      ],
      temperature: 0.4,
      max_tokens: 450,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq response missing content.');
  return { content, model, tokensIn: data.usage?.prompt_tokens ?? 0, tokensOut: data.usage?.completion_tokens ?? 0 };
}

function jsonResult(source: Src, reason: string, status = 200) {
  return NextResponse.json({ source, reason }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonResult('error', 'Invalid JSON payload.', 400); }

  const ctx = parsePayload(body);
  if (!ctx) return jsonResult('error', 'Invalid task-eval payload.', 400);

  if (process.env.AI_MONEY_CHAT_AI_FALLBACK_ENABLED !== 'true') {
    return jsonResult('disabled', 'AI task eval is disabled by server flag.');
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return jsonResult('no-key', 'GROQ_API_KEY is not configured.');

  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) return jsonResult('unauthorized', 'AI task eval requires a verified signed-in user.', 401);

    const breaker = await checkSpendBreaker();
    if (!breaker.allowed) {
      return jsonResult('disabled', 'Ngân sách AI hôm nay đã chạm trần an toàn. Thử lại sau ít giờ nhé.');
    }

    // #2 POST-PAYMENT — peek quota (kho report) TRƯỚC, CHƯA trừ credit.
    const peek = await peekAiMoneyCfoNarrationCredit(uid);
    if (!peek.allowed) return jsonResult('quota-exceeded', peek.reason, 402);

    // T6 — TRẦN FIX CỨNG chi phí/user/tháng: vượt → degrade mềm (client tự dựng bản cơ bản 0đ).
    const ceiling = await checkUserCostCeiling(uid, peek.plan);
    if (!ceiling.allowed) {
      return jsonResult('disabled', 'Quản gia đã tận tâm phục vụ ngài cả tháng — nay xin nghỉ dưỡng não bộ ít hôm. Mời ngài dùng bản cơ bản, đầu tháng sau tôi lại hầu ngài.');
    }

    // Gate cấp + suất NẾM: Pro (cấp 2) nếm 5 lượt/tháng → hết thì mời lên Phú Vương.
    const taste = evaluateFeatureTaste(
      billingLevelCap(peek.plan),
      'task.eval',
      await readTasteUsed(uid, 'task.eval'),
    );
    if (!taste.allowed) {
      return jsonResult('upgrade-required', describeTaste(taste), 402);
    }

    // runTaskEval KHÔNG throw: Groq lỗi → fallback deterministic (0đ, không trừ).
    let usage: { model: string; tokensIn: number; tokensOut: number } | null = null;
    const result = await runTaskEval(ctx, {
      generate: async () => {
        const g = await callGroq(apiKey, ctx);
        usage = { model: g.model, tokensIn: g.tokensIn, tokensOut: g.tokensOut };
        return { content: g.content, provider: 'groq' };
      },
    });

    if (usage) {
      const u = usage as { model: string; tokensIn: number; tokensOut: number };
      await logAiUsage({
        uid, feature: 'task_eval', model: u.model, provider: 'groq',
        tokensIn: u.tokensIn, tokensOut: u.tokensOut, tokensTotal: u.tokensIn + u.tokensOut,
        costVnd: estimateCostVnd(u.model, u.tokensIn, u.tokensOut),
        fallbackUsed: result.deterministicFallback, latencyMs: 0,
      });
    }

    // Trừ credit khi LLM ĐÃ CHẠY (usage != null), kể cả khi output không parse được.
    // Trước đây chỉ trừ khi parse OK → kẻ xấu ép fallback (JSON rác) gọi Groq vô hạn
    // mà daily rate-limit không tăng. "Đã gọi LLM = tính 1 lượt" đóng lỗ hổng đó.
    // Groq lỗi (throw) → usage=null → miễn phí (đúng thiết kế #2). Đồng bộ với dna-oracle.
    const charged = !!usage;
    let quota = peek;
    let tasteLeft = taste.remainingTaste;
    if (charged) {
      quota = await chargeAiMoneyCfoNarrationCredit(uid);
      if (taste.isTaste) {
        await incrementTasteUsed(uid, 'task.eval');
        tasteLeft = Math.max(0, taste.remainingTaste - 1);
      }
    }

    return NextResponse.json({
      source: result.deterministicFallback ? 'deterministic' : 'ai',
      reason: result.deterministicFallback
        ? charged
          ? 'Quản gia trả bản cơ bản lần này (đã dùng 1 lượt).'
          : 'Bản đánh giá cơ bản (không tốn credit).'
        : 'Quản gia đã thẩm định.',
      taste: taste.isTaste
        ? { isTaste: true, remaining: tasteLeft, quota: taste.tasteQuota }
        : { isTaste: false },
      feasibility: result.feasibility,
      eval: result.ai,
      quota: {
        monthKey: quota.monthKey, plan: quota.plan,
        usedCredits: quota.usedCredits, remainingCredits: quota.remainingCredits,
        chargedCredits: quota.chargedCredits,
      },
    });
  } catch (error) {
    return jsonResult('error', error instanceof Error ? error.message : 'AI task eval failed.');
  }
}
