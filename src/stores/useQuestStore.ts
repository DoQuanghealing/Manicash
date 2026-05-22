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
import {
  pickWeeklyChallenge,
  getWeekKey,
  type WeeklyMetric,
  type WeeklyChallengeTemplate,
} from '@/data/weeklyChallenges';
import {
  getActiveSeasonalEvent,
  type SeasonalEvent,
  type SeasonalMetric,
} from '@/data/seasonalEvents';
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

/** Loại quest — để popup + hint bar phân biệt context. */
export type QuestType = 'onboarding' | 'daily' | 'weekly' | 'seasonal';

/** Context quest user đang làm (set khi bấm "Làm ngay", clear khi xong/timeout). */
export interface QuestActiveContext {
  questId: string;
  questType: QuestType;
  startedAt: string;
  returnPath: string;
  hintHidden?: boolean;  // user toggle "Ẩn" trên hint bar
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

  // ── Weekly ─────────────────────────────────────────────────
  weeklyKey: string;                                  // YYYY-WW
  weeklyInstance: QuestInstance | null;               // 1 challenge active
  /** Đảm bảo weekly challenge đúng cho tuần hiện tại. */
  ensureCurrentWeekly: () => void;
  /** Eval weekly progress + auto-complete khi đạt target. */
  evaluateWeekly: (
    metrics: Record<WeeklyMetric, number>,
    target: number
  ) => void;
  /** Nhận thưởng weekly. */
  claimWeekly: () => { granted: boolean; xp: number; rewardIds: string[] };

  // ── Seasonal ───────────────────────────────────────────────
  seasonalEventId: string | null;                       // id của event đang active
  seasonalStartedAt: string | null;                     // ISO khi user mount event (baseline)
  seasonalChapterInstances: Record<string, QuestInstance>; // key = chapter id
  seasonalFinalClaimedAt: string | null;                // khi user nhận quà cuối

  /** Đảm bảo seasonal state khớp với active event hiện tại. */
  ensureSeasonalEvent: () => void;
  /** Eval các chapter dựa trên delta metrics từ seasonalStartedAt. */
  evaluateSeasonal: (deltaMetrics: Record<SeasonalMetric, number>) => void;
  /** Nhận thưởng 1 chapter. */
  claimSeasonalChapter: (chapterId: string) => { granted: boolean; xp: number; rewardIds: string[] };
  /** Nhận thưởng cuối khi tất cả chapter đã claim. */
  claimSeasonalFinal: () => { granted: boolean; rewardIds: string[] };

  // ── Active Quest Context (Hint Bar) ────────────────────────
  /** Quest user đang làm sau khi bấm "Làm ngay". Null khi không có. */
  activeContext: QuestActiveContext | null;
  setActiveContext: (ctx: QuestActiveContext) => void;
  clearActiveContext: () => void;
  /** User toggle ẩn/hiện hint bar — context vẫn còn. */
  toggleHintBarHidden: () => void;

  // ── Helpers (đọc) ──────────────────────────────────────────
  getOnboardingActive: () => OnboardingQuest | null;
  getOnboardingCompletedCount: () => number;
  getDailyTemplates: () => DailyQuestTemplate[];
  getCurrentWeekly: () => WeeklyChallengeTemplate;
  getCurrentSeasonal: () => SeasonalEvent | null;
  isOnboardingDone: () => boolean;
}

