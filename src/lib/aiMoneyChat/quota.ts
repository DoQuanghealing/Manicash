import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { UserProfile } from '@/types/user';
import {
  evaluateQuota,
  getAiMoneyQuotaConfig,
  getCurrentAiMoneyMonthKey,
  resolveAiMoneyPlan,
  type AiMoneyQuotaSnapshot,
} from './quotaCore';

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
  chargeCredits: number,
  callCounterField: string,
): Promise<AiMoneyQuotaChargeResult> {
  const db = getAdminDb();
  const config = getAiMoneyQuotaConfig();
  const monthKey = getCurrentAiMoneyMonthKey();
  const profile = await getUserProfileForQuota(uid);
  const plan = resolveAiMoneyPlan(profile);
  const ref = db.doc(`users/${uid}/ai_usage/${monthKey}`);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() ?? {} : {};
    const usedCredits = typeof data.usedCredits === 'number' ? data.usedCredits : 0;
    const quota = evaluateQuota({ uid, monthKey, plan, usedCredits, chargeCredits }, config);

    if (!quota.allowed) {
      return {
        ...quota,
        chargedCredits: 0,
      };
    }

    transaction.set(
      ref,
      {
        uid,
        monthKey,
        plan,
        usedCredits: FieldValue.increment(chargeCredits),
        [callCounterField]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: snap.exists ? data.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      ...quota,
      usedCredits: usedCredits + chargeCredits,
      remainingCredits: Math.max(0, quota.monthlyLimit - usedCredits - chargeCredits),
      chargedCredits: chargeCredits,
    };
  });
}

export async function chargeAiMoneyFallbackCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return chargeAiMoneyCredits(uid, config.fallbackParseCredits, 'fallbackParseCalls');
}

export async function chargeAiMoneyCfoNarrationCredit(uid: string): Promise<AiMoneyQuotaChargeResult> {
  const config = getAiMoneyQuotaConfig();
  return chargeAiMoneyCredits(uid, config.cfoNarrationCredits, 'cfoNarrationCalls');
}
