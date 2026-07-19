import type { UserProfile } from '@/types/user';

export type AiMoneyQuotaPlan = 'free' | 'pro' | 'pro_plus';

export interface AiMoneyQuotaConfig {
  freeMonthlyCredits: number;
  proMonthlyCredits: number;
  proPlusMonthlyCredits: number;
  hardMonthlyCredits: number;
  /** Trần cứng credit cho Pro Plus (cao hơn — chứa đủ 1.200 chat + 300 report). */
  hardMonthlyCreditsProPlus: number;
  fallbackParseCredits: number;
  cfoNarrationCredits: number;
}

export interface AiMoneyQuotaSnapshot {
  uid: string;
  monthKey: string;
  plan: AiMoneyQuotaPlan;
  monthlyLimit: number;
  hardLimit: number;
  usedCredits: number;
  remainingCredits: number;
  allowed: boolean;
  reason: string;
}

export function getCurrentAiMoneyMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh (no DST)

/** Day key theo giờ VN (UTC+7) — mốc reset per-day quota SERVER-SIDE (chống lách). */
export function getCurrentAiMoneyDayKey(now = new Date()): string {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}-${String(vn.getUTCDate()).padStart(2, '0')}`;
}

export interface AiDailyUsageDoc {
  dayKey?: string;
  daily_report?: number;
  daily_chat?: number;
}

/** PURE: đọc usage HÔM NAY của từng feature (tự reset 0 khi sang ngày khác). */
export function readDailyUsage(
  data: AiDailyUsageDoc | undefined | null,
  currentDayKey: string,
): { report: number; chat: number } {
  if (!data || data.dayKey !== currentDayKey) return { report: 0, chat: 0 };
  return {
    report: typeof data.daily_report === 'number' ? data.daily_report : 0,
    chat: typeof data.daily_chat === 'number' ? data.daily_chat : 0,
  };
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function getAiMoneyQuotaConfig(): AiMoneyQuotaConfig {
  return {
    freeMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_FREE_MONTHLY_CREDITS, 0),
    proMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_PRO_MONTHLY_CREDITS, 1500),
    // Pro Plus: 1.200 chat×1 + 300 report×8 = 3.600 credit; đệm lên 4.000.
    proPlusMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_PRO_PLUS_MONTHLY_CREDITS, 4000),
    hardMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_HARD_MONTHLY_CREDITS, 1500),
    hardMonthlyCreditsProPlus: readPositiveInt(process.env.AI_MONEY_CHAT_HARD_MONTHLY_CREDITS_PRO_PLUS, 4000),
    fallbackParseCredits: readPositiveInt(process.env.AI_MONEY_CHAT_FALLBACK_PARSE_CREDITS, 1),
    cfoNarrationCredits: readPositiveInt(process.env.AI_MONEY_CHAT_CFO_NARRATION_CREDITS, 8),
  };
}

export function resolveAiMoneyPlan(profile: Partial<UserProfile> | null | undefined, now = new Date()): AiMoneyQuotaPlan {
  if (!profile) return 'free';

  const premiumExpiresAt = profile.premiumExpiresAt ? new Date(profile.premiumExpiresAt).getTime() : null;
  const premiumStillValid = premiumExpiresAt === null || Number.isNaN(premiumExpiresAt) || premiumExpiresAt > now.getTime();

  // Pro Plus (Phú Vương) — superset của Pro, xét TRƯỚC.
  if ((profile.tier === 'pro_plus' || profile.plan === 'premium_plus') && premiumStillValid) {
    return 'pro_plus';
  }
  if ((profile.tier === 'pro' || profile.plan === 'premium' || profile.isPremium) && premiumStillValid) {
    return 'pro';
  }

  return 'free';
}

export function getMonthlyCreditLimit(plan: AiMoneyQuotaPlan, config = getAiMoneyQuotaConfig()): number {
  if (plan === 'pro_plus') {
    return Math.min(config.proPlusMonthlyCredits, config.hardMonthlyCreditsProPlus);
  }
  const planLimit = plan === 'pro' ? config.proMonthlyCredits : config.freeMonthlyCredits;
  return Math.min(planLimit, config.hardMonthlyCredits);
}

/** Kết quả quyết định 1 lượt charge (tháng + ngày). */
export interface AiChargeDecision extends AiMoneyQuotaSnapshot {
  chargedCredits: number;
}

/**
 * PURE — toàn bộ logic quyết định của chargeAiMoneyCredits (quota.ts) tách ra đây:
 * per-MONTH credits (evaluateQuota) → per-DAY feature limit. Server (transaction)
 * và CI cost-simulation (tests/ai-cost-simulation.test.ts) dùng CHUNG hàm này —
 * một nguồn sự thật, mô phỏng không thể lệch khỏi hành vi thật.
 */
export function decideAiMoneyCharge(
  input: {
    uid: string;
    monthKey: string;
    plan: AiMoneyQuotaPlan;
    feature: 'report' | 'chat';
    chargeCredits: number;
    usedCredits: number;
    /** Số lượt feature này ĐÃ dùng hôm nay (đã reset theo dayKey). */
    usedTodayFeature: number;
    /** Trần/ngày của feature (getAiQuotaLimits(plan, feature).perDay). */
    perDayLimit: number;
  },
  config = getAiMoneyQuotaConfig(),
): AiChargeDecision {
  const quota = evaluateQuota(
    {
      uid: input.uid,
      monthKey: input.monthKey,
      plan: input.plan,
      usedCredits: input.usedCredits,
      chargeCredits: input.chargeCredits,
    },
    config,
  );
  if (!quota.allowed) {
    return { ...quota, chargedCredits: 0 };
  }

  if (input.usedTodayFeature >= input.perDayLimit) {
    return {
      ...quota,
      allowed: false,
      reason: `Hết lượt ${input.feature === 'report' ? 'báo cáo AI' : 'chat AI'} hôm nay (${input.perDayLimit}/ngày). Thử lại ngày mai hoặc nâng Pro để có thêm.`,
      chargedCredits: 0,
    };
  }

  return {
    ...quota,
    usedCredits: input.usedCredits + input.chargeCredits,
    remainingCredits: Math.max(0, quota.monthlyLimit - input.usedCredits - input.chargeCredits),
    chargedCredits: input.chargeCredits,
  };
}

export function evaluateQuota(
  input: {
    uid: string;
    monthKey: string;
    plan: AiMoneyQuotaPlan;
    usedCredits: number;
    chargeCredits: number;
  },
  config = getAiMoneyQuotaConfig(),
): AiMoneyQuotaSnapshot {
  const monthlyLimit = getMonthlyCreditLimit(input.plan, config);
  const hardLimit = input.plan === 'pro_plus' ? config.hardMonthlyCreditsProPlus : config.hardMonthlyCredits;
  const remainingCredits = Math.max(0, monthlyLimit - input.usedCredits);
  const allowed = input.chargeCredits > 0 && input.usedCredits + input.chargeCredits <= monthlyLimit;

  return {
    uid: input.uid,
    monthKey: input.monthKey,
    plan: input.plan,
    monthlyLimit,
    hardLimit,
    usedCredits: input.usedCredits,
    remainingCredits,
    allowed,
    reason: allowed
      ? 'Quota available.'
      : input.plan === 'free'
        ? 'AI fallback is a Pro feature.'
        : 'AI monthly quota exceeded.',
  };
}

