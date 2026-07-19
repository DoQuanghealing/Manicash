/* ═══ AI Usage Log — Sổ ghi từng lượt LLM + cầu dao ngân sách ngày (T2) ═══
 * Chốt chặn #6 + #7 (docs/BUTLER_TIERS_AND_API_COST_PLAN.md):
 *   - `ai_usage_log/{autoId}`: từng lượt {uid, feature, model, tokens, costVnd...}
 *     → đối soát hóa đơn OpenAI/Groq hằng tuần + data R&D (hồ sơ doanh nghiệp).
 *   - `ai_spend_daily/{dayKey}`: tổng chi/ngày toàn nền tảng → checkSpendBreaker.
 *
 * BACKEND KÉP (mirror conversationStore): Firestore (Admin SDK) khi có env;
 * fallback in-memory khi không (test/dev). logAiUsage KHÔNG BAO GIỜ throw —
 * hỏng ghi sổ không được làm gãy lượt chat của user.
 */

import { getCurrentAiMoneyDayKey, getCurrentAiMoneyMonthKey } from '../quotaCore';
import {
  evaluateSpendBreaker,
  evaluateUserCostCeiling,
  type SpendBreakerDecision,
  type UserCostCeilingDecision,
  type CostCeilingTier,
} from './aiCostCore';

export interface AiUsageEntry {
  uid: string;
  /** Loại lượt: 'cfo' | 'deep' | 'rescue' | 'fallback_parse' | 'cfo_narration' | ... */
  feature: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  costVnd: number;
  fallbackUsed: boolean;
  latencyMs: number;
  at: string;
  dayKey: string;
  monthKey: string;
}

export type AiUsageInput = Omit<AiUsageEntry, 'at' | 'dayKey' | 'monthKey'>;

const LOG_COLLECTION = 'ai_usage_log';
const DAILY_COLLECTION = 'ai_spend_daily';

/* ─────────── In-memory fallback (test/dev không có firebase env) ─────────── */
const STORE_KEY = Symbol.for('manicash.aiMoneyChat.aiUsageLog');
interface MemUsageStore {
  entries: AiUsageEntry[];
  dailyVnd: Map<string, number>;
  /** key `${uid}:${monthKey}` → tổng chi VND tháng của user (trần fix cứng T6). */
  userMonthlyVnd: Map<string, number>;
}
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MemUsageStore };

function memStore(): MemUsageStore {
  const g = globalThis as GlobalWithStore;
  if (!g[STORE_KEY]) g[STORE_KEY] = { entries: [], dailyVnd: new Map(), userMonthlyVnd: new Map() };
  return g[STORE_KEY]!;
}

/** Firestore (Admin SDK) nếu cấu hình đủ; null → in-memory. */
async function tryDb(): Promise<FirebaseFirestore.Firestore | null> {
  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin');
    return getAdminDb(); // throws nếu thiếu env
  } catch {
    return null;
  }
}

/** Khóa feature an toàn cho field path Firestore (byFeature.<key>). */
function safeFeatureKey(feature: string): string {
  return feature.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) || 'unknown';
}

/**
 * Ghi 1 lượt LLM vào sổ + cộng dồn tổng chi ngày. KHÔNG BAO GIỜ throw.
 * Gọi SAU khi lượt LLM thành công (có token thật).
 */
