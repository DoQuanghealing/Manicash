/* ═══ API — Financial DNA Oracle (PV-3 · Cấp 3) ═══
 * POST: answers (+ reflections nếu consent) → LLM luận giải Oracle 4 phần.
 * Billing POST-PAYMENT (#2): peek quota (kho report) TRƯỚC, CHỈ trừ credit khi LLM
 * thật sự giao kết quả (fallback deterministic → 0đ). Gate CỨNG cấp 3 (dna.oracle)
 * — KHÔNG có suất nếm (quyết định PO 2026-07-22: đặc quyền Phú Vương).
 *
 * ⚠️ DỮ LIỆU NHẠY CẢM: raw reflections CHỈ sống trong request này (đi vào prompt
 * rồi bỏ). Firestore users/{uid}/financial_dna/current chỉ giữ BẢN PHÂN TÍCH
 * (persona + scores + report + consent flag). Xoá tài khoản → recursiveDelete
 * users/{uid} tự phủ subcollection này; DELETE dưới đây là nút xoá riêng.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  peekAiMoneyCfoNarrationCredit,
  chargeAiMoneyCfoNarrationCredit,
} from '@/lib/aiMoneyChat/quota';
import { billingLevelCap, hasFeature, minLevelFor } from '@/lib/monetization/butlerFeatures';
import { checkSpendBreaker, checkUserCostCeiling, logAiUsage } from '@/lib/aiMoneyChat/llm/aiUsageLog';
import { estimateCostVnd } from '@/lib/aiMoneyChat/llm/aiCostCore';
import { sanitizeDnaAnswers, DNA_QUESTIONS } from '@/lib/aiMoneyChat/prism/dna/dnaQuestions';
import { resolveDnaPersona } from '@/lib/aiMoneyChat/prism/dna/personaEngine';
import {
  buildDnaOracleSystemPrompt,
  buildDnaOracleUserPrompt,
  type DnaOracleContext,
  type DnaReflectionInput,
  type DnaCapacityScores,
} from '@/lib/aiMoneyChat/prism/dna/dnaOraclePrompt';
import { runDnaOracle } from '@/lib/aiMoneyChat/prism/dna/dnaOracleService';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Cần trả lời tối thiểu 6/8 câu mới luận giải bản đầy đủ (đủ tín hiệu). */
const MIN_ANSWERS_FOR_FULL = 6;
const MAX_REFLECTIONS = 3;
const MAX_REFLECTION_LEN = 600;
const MAX_REFLECTION_PROMPT_LEN = 200;

type Src = 'ai' | 'deterministic' | 'disabled' | 'no-key' | 'unauthorized' | 'quota-exceeded' | 'upgrade-required' | 'error';

function jsonResult(source: Src, reason: string, status = 200) {
  return NextResponse.json({ source, reason }, { status });
}

/** Khu ky tu dieu khien (giu xuong dong/tab) - phong payload ban di vao prompt. */
function stripControl(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) out += ch;
  }
  return out;
}

function parseReflections(v: unknown): DnaReflectionInput[] {
  if (!Array.isArray(v)) return [];
  const out: DnaReflectionInput[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const { prompt, text } = item as Record<string, unknown>;
    if (typeof prompt !== 'string' || typeof text !== 'string') continue;
    const cleanText = stripControl(text).trim().slice(0, MAX_REFLECTION_LEN);
    if (!cleanText) continue;
    out.push({
      prompt: stripControl(prompt).trim().slice(0, MAX_REFLECTION_PROMPT_LEN),
      text: cleanText,
    });
    if (out.length >= MAX_REFLECTIONS) break;
  }
  return out;
}

function parseCapacity(v: unknown): DnaCapacityScores | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const num = (x: unknown) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x))) : null;
  const FDS = num(o.FDS);
  const TAS = num(o.TAS);
  const IPS = num(o.IPS);
  const MMS = num(o.MMS);
  if (FDS === null || TAS === null || IPS === null || MMS === null) return undefined;
  return { FDS, TAS, IPS, MMS };
}

interface GroqResult { content: string; model: string; tokensIn: number; tokensOut: number }

async function callGroq(apiKey: string, ctx: DnaOracleContext): Promise<GroqResult> {
  const model = process.env.AI_MONEY_CHAT_GROQ_MODEL || 'llama-3.3-70b-versatile';
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildDnaOracleSystemPrompt() },
        { role: 'user', content: buildDnaOracleUserPrompt(ctx) },
      ],
      temperature: 0.5,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq response missing content.');
  return { content, model, tokensIn: data.usage?.prompt_tokens ?? 0, tokensOut: data.usage?.completion_tokens ?? 0 };
}

