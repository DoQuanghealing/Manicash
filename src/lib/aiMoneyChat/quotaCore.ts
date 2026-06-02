import type { UserProfile } from '@/types/user';

export type AiMoneyQuotaPlan = 'free' | 'pro';

export interface AiMoneyQuotaConfig {
  freeMonthlyCredits: number;
  proMonthlyCredits: number;
  hardMonthlyCredits: number;
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

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function getAiMoneyQuotaConfig(): AiMoneyQuotaConfig {
  return {
    freeMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_FREE_MONTHLY_CREDITS, 0),
    proMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_PRO_MONTHLY_CREDITS, 1500),
    hardMonthlyCredits: readPositiveInt(process.env.AI_MONEY_CHAT_HARD_MONTHLY_CREDITS, 1500),
    fallbackParseCredits: readPositiveInt(process.env.AI_MONEY_CHAT_FALLBACK_PARSE_CREDITS, 1),
    cfoNarrationCredits: readPositiveInt(process.env.AI_MONEY_CHAT_CFO_NARRATION_CREDITS, 8),
  };
}

export function resolveAiMoneyPlan(profile: Partial<UserProfile> | null | undefined, now = new Date()): AiMoneyQuotaPlan {
  if (!profile) return 'free';

  const premiumExpiresAt = profile.premiumExpiresAt ? new Date(profile.premiumExpiresAt).getTime() : null;
  const premiumStillValid = premiumExpiresAt === null || Number.isNaN(premiumExpiresAt) || premiumExpiresAt > now.getTime();

  if ((profile.tier === 'pro' || profile.plan === 'premium' || profile.isPremium) && premiumStillValid) {
    return 'pro';
  }

  return 'free';
}

export function getMonthlyCreditLimit(plan: AiMoneyQuotaPlan, config = getAiMoneyQuotaConfig()): number {
  const planLimit = plan === 'pro' ? config.proMonthlyCredits : config.freeMonthlyCredits;
  return Math.min(planLimit, config.hardMonthlyCredits);
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
  const hardLimit = config.hardMonthlyCredits;
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

