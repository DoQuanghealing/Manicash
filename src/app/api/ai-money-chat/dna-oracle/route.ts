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
  resolveUserPlanForUid,
} from '@/lib/aiMoneyChat/quota';
import { minLevelFor } from '@/lib/monetization/butlerFeatures';
import { checkSpendBreaker, checkUserCostCeiling, logAiUsage } from '@/lib/aiMoneyChat/llm/aiUsageLog';
import { estimateCostVnd } from '@/lib/aiMoneyChat/llm/aiCostCore';
import { resolveChatProvider, callChatCompletion } from '@/lib/aiMoneyChat/llm/chatProvider';
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
  const provider = resolveChatProvider();
  if (!provider) return jsonResult('no-key', 'No LLM API key configured (AI_LLM_API_KEY / GROQ_API_KEY).');

  try {
    const uid = await getVerifiedRequestUid(req);
    if (!uid) return jsonResult('unauthorized', 'DNA Oracle requires a verified signed-in user.', 401);

    const breaker = await checkSpendBreaker();
    if (!breaker.allowed) {
      return jsonResult('disabled', 'Ngân sách AI hôm nay đã chạm trần an toàn. Thử lại sau ít giờ nhé.');
    }

    // Cần plan hiệu lực để gate — đọc TRƯỚC quota (thứ tự: cấp → quota → ceiling)
    // để user chưa đủ cấp nhận đúng "upgrade-required", không phải "quota-exceeded".
    const plan = await resolveUserPlanForUid(uid);

    // ── Gate CỨNG cấp 3 (redteam HIGH) ──────────────────────────────────────
    // dna.oracle là đặc quyền Phú Vương (PO chốt 2026-07-22: KHÔNG taste, chỉ cấp 3)
    // + tốn credit LLM thật + đọc dữ liệu nhạy cảm nhất. KHÁC task.eval/care (FOMO):
    // khoá THẲNG theo plan pro_plus, ĐỘC LẬP với NEXT_PUBLIC_BUTLER_BILLING_ENFORCED
    // — nếu chỉ dựa billingLevelCap thì khi enforce chưa bật, cap=3 cho mọi user →
    // Pro (cấp 2) lọt qua API. Gate theo plan đóng lỗ hổng đó ngay cả trong giai đoạn FOMO.
    if (plan !== 'pro_plus') {
      return jsonResult(
        'upgrade-required',
        `Bản luận giải DNA đầy đủ dành cho Phú Vương (cấp ${minLevelFor('dna.oracle')}). Nâng cấp để quản gia đọc vị ngài.`,
        402,
      );
    }

    // #2 POST-PAYMENT — peek quota (kho report) sau gate cấp, CHƯA trừ credit.
    const peek = await peekAiMoneyCfoNarrationCredit(uid);
    if (!peek.allowed) return jsonResult('quota-exceeded', peek.reason, 402);

    // T6 — trần fix cứng chi phí/user/tháng: vượt → degrade mềm.
    const ceiling = await checkUserCostCeiling(uid, peek.plan);
    if (!ceiling.allowed) {
      return jsonResult('disabled', 'Quản gia đã tận tâm phục vụ ngài cả tháng — nay xin nghỉ dưỡng não bộ ít hôm. Mời ngài dùng bản cơ bản, đầu tháng sau tôi lại hầu ngài.');
    }

    // runDnaOracle KHÔNG throw: Groq lỗi (throw) → fallback, usage=null → KHÔNG trừ.
    let usage: { model: string; tokensIn: number; tokensOut: number } | null = null;
    const result = await runDnaOracle(ctx, {
      generate: async () => {
        const g = await callChatCompletion(provider, {
          system: buildDnaOracleSystemPrompt(),
          user: buildDnaOracleUserPrompt(ctx),
          temperature: 0.5,
          maxTokens: 700,
          jsonMode: true,
        });
        usage = { model: g.model, tokensIn: g.tokensIn, tokensOut: g.tokensOut };
        return { content: g.content, provider: provider.label };
      },
    });

    if (usage) {
      const u = usage as { model: string; tokensIn: number; tokensOut: number };
      await logAiUsage({
        uid, feature: 'dna_oracle', model: u.model, provider: provider.label,
        tokensIn: u.tokensIn, tokensOut: u.tokensOut, tokensTotal: u.tokensIn + u.tokensOut,
        costVnd: estimateCostVnd(u.model, u.tokensIn, u.tokensOut),
        fallbackUsed: result.deterministicFallback, latencyMs: 0,
      });
    }

    // ── Trừ credit khi LLM ĐÃ CHẠY, kể cả khi output không parse được (redteam MEDIUM) ─
    // usage != null nghĩa là Groq đã trả lời (tốn tiền thật). Nếu chỉ trừ khi parse
    // thành công, kẻ xấu ép fallback (injection → JSON rác) sẽ gọi Groq vô hạn mà
    // daily rate-limit không bao giờ tăng. "Đã gọi LLM = tính 1 lượt" đóng lỗ hổng.
    // Fallback do KHÔNG gọi LLM (disabled/no-key/Groq throw) → usage=null → miễn phí.
    const charged = !!usage;
    let quota = peek;
    if (charged) {
      quota = await chargeAiMoneyCfoNarrationCredit(uid);
    }

    // source phản ánh NỘI DUNG report (ai vs bản cơ bản); charged phản ánh có trừ
    // credit không. Hai thứ tách biệt: LLM chạy nhưng trả rác → source=deterministic
    // NHƯNG vẫn charged (đã tốn Groq).
    const source: Src = result.deterministicFallback ? 'deterministic' : 'ai';
    const reason = result.deterministicFallback
      ? charged
        ? 'Quản gia trả bản cơ bản lần này (đã dùng 1 lượt).'
        : 'Bản luận giải cơ bản (không tốn credit).'
      : 'Quản gia đã luận giải.';

    // B4 — lưu BẢN PHÂN TÍCH (không raw) để đối soát + đồng bộ thiết bị sau này.
    const analyzedAt = new Date().toISOString();
    await dnaDocRef(uid).set({
      personaId: persona.primary.id,
      secondaryId: persona.secondary?.id ?? null,
      isHybrid: persona.isHybrid,
      scores: persona.scores,
      report: result.report,
      source,
      reflectionConsent: reflections.length > 0,
      answeredCount: persona.answeredCount,
      analyzedAt,
    });

    return NextResponse.json({
      source,
      reason,
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
    // KHÔNG trả error.message ra client (có thể lộ chi tiết DB/nội bộ — redteam LOW).
    console.error('[dna-oracle] POST failed:', error);
    return jsonResult('error', 'Quản gia gặp trục trặc khi luận giải. Thử lại sau nhé.');
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
