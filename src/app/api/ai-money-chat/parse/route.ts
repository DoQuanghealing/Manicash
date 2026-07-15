import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import {
  type AiFallbackCandidate,
  type AiFallbackRequestPayload,
  validateAiFallbackCandidate,
} from '@/lib/aiMoneyChat/aiFallback';
import { chargeAiMoneyFallbackCredit } from '@/lib/aiMoneyChat/quota';
import { getTaxonomyByDirection } from '@/lib/aiMoneyChat/taxonomy';
import { checkSpendBreaker, logAiUsage } from '@/lib/aiMoneyChat/llm/aiUsageLog';
import { estimateCostVnd } from '@/lib/aiMoneyChat/llm/aiCostCore';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_RAW_TEXT_LENGTH = 200;

type FallbackSource = 'ai' | 'disabled' | 'no-key' | 'unauthorized' | 'quota-exceeded' | 'error';

function parsePayload(body: unknown): AiFallbackRequestPayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const rawText = typeof b.rawText === 'string' ? b.rawText.trim().slice(0, MAX_RAW_TEXT_LENGTH) : '';
  if (!rawText) return null;

  const local = b.localIntent && typeof b.localIntent === 'object'
    ? b.localIntent as Record<string, unknown>
    : {};

  return {
    rawText,
    localIntent: {
      type: local.type === 'income' || local.type === 'expense' || local.type === 'transfer'
        ? local.type
        : undefined,
      amount: typeof local.amount === 'number' && Number.isFinite(local.amount)
        ? Math.max(0, Math.round(local.amount))
        : undefined,
      categoryId: typeof local.categoryId === 'string' ? local.categoryId : undefined,
      confidence: local.confidence === 'high' || local.confidence === 'medium' || local.confidence === 'low'
        ? local.confidence
        : undefined,
    },
  };
}

function buildPrompt(payload: AiFallbackRequestPayload): string {
  const expenseCategories = getTaxonomyByDirection('expense').map((category) => category.id).join(', ');
  const incomeCategories = getTaxonomyByDirection('income').map((category) => category.id).join(', ');

  return `Phan loai cau giao dich tieng Viet cho app tai chinh.

Raw text: "${payload.rawText}"
Local parser:
- type: ${payload.localIntent.type ?? 'unknown'}
- amount: ${payload.localIntent.amount ?? 'unknown'}
- categoryId: ${payload.localIntent.categoryId ?? 'unknown'}
- confidence: ${payload.localIntent.confidence ?? 'unknown'}

Allowed expense categoryId: ${expenseCategories}
Allowed income categoryId: ${incomeCategories}

Return ONLY JSON:
{
  "type": "income" | "expense",
  "amount": number,
  "categoryId": "one allowed categoryId",
  "note": "short Vietnamese note",
  "confidence": "high" | "medium" | "low",
  "reason": "short reason"
}

Rules:
- Do not invent categoryId.
- Amount is VND integer.
- If unsure, keep local amount and choose the broadest allowed category.
- No markdown.`;
}

interface GroqCallResult {
  candidate: AiFallbackCandidate;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
}

async function callGroq(apiKey: string, payload: AiFallbackRequestPayload): Promise<GroqCallResult> {
  const model = process.env.AI_MONEY_CHAT_GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You classify Vietnamese personal finance chat messages. Return strict JSON only.',
        },
        { role: 'user', content: buildPrompt(payload) },
      ],
      temperature: 0.1,
      max_tokens: 220,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Groq response missing content.');
  }

  return {
    candidate: JSON.parse(content) as AiFallbackCandidate,
    model,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    tokensTotal: data.usage?.total_tokens ?? 0,
  };
}

function jsonResult(source: FallbackSource, reason: string, intent: unknown = null, status = 200) {
  return NextResponse.json({ source, reason, intent }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResult('error', 'Invalid JSON payload.', null, 400);
  }

  const payload = parsePayload(body);
  if (!payload) {
    return jsonResult('error', 'Invalid AI fallback payload.', null, 400);
  }

  if (process.env.AI_MONEY_CHAT_AI_FALLBACK_ENABLED !== 'true') {
    return jsonResult('disabled', 'AI fallback is disabled by server flag.');
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return jsonResult('no-key', 'GROQ_API_KEY is not configured.');
  }

  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) {
      return jsonResult('unauthorized', 'AI fallback requires a verified signed-in user.', null, 401);
    }

    // T2 — cầu dao ngân sách ngày TRƯỚC khi charge credit (user không mất lượt oan).
    const breaker = await checkSpendBreaker();
    if (!breaker.allowed) {
      return jsonResult('disabled', 'Ngân sách AI hôm nay đã chạm trần an toàn. Thử lại sau ít giờ nhé.');
    }

    const quota = await chargeAiMoneyFallbackCredit(uid);
    if (!quota.allowed) {
      return jsonResult('quota-exceeded', quota.reason, null, 402);
    }

    const groq = await callGroq(apiKey, payload);
    // T2 — ghi sổ ai_usage_log (token đã tiêu kể cả khi validate fail phía dưới).
    await logAiUsage({
      uid,
      feature: 'fallback_parse',
      model: groq.model,
      provider: 'groq',
      tokensIn: groq.tokensIn,
      tokensOut: groq.tokensOut,
      tokensTotal: groq.tokensTotal,
      costVnd: estimateCostVnd(groq.model, groq.tokensIn, groq.tokensOut),
      fallbackUsed: false,
      latencyMs: 0,
    });
    const validated = validateAiFallbackCandidate(groq.candidate, payload);
    return NextResponse.json({
      source: validated.intent ? 'ai' : 'error',
      reason: validated.reason,
      intent: validated.intent,
      quota: {
        monthKey: quota.monthKey,
        plan: quota.plan,
        usedCredits: quota.usedCredits,
        remainingCredits: quota.remainingCredits,
        chargedCredits: quota.chargedCredits,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'AI fallback failed.';
    return jsonResult('error', reason);
  }
}