function dnaDocRef(uid: string) {
  return getAdminDb().doc(`users/${uid}/financial_dna/current`);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonResult('error', 'Invalid JSON payload.', 400); }
  if (!body || typeof body !== 'object') return jsonResult('error', 'Invalid DNA payload.', 400);
  const b = body as Record<string, unknown>;

  // Server TỰ tính lại persona từ answers — không tin persona client gửi lên.
  const answers = sanitizeDnaAnswers(b.answers);
  if (answers.length < MIN_ANSWERS_FOR_FULL) {
    return jsonResult('error', `Cần trả lời ít nhất ${MIN_ANSWERS_FOR_FULL}/${DNA_QUESTIONS.length} câu để luận giải.`, 400);
  }
  const persona = resolveDnaPersona(answers);
  if (!persona) return jsonResult('error', 'Không chấm được persona từ câu trả lời.', 400);

  const reflections = parseReflections(b.reflections);
  const ctx: DnaOracleContext = { persona, answers, reflections, capacity: parseCapacity(b.capacity) };

  if (process.env.AI_MONEY_CHAT_AI_FALLBACK_ENABLED !== 'true') {
    return jsonResult('disabled', 'AI DNA Oracle is disabled by server flag.');
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return jsonResult('no-key', 'GROQ_API_KEY is not configured.');

  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) return jsonResult('unauthorized', 'DNA Oracle requires a verified signed-in user.', 401);

    const breaker = await checkSpendBreaker();
    if (!breaker.allowed) {
      return jsonResult('disabled', 'Ngân sách AI hôm nay đã chạm trần an toàn. Thử lại sau ít giờ nhé.');
    }

    // #2 POST-PAYMENT — peek quota (kho report) TRƯỚC, CHƯA trừ credit.
    const peek = await peekAiMoneyCfoNarrationCredit(uid);
    if (!peek.allowed) return jsonResult('quota-exceeded', peek.reason, 402);

    // T6 — trần fix cứng chi phí/user/tháng: vượt → degrade mềm.
    const ceiling = await checkUserCostCeiling(uid, peek.plan);
    if (!ceiling.allowed) {
      return jsonResult('disabled', 'Quản gia đã tận tâm phục vụ ngài cả tháng — nay xin nghỉ dưỡng não bộ ít hôm. Mời ngài dùng bản cơ bản, đầu tháng sau tôi lại hầu ngài.');
    }

    // Gate CỨNG cấp 3 — dna.oracle KHÔNG có suất nếm (đặc quyền Phú Vương).
    if (!hasFeature(billingLevelCap(peek.plan), 'dna.oracle')) {
      return jsonResult(
        'upgrade-required',
        `Bản luận giải DNA đầy đủ dành cho Phú Vương (cấp ${minLevelFor('dna.oracle')}). Nâng cấp để quản gia đọc vị ngài.`,
        402,
      );
    }

    // runDnaOracle KHÔNG throw: Groq lỗi → fallback deterministic (0đ, không trừ).
    let usage: { model: string; tokensIn: number; tokensOut: number } | null = null;
    const result = await runDnaOracle(ctx, {
      generate: async () => {
        const g = await callGroq(apiKey, ctx);
        usage = { model: g.model, tokensIn: g.tokensIn, tokensOut: g.tokensOut };
        return { content: g.content, provider: 'groq' };
      },
    });

    if (usage) {
      const u = usage as { model: string; tokensIn: number; tokensOut: number };
      await logAiUsage({
        uid, feature: 'dna_oracle', model: u.model, provider: 'groq',
        tokensIn: u.tokensIn, tokensOut: u.tokensOut, tokensTotal: u.tokensIn + u.tokensOut,
        costVnd: estimateCostVnd(u.model, u.tokensIn, u.tokensOut), fallbackUsed: false, latencyMs: 0,
      });
    }

    // #2 — CHỈ trừ credit khi LLM thật sự giao kết quả.
    let quota = peek;
    if (!result.deterministicFallback) {
      quota = await chargeAiMoneyCfoNarrationCredit(uid);
    }

    // B4 — lưu BẢN PHÂN TÍCH (không raw) để đối soát + đồng bộ thiết bị sau này.
    const analyzedAt = new Date().toISOString();
    await dnaDocRef(uid).set({
      personaId: persona.primary.id,
      secondaryId: persona.secondary?.id ?? null,
      isHybrid: persona.isHybrid,
      scores: persona.scores,
      report: result.report,
      source: result.deterministicFallback ? 'deterministic' : 'ai',
      reflectionConsent: reflections.length > 0,
      answeredCount: persona.answeredCount,
      analyzedAt,
    });

    return NextResponse.json({
      source: result.deterministicFallback ? 'deterministic' : 'ai',
      reason: result.deterministicFallback ? 'Bản luận giải cơ bản (không tốn credit).' : 'Quản gia đã luận giải.',
      persona: {
        id: persona.primary.id,
        label: persona.primary.label,
        icon: persona.primary.icon,
        secondaryId: persona.secondary?.id ?? null,
        isHybrid: persona.isHybrid,
        hybridLabel: persona.hybridLabel ?? null,
        scores: persona.scores,
      },
      report: result.report,
      analyzedAt,
      quota: {
        monthKey: quota.monthKey, plan: quota.plan,
        usedCredits: quota.usedCredits, remainingCredits: quota.remainingCredits,
        chargedCredits: quota.chargedCredits,
      },
    });
  } catch (error) {
    return jsonResult('error', error instanceof Error ? error.message : 'DNA Oracle failed.');
  }
}

/** Nút "xoá riêng" bản phân tích DNA (spec §6) — chỉ chủ tài khoản xoá của mình. */
export async function DELETE(req: NextRequest) {
  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) return jsonResult('unauthorized', 'Cần đăng nhập để xoá.', 401);
    await dnaDocRef(uid).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonResult('error', error instanceof Error ? error.message : 'Xoá thất bại.', 500);
  }
}
