/* ═══ AI Quota Policy (Free/Pro · per-feature · per-day + per-month) ═══
 * PURE functions. Quyết định 1 lượt gọi AI có được phép không + còn bao nhiêu.
 *
 * 2 tính năng TỐN TOKEN, mỗi cái 1 "kho" riêng (free dùng được, có giới hạn):
 *   - report : báo cáo CFO viết riêng (AI narration).
 *   - chat   : câu hỏi/truy xuất khó mà logic backend không tự xử → AI xử lý.
 *
 * Free 1 lượt/ngày mỗi loại; Pro nhiều hơn nhưng KHÔNG thả ga (daily + monthly cap).
 * Engine thuần: caller truyền usedToday/usedThisMonth (đếm theo dayKey/monthKey),
 * engine không tự lấy giờ.
 */
import type { UserProfile } from '@/types/user';
import { resolveAiMoneyPlan } from './quotaCore';

export type AiFeature = 'report' | 'chat';
export type AiTier = 'free' | 'pro';

export interface AiQuotaLimits {
  perDay: number;
  perMonth: number;
}

/** Giới hạn mặc định. Có thể override bằng env (đọc ở getAiQuotaLimits). */
export const DEFAULT_AI_QUOTA: Record<AiTier, Record<AiFeature, AiQuotaLimits>> = {
  free: {
    report: { perDay: 1, perMonth: 31 }, // 1/ngày là rào chính; monthly không bó thêm
    chat: { perDay: 1, perMonth: 31 },
  },
  pro: {
    report: { perDay: 3, perMonth: 60 },
    chat: { perDay: 20, perMonth: 300 },
  },
};

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

/** Đọc giới hạn (env override tùy chọn, fallback DEFAULT_AI_QUOTA). */
export function getAiQuotaLimits(tier: AiTier, feature: AiFeature): AiQuotaLimits {
  const d = DEFAULT_AI_QUOTA[tier][feature];
  const KEY = `AI_QUOTA_${tier}_${feature}`.toUpperCase();
  return {
    perDay: envInt(`${KEY}_PER_DAY`, d.perDay),
    perMonth: envInt(`${KEY}_PER_MONTH`, d.perMonth),
  };
}

export interface AiQuotaUsage {
  /** Số lượt đã dùng HÔM NAY cho feature này. */
  usedToday: number;
  /** Số lượt đã dùng THÁNG NÀY cho feature này. */
  usedThisMonth: number;
}

export type AiQuotaReason = 'ok' | 'daily_exceeded' | 'monthly_exceeded';

export interface AiQuotaDecision {
  allowed: boolean;
  reason: AiQuotaReason;
  tier: AiTier;
  feature: AiFeature;
  remainingToday: number;
  remainingThisMonth: number;
  limits: AiQuotaLimits;
}

/** Quyết định 1 lượt gọi AI cho feature. Monthly chặn trước, rồi tới daily. */
export function evaluateAiQuota(input: {
  tier: AiTier;
  feature: AiFeature;
  usage: AiQuotaUsage;
}): AiQuotaDecision {
  const limits = getAiQuotaLimits(input.tier, input.feature);
  const remainingThisMonth = Math.max(0, limits.perMonth - Math.max(0, input.usage.usedThisMonth));
  const remainingToday = Math.max(0, limits.perDay - Math.max(0, input.usage.usedToday));

  let reason: AiQuotaReason = 'ok';
  if (remainingThisMonth <= 0) reason = 'monthly_exceeded';
  else if (remainingToday <= 0) reason = 'daily_exceeded';

  return {
    allowed: reason === 'ok',
    reason,
    tier: input.tier,
    feature: input.feature,
    remainingToday,
    remainingThisMonth,
    limits,
  };
}

/** Tier hiệu lực từ profile (dùng lại logic monetization sẵn có). */
export function resolveAiTier(profile: Partial<UserProfile> | null | undefined, now = new Date()): AiTier {
  return resolveAiMoneyPlan(profile, now);
}

/** Câu thông báo tiếng Việt khi hết/còn lượt — hiện cho user ("báo kho request còn bao nhiêu"). */
export function describeAiQuota(decision: AiQuotaDecision): string {
  const featureLabel = decision.feature === 'report' ? 'báo cáo AI' : 'chat AI';
  if (decision.reason === 'monthly_exceeded') {
    return `Bạn đã dùng hết ${featureLabel} tháng này (${decision.limits.perMonth} lượt). Quay lại tháng sau hoặc nâng Pro để có thêm.`;
  }
  if (decision.reason === 'daily_exceeded') {
    return `Hết lượt ${featureLabel} hôm nay (${decision.limits.perDay}/ngày). Còn ${decision.remainingThisMonth} lượt trong tháng — thử lại ngày mai.`;
  }
  return `Còn ${decision.remainingToday} lượt ${featureLabel} hôm nay · ${decision.remainingThisMonth} lượt tháng này.`;
}