export async function logAiUsage(input: AiUsageInput): Promise<void> {
  try {
    const now = new Date();
    const entry: AiUsageEntry = {
      ...input,
      feature: safeFeatureKey(input.feature),
      costVnd: Math.max(0, input.costVnd),
      at: now.toISOString(),
      dayKey: getCurrentAiMoneyDayKey(now),
      monthKey: getCurrentAiMoneyMonthKey(now),
    };

    const db = await tryDb();
    if (db) {
      const { FieldValue } = await import('firebase-admin/firestore');
      await Promise.all([
        db.collection(LOG_COLLECTION).add(entry),
        db.collection(DAILY_COLLECTION).doc(entry.dayKey).set(
          {
            dayKey: entry.dayKey,
            totalVnd: FieldValue.increment(entry.costVnd),
            calls: FieldValue.increment(1),
            byFeature: { [entry.feature]: FieldValue.increment(entry.costVnd) },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
        // T6 — cộng dồn chi phí THỰC/user/tháng (co-located với credit doc) → trần fix cứng.
        db.doc(`users/${entry.uid}/ai_usage/${entry.monthKey}`).set(
          { costVndThisMonth: FieldValue.increment(entry.costVnd) },
          { merge: true },
        ),
      ]);
      return;
    }

    const mem = memStore();
    mem.entries.push(entry);
    mem.dailyVnd.set(entry.dayKey, (mem.dailyVnd.get(entry.dayKey) ?? 0) + entry.costVnd);
    const umKey = `${entry.uid}:${entry.monthKey}`;
    mem.userMonthlyVnd.set(umKey, (mem.userMonthlyVnd.get(umKey) ?? 0) + entry.costVnd);
  } catch (error) {
    // Ghi sổ hỏng → cảnh báo, KHÔNG gãy lượt của user. Breaker sẽ đếm thiếu lượt này
    // (chấp nhận: đối soát hóa đơn tuần sẽ lộ lệch).
    console.error('[aiUsageLog] failed to log usage:', error);
  }
}

/** Tổng chi API hôm nay (VND) toàn nền tảng. Lỗi đọc → 0 (fail-open, xem checkSpendBreaker). */
export async function getSpentTodayVnd(dayKey = getCurrentAiMoneyDayKey()): Promise<number> {
  try {
    const db = await tryDb();
    if (db) {
      const snap = await db.collection(DAILY_COLLECTION).doc(dayKey).get();
      const total = snap.exists ? snap.data()?.totalVnd : 0;
      return typeof total === 'number' && Number.isFinite(total) ? total : 0;
    }
    return memStore().dailyVnd.get(dayKey) ?? 0;
  } catch (error) {
    console.error('[aiUsageLog] failed to read daily spend:', error);
    return 0;
  }
}

/**
 * Cầu dao ngân sách ngày. Gọi TRƯỚC mọi lượt LLM (và TRƯỚC khi charge credit user
 * — sập cầu dao thì user không được mất lượt oan).
 * Fail-OPEN khi Firestore lỗi: quota per-user vẫn là rào chính; cầu dao là lưới phụ.
 */
export async function checkSpendBreaker(): Promise<SpendBreakerDecision> {
  const spent = await getSpentTodayVnd();
  return evaluateSpendBreaker(spent);
}

/** Tổng chi phí API THỰC của 1 user trong tháng (VND). Lỗi đọc → 0 (fail-open). */
export async function getUserSpentThisMonthVnd(
  uid: string,
  monthKey = getCurrentAiMoneyMonthKey(),
): Promise<number> {
  try {
    const db = await tryDb();
    if (db) {
      const snap = await db.doc(`users/${uid}/ai_usage/${monthKey}`).get();
      const total = snap.exists ? snap.data()?.costVndThisMonth : 0;
      return typeof total === 'number' && Number.isFinite(total) ? total : 0;
    }
    return memStore().userMonthlyVnd.get(`${uid}:${monthKey}`) ?? 0;
  } catch (error) {
    console.error('[aiUsageLog] failed to read user monthly spend:', error);
    return 0;
  }
}

/**
 * TRẦN FIX CỨNG mỗi user/tháng (T6). Gọi TRƯỚC lượt LLM tốn tiền: vượt trần → caller
 * degrade mềm về bản deterministic 0đ. Fail-OPEN (đọc lỗi → 0 → allowed) như breaker.
 */
export async function checkUserCostCeiling(uid: string, tier: CostCeilingTier): Promise<UserCostCeilingDecision> {
  const spent = await getUserSpentThisMonthVnd(uid);
  return evaluateUserCostCeiling(spent, tier);
}

/* ─────────── Test helpers (in-memory) ─────────── */

export function __clearAiUsageLogForTest(): void {
  const mem = memStore();
  mem.entries = [];
  mem.dailyVnd.clear();
  mem.userMonthlyVnd.clear();
}

export function __getAiUsageEntriesForTest(): AiUsageEntry[] {
  return [...memStore().entries];
}
