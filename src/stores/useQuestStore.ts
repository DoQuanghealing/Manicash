/* ═══ Quest Store — 4 lớp nhiệm vụ ═══
 *
 * Quản lý onboarding (7 quest gated) + daily (3 quest/ngày reset 0h).
 * Weekly + Seasonal sẽ thêm sau khi infrastructure cơ bản chạy ổn.
 *
 * KHÁC `useMissionStore` cũ: store cũ chỉ tracking 3 mission ID đơn giản
 * (vẫn dùng cho MissionChecklist hiện có, giữ backward compat). Store
 * mới này quản lý quest dạng instance có progress + claim.
 *
 * Idempotent: complete & claim phân biệt. Hoàn thành (đạt target) tự động,
 * Nhận thưởng (XP + reward items) cần user bấm "Nhận quà".
 */
'use client';

import { create } from 'zustand';
import {
  ONBOARDING_QUESTS,
  ONBOARDING_QUEST_BY_ID,
  TOTAL_ONBOARDING_QUESTS,
  type OnboardingQuest,
  type OnboardingMetric,
} from '@/data/onboardingQuests';
import {
  pickDailyQuests,
  DAILY_QUEST_BY_ID,
  type DailyQuestTemplate,
  type DailyMetric,
} from '@/data/dailyQuestPool';
import { useAuthStore } from './useAuthStore';
import { useRewardStore } from './useRewardStore';
import { getDateKey } from '@/lib/dateHelpers';

export interface QuestInstance {
  templateId: string;
  startedAt: string;     // ISO
  completedAt?: string;  // tự set khi progress >= target
  claimedAt?: string;    // user bấm nhận
  /** Snapshot baseline value khi quest start — để tính delta cho daily. */
  baselineValue?: number;
}

interface QuestState {
  // ── Onboarding ─────────────────────────────────────────────
  onboardingInstances: Record<string, QuestInstance>; // key = quest id
  currentOnboardingOrder: number; // quest order đang active (1..7); >7 = done

  /** Kiểm tra & advance onboarding state dựa trên các metric. */
  evaluateOnboarding: (metrics: Record<OnboardingMetric, number>) => void;
  /** Nhận thưởng quest tân thủ đã complete. */
  claimOnboarding: (questId: string) => { granted: boolean; xp: number; rewardIds: string[] };

  // ── Daily ──────────────────────────────────────────────────
  dailyDateKey: string;                          // ngày của bộ daily đang hiển thị
  dailyInstances: Record<string, QuestInstance>; // key = template id

  /** Đảm bảo bộ daily quest đúng cho ngày hiện tại (sinh mới nếu sang ngày). */
  ensureTodayDailies: () => void;
  /** Eval daily metrics + auto-complete khi đạt target. */
  evaluateDailies: (metrics: Record<DailyMetric, number>) => void;
  /** Nhận thưởng daily quest. */
  claimDaily: (templateId: string) => { granted: boolean; xp: number };

  // ── Helpers (đọc) ──────────────────────────────────────────
  getOnboardingActive: () => OnboardingQuest | null;
  getOnboardingCompletedCount: () => number;
  getDailyTemplates: () => DailyQuestTemplate[];
  isOnboardingDone: () => boolean;
}

