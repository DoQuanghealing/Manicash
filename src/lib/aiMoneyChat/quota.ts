import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { UserProfile } from '@/types/user';
import {
  decideAiMoneyCharge,
  getAiMoneyQuotaConfig,
  getCurrentAiMoneyMonthKey,
  getCurrentAiMoneyDayKey,
  readDailyUsage,
  resolveAiMoneyPlan,
  type AiMoneyQuotaSnapshot,
} from './quotaCore';
import { getAiQuotaLimits, type AiFeature } from './aiQuotaPolicy';

export interface AiMoneyQuotaChargeResult extends AiMoneyQuotaSnapshot {
  chargedCredits: number;
}

async function getUserProfileForQuota(uid: string): Promise<Partial<UserProfile> | null> {
  const snap = await getAdminDb().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  return snap.data() as Partial<UserProfile>;
}

/**
 * Nạp bối cảnh quota (tháng/ngày/plan/trần) DÙNG CHUNG cho peek (read-only) và
 * charge (transaction). Một nguồn tính plan/limit — peek và charge không thể lệch.
 */
async function loadQuotaContext(uid: string, feature: AiFeature) {
  const db = getAdminDb();
  const config = getAiMoneyQuotaConfig();
  const monthKey = getCurrentAiMoneyMonthKey();
  const dayKey = getCurrentAiMoneyDayKey();
  const profile = await getUserProfileForQuota(uid);
  const plan = resolveAiMoneyPlan(profile);
  const perDayLimit = getAiQuotaLimits(plan, feature).perDay;
  const ref = db.doc(`users/${uid}/ai_usage/${monthKey}`);
  return { db, config, monthKey, dayKey, ref, plan, perDayLimit };
}

/** PURE: đọc usedCredits + số lượt feature HÔM NAY từ doc ai_usage. */
function readUsage(data: FirebaseFirestore.DocumentData, dayKey: string, feature: AiFeature) {
  const usedCredits = typeof data.usedCredits === 'number' ? data.usedCredits : 0;
  const daily = readDailyUsage(data, dayKey);
  const usedTodayFeature = feature === 'report' ? daily.report : daily.chat;
  return { usedCredits, daily, usedTodayFeature };
}

/**
 * PEEK (read-only) — kiểm tra "lượt này CÓ được phép không" mà KHÔNG trừ credit.
 * Dùng cho luồng POST-PAYMENT (#2): fail-fast trước khi gọi LLM, để không tiêu
 * token oan cho user đã hết hạn mức. KHÔNG phải nguồn sự thật — hàng rào cuối vẫn
 * là transaction trong chargeAiMoneyCredits (re-check trong lock, chống race).
 *
 * Trả về trạng thái HIỆN TẠI (chưa trừ): chargedCredits=0, usedCredits/remaining
 * là số thực tế lúc peek — client không hiểu nhầm là đã bị trừ.
 */
async function peekAiMoneyCredits(
  uid: string,
  feature: AiFeature,
  chargeCredits: number,
): Promise<AiMoneyQuotaChargeResult> {
  const { config, monthKey, dayKey, ref, plan, perDayLimit } = await loadQuotaContext(uid, feature);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() ?? {} : {};
  const { usedCredits, usedTodayFeature } = readUsage(data, dayKey, feature);

  const decision = decideAiMoneyCharge(
    { uid, monthKey, plan, feature, chargeCredits, usedCredits, usedTodayFeature, perDayLimit },
    config,
  );
  if (!decision.allowed) return decision;

  // Được phép nhưng CHƯA trừ: báo cáo trạng thái thực tế hiện tại, không phải sau-trừ.
  return {
    ...decision,
    usedCredits,
    remainingCredits: Math.max(0, decision.monthlyLimit - usedCredits),
    chargedCredits: 0,
  };
}