export const useQuestStore = create<QuestState>((set, get) => ({
  onboardingInstances: {},
  currentOnboardingOrder: 1,
  dailyDateKey: '',
  dailyInstances: {},
  weeklyKey: '',
  weeklyInstance: null,
  seasonalEventId: null,
  seasonalStartedAt: null,
  seasonalChapterInstances: {},
  seasonalFinalClaimedAt: null,
  activeContext: null,

  // ═══ ACTIVE CONTEXT (Hint Bar) ════════════════════════════════

  setActiveContext: (ctx) => set({ activeContext: ctx }),
  clearActiveContext: () => set({ activeContext: null }),
  toggleHintBarHidden: () =>
    set((s) =>
      s.activeContext
        ? { activeContext: { ...s.activeContext, hintHidden: !s.activeContext.hintHidden } }
        : {}
    ),

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

  // ═══ WEEKLY ═══════════════════════════════════════════════════

  ensureCurrentWeekly: () => {
    const currentKey = getWeekKey(new Date());
    if (get().weeklyKey === currentKey) return;

    const template = pickWeeklyChallenge(new Date());
    set({
      weeklyKey: currentKey,
      weeklyInstance: {
        templateId: template.id,
        startedAt: new Date().toISOString(),
      },
    });
  },

  evaluateWeekly: (metrics, target) => {
    const inst = get().weeklyInstance;
    if (!inst || inst.completedAt) return;

    const template = pickWeeklyChallenge(new Date());
    const current = metrics[template.metric] ?? 0;

    if (current >= target) {
      set({
        weeklyInstance: { ...inst, completedAt: new Date().toISOString() },
      });
    }
  },

  claimWeekly: () => {
    const inst = get().weeklyInstance;
    if (!inst || !inst.completedAt || inst.claimedAt) {
      return { granted: false, xp: 0, rewardIds: [] };
    }
    const template = pickWeeklyChallenge(new Date());

    set({
      weeklyInstance: { ...inst, claimedAt: new Date().toISOString() },
    });

    const auth = useAuthStore.getState();
    auth.awardXP({ type: 'MISSION_COMPLETE', amount: template.xpReward });

    const rewardIds = template.rewardItemIds || [];
    if (rewardIds.length > 0) {
      useRewardStore.getState().unlockMany(rewardIds);
    }

    return { granted: true, xp: template.xpReward, rewardIds };
  },

  // ═══ SEASONAL ═════════════════════════════════════════════════

  ensureSeasonalEvent: () => {
    const active = getActiveSeasonalEvent();
    const { seasonalEventId } = get();

    if (!active) {
      // Không có event active → clear nếu state cũ còn lại
      if (seasonalEventId !== null) {
        set({
          seasonalEventId: null,
          seasonalStartedAt: null,
          seasonalChapterInstances: {},
          seasonalFinalClaimedAt: null,
        });
      }
      return;
    }

    // Có event active — nếu đổi event (sang event khác) hoặc chưa có thì init
    if (seasonalEventId !== active.id) {
      set({
        seasonalEventId: active.id,
        seasonalStartedAt: new Date().toISOString(),
        seasonalChapterInstances: {},
        seasonalFinalClaimedAt: null,
      });
    }
  },

  evaluateSeasonal: (deltaMetrics) => {
    const event = get().getCurrentSeasonal();
    if (!event) return;
    const { seasonalChapterInstances } = get();
    let updated = false;
    const newInstances = { ...seasonalChapterInstances };

    // Sequential gating: chỉ eval chapter có order <= chapter đầu tiên chưa claim
    const sortedChapters = [...event.chapters].sort((a, b) => a.order - b.order);
    for (const chapter of sortedChapters) {
      const inst = newInstances[chapter.id];
      // Đã claim → skip, move sang chapter sau
      if (inst?.claimedAt) continue;

      // Đây là chapter active đầu tiên — init nếu cần & check completion
      if (!inst) {
        newInstances[chapter.id] = {
          templateId: chapter.id,
          startedAt: new Date().toISOString(),
        };
        updated = true;
      }

      if (!newInstances[chapter.id].completedAt) {
        const current = deltaMetrics[chapter.metric] ?? 0;
        if (current >= chapter.target) {
          newInstances[chapter.id] = {
            ...newInstances[chapter.id],
            completedAt: new Date().toISOString(),
          };
          updated = true;
        }
      }

      // Đã init/eval chapter active hiện tại → dừng (sequential gating)
      break;
    }

    if (updated) set({ seasonalChapterInstances: newInstances });
  },

  claimSeasonalChapter: (chapterId) => {
    const event = get().getCurrentSeasonal();
    if (!event) return { granted: false, xp: 0, rewardIds: [] };

    const chapter = event.chapters.find((c) => c.id === chapterId);
    const inst = get().seasonalChapterInstances[chapterId];
    if (!chapter || !inst || !inst.completedAt || inst.claimedAt) {
      return { granted: false, xp: 0, rewardIds: [] };
    }

    set((s) => ({
      seasonalChapterInstances: {
        ...s.seasonalChapterInstances,
        [chapterId]: { ...s.seasonalChapterInstances[chapterId], claimedAt: new Date().toISOString() },
      },
    }));

    const auth = useAuthStore.getState();
    auth.awardXP({ type: 'MISSION_COMPLETE', amount: chapter.xpReward });

    const rewardIds = chapter.rewardItemIds || [];
    if (rewardIds.length > 0) {
      useRewardStore.getState().unlockMany(rewardIds);
    }

    return { granted: true, xp: chapter.xpReward, rewardIds };
  },

  claimSeasonalFinal: () => {
    const event = get().getCurrentSeasonal();
    if (!event) return { granted: false, rewardIds: [] };

    // Check tất cả chapter đã claim
    const allClaimed = event.chapters.every(
      (c) => get().seasonalChapterInstances[c.id]?.claimedAt
    );
    if (!allClaimed) return { granted: false, rewardIds: [] };

    if (get().seasonalFinalClaimedAt) return { granted: false, rewardIds: [] };

    set({ seasonalFinalClaimedAt: new Date().toISOString() });

    if (event.finalRewardItemIds.length > 0) {
      useRewardStore.getState().unlockMany(event.finalRewardItemIds);
    }

    return { granted: true, rewardIds: event.finalRewardItemIds };
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

  getCurrentWeekly: () => pickWeeklyChallenge(new Date()),

  getCurrentSeasonal: () => {
    const id = get().seasonalEventId;
    if (!id) return null;
    const active = getActiveSeasonalEvent();
    return active && active.id === id ? active : null;
  },

  isOnboardingDone: () =>
    get().currentOnboardingOrder > TOTAL_ONBOARDING_QUESTS,
}));
