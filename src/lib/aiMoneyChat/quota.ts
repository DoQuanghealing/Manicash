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
 * Charge AI credits for a given usage kind. `callCounterField` tracks per-feature
 * call counts (e.g. fallbackParseCalls, cfoNarrationCalls) for analytics.
 */
async function chargeAiMoneyCredits(
  uid: string,
  feature: AiFeature,
  chargeCredits: number,
  callCounterField: string,
): Promise<AiMoneyQuotaChargeResult> {
  const db = getAdminDb();
  const config = getAiMoneyQuotaConfig();
  const monthKey = getCurrentAiMoneyMonthKey();
  const dayKey = getCurrentAiMoneyDayKey();
  const profile = await getUserProfileForQuota(uid);
  const plan = resolveAiMoneyPlan(profile);
  const perDayLimit = getAiQuotaLimits(plan, feature).perDay;
  const ref = db.doc(`users/${uid}/ai_usage/${monthKey}`);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() ?? {} : {};
    const usedCredits = typeof data.usedCredits === 'number' ? data.usedCredits : 0;
    const daily = readDailyUsage(data, dayKey); // tự reset 0 khi sang ngày
    const usedTodayFeature = feature === 'report' ? daily.report : daily.chat;

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

export async function chargeAiMoneyFallbackCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return chargeAiMoneyCredits(uid, 'chat', config.fallbackParseCredits, 'fallbackParseCalls');
}

export async function chargeAiMoneyCfoNarrationCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return chargeAiMoneyCredits(uid, 'report', config.cfoNarrationCredits, 'cfoNarrationCalls');
}