/**
 * Charge AI credits for a given usage kind. `callCounterField` tracks per-feature
 * call counts (e.g. fallbackParseCalls, cfoNarrationCalls) for analytics.
 *
 * POST-PAYMENT (#2): gọi hàm này SAU khi LLM đã trả kết quả dùng được. Transaction
 * re-check hạn mức trong lock nên vẫn an toàn nếu peek race — hàng rào cuối cùng.
 */
async function chargeAiMoneyCredits(
  uid: string,
  feature: AiFeature,
  chargeCredits: number,
  callCounterField: string,
): Promise<AiMoneyQuotaChargeResult> {
  const { db, config, monthKey, dayKey, ref, plan, perDayLimit } = await loadQuotaContext(uid, feature);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() ?? {} : {};
    const { usedCredits, daily, usedTodayFeature } = readUsage(data, dayKey, feature);

    // ── Quyết định (tháng + ngày) — logic PURE dùng chung với CI cost-simulation ──
    const decision = decideAiMoneyCharge(
      { uid, monthKey, plan, feature, chargeCredits, usedCredits, usedTodayFeature, perDayLimit },
      config,
    );
    if (!decision.allowed) {
      return decision;
    }

    // Ghi: credits tháng + counter feature ngày (set TƯỜNG MINH cả 2 daily counter để
    // reset đúng khi đổi ngày — KHÔNG dùng increment cho daily).
    transaction.set(
      ref,
      {
        uid,
        monthKey,
        plan,
        usedCredits: FieldValue.increment(chargeCredits),
        [callCounterField]: FieldValue.increment(1),
        dayKey,
        daily_report: daily.report + (feature === 'report' ? 1 : 0),
        daily_chat: daily.chat + (feature === 'chat' ? 1 : 0),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: snap.exists ? data.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return decision;
  });
}

/** Plan hiệu lực của user (đọc profile) — dùng cho gate cấp/taste ở route. */
export async function resolveUserPlanForUid(uid: string) {
  return resolveAiMoneyPlan(await getUserProfileForQuota(uid));
}

/* ─────────── Quota "nếm thử" (taste) — đếm theo feature/tháng ─────────── */

/** Field an toàn trên doc ai_usage: 'chat.deep' → 'taste_chat_deep'. */
function tasteField(feature: string): string {
  return `taste_${feature.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** Số lượt NẾM đã dùng tháng này cho feature. Lỗi đọc → 0 (fail-open, rộng lượng với user). */
export async function readTasteUsed(uid: string, feature: string): Promise<number> {
  try {
    const monthKey = getCurrentAiMoneyMonthKey();
    const snap = await getAdminDb().doc(`users/${uid}/ai_usage/${monthKey}`).get();
    const v = snap.exists ? snap.data()?.[tasteField(feature)] : 0;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/** Tăng counter nếm SAU khi đã giao kết quả (post-payment: nếm hỏng không tính). */
export async function incrementTasteUsed(uid: string, feature: string): Promise<void> {
  try {
    const monthKey = getCurrentAiMoneyMonthKey();
    await getAdminDb().doc(`users/${uid}/ai_usage/${monthKey}`).set(
      { uid, monthKey, [tasteField(feature)]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    console.error('[quota] failed to increment taste counter:', error);
  }
}

/* ─────────── Fallback parse (chat) ─────────── */

export async function peekAiMoneyFallbackCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return peekAiMoneyCredits(uid, 'chat', config.fallbackParseCredits);
}

export async function chargeAiMoneyFallbackCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return chargeAiMoneyCredits(uid, 'chat', config.fallbackParseCredits, 'fallbackParseCalls');
}

/* ─────────── CFO narration / follow-up (report) ─────────── */

export async function peekAiMoneyCfoNarrationCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return peekAiMoneyCredits(uid, 'report', config.cfoNarrationCredits);
}

export async function chargeAiMoneyCfoNarrationCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return chargeAiMoneyCredits(uid, 'report', config.cfoNarrationCredits, 'cfoNarrationCalls');
}