export const useQuestStore = create<QuestState>((set, get) => ({
  onboardingInstances: {},
  currentOnboardingOrder: 1,
  dailyDateKey: '',
  dailyInstances: {},

  // ═══ ONBOARDING ═══════════════════════════════════════════════

  evaluateOnboarding: (metrics) => {
    const { onboardingInstances, currentOnboardingOrder } = get();
    if (currentOnboardingOrder > TOTAL_ONBOARDING_QUESTS) return;

    const active = ONBOARDING_QUESTS.find((q) => q.order === currentOnboardingOrder);
    if (!active) return;

    const existing = onboardingInstances[active.id];
    if (existing?.completedAt) return;

    const current = metrics[active.metric] ?? 0;
    const reached = current >= active.target;

    // Khởi tạo instance + check complete trong cùng 1 set update
    set((s) => ({
      onboardingInstances: {
        ...s.onboardingInstances,
        [active.id]: {
          templateId: active.id,
          startedAt: existing?.startedAt || new Date().toISOString(),
          ...(reached ? { completedAt: new Date().toISOString() } : {}),
        },
      },
    }));
  },

  claimOnboarding: (questId) => {
    const quest = ONBOARDING_QUEST_BY_ID[questId];
    const inst = get().onboardingInstances[questId];
    if (!quest || !inst || !inst.completedAt || inst.claimedAt) {
      return { granted: false, xp: 0, rewardIds: [] };
    }

    // Mark claimed
    set((s) => ({
      onboardingInstances: {
        ...s.onboardingInstances,
        [questId]: { ...s.onboardingInstances[questId], claimedAt: new Date().toISOString() },
      },
      // Advance order nếu đây là quest hiện tại
      currentOnboardingOrder:
        s.currentOnboardingOrder === quest.order
          ? s.currentOnboardingOrder + 1
          : s.currentOnboardingOrder,
    }));

    // Grant XP qua awardXP duy nhất — đảm bảo rank update + toast emit
    const auth = useAuthStore.getState();
    auth.awardXP({ type: 'MISSION_COMPLETE', amount: quest.xpReward });

    // Unlock reward items
    const rewardIds = quest.rewardItemIds || [];
    if (rewardIds.length > 0) {
      useRewardStore.getState().unlockMany(rewardIds);
    }

    return { granted: true, xp: quest.xpReward, rewardIds };
  },

  // ═══ DAILY ════════════════════════════════════════════════════

  ensureTodayDailies: () => {
    const today = getDateKey(new Date());
    if (get().dailyDateKey === today) return;

    const templates = pickDailyQuests(today);
    const instances: Record<string, QuestInstance> = {};
    const now = new Date().toISOString();
    for (const t of templates) {
      instances[t.id] = { templateId: t.id, startedAt: now };
    }
    set({ dailyDateKey: today, dailyInstances: instances });
  },

  evaluateDailies: (metrics) => {
    const { dailyInstances } = get();
    const templates = get().getDailyTemplates();
    let updated = false;
    const newInstances = { ...dailyInstances };

    for (const t of templates) {
      const inst = newInstances[t.id];
      if (!inst || inst.completedAt) continue;
      const current = metrics[t.metric] ?? 0;
      if (current >= t.target) {
        newInstances[t.id] = { ...inst, completedAt: new Date().toISOString() };
        updated = true;
      }
    }

    if (updated) set({ dailyInstances: newInstances });
  },

  claimDaily: (templateId) => {
    const template = DAILY_QUEST_BY_ID[templateId];
    const inst = get().dailyInstances[templateId];
    if (!template || !inst || !inst.completedAt || inst.claimedAt) {
      return { granted: false, xp: 0 };
    }

    set((s) => ({
      dailyInstances: {
        ...s.dailyInstances,
        [templateId]: { ...s.dailyInstances[templateId], claimedAt: new Date().toISOString() },
      },
    }));

    const auth = useAuthStore.getState();
    auth.awardXP({ type: 'MISSION_COMPLETE', amount: template.xpReward });

    return { granted: true, xp: template.xpReward };
  },

  // ═══ HELPERS ══════════════════════════════════════════════════

  getOnboardingActive: () => {
    const order = get().currentOnboardingOrder;
    if (order > TOTAL_ONBOARDING_QUESTS) return null;
    return ONBOARDING_QUESTS.find((q) => q.order === order) || null;
  },

  getOnboardingCompletedCount: () => {
    const insts = get().onboardingInstances;
    return ONBOARDING_QUESTS.filter((q) => insts[q.id]?.claimedAt).length;
  },

  getDailyTemplates: () => {
    return pickDailyQuests(get().dailyDateKey || getDateKey(new Date()));
  },

  isOnboardingDone: () =>
    get().currentOnboardingOrder > TOTAL_ONBOARDING_QUESTS,
}));
