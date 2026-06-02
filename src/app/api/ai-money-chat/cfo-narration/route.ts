import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { chargeAiMoneyCfoNarrationCredit } from '@/lib/aiMoneyChat/quota';
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

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

async function callGroq(apiKey: string, input: CfoNarrationInput): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MONEY_CHAT_GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: CFO_NARRATION_SYSTEM_PROMPT },
        { role: 'user', content: buildCfoNarrationPrompt(input) },
      ],
      temperature: 0.6,
      max_tokens: 320,
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
  return content;
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return jsonResult('no-key', 'GROQ_API_KEY is not configured.');
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

    const quota = await chargeAiMoneyCfoNarrationCredit(uid);
    if (!quota.allowed) {
      return jsonResult('quota-exceeded', quota.reason, null, 402);
    }

    const raw = await callGroq(apiKey, input);
    const narration = validateNarration(raw);
    if (!narration) {
      return jsonResult('error', 'AI narration failed validation.');
    }

    await writeNarrationCache(uid, monthKey, fingerprint, narration);

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
