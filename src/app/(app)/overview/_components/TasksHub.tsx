/* ═══ TasksHub — Gom mọi nhiệm vụ vào 1 cửa sổ, chia GIAI ĐOẠN ═══
 *
 * Trước: 4 khối quest (Tân thủ · Hôm nay · Tuần · Tối ưu) xếp dọc → dài, bừa.
 * Giờ: 1 khay có thanh tab giai đoạn; mỗi lúc CHỈ hiện 1 bộ nhiệm vụ. User làm
 * xong bộ này mới chuyển bộ khác — gọn gàng, có trọng tâm.
 *
 * Logic từng bộ giữ nguyên ở component con; TasksHub chỉ là vỏ điều hướng +
 * đọc tiến độ để gắn badge lên tab. Tab "Tân thủ" tự ẩn khi onboarding xong.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuestStore } from '@/stores/useQuestStore';
import { useMissionStore } from '@/stores/useMissionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { TOTAL_ONBOARDING_QUESTS } from '@/data/onboardingQuests';
import { collectSeasonalDelta } from '@/lib/questMetrics';
import { getUpcomingLunarHoliday, daysUntilHoliday, HOLIDAY_TO_EVENT } from '@/data/lunarCalendar';
import OnboardingQuestPanel from './OnboardingQuestPanel';
import DailyQuestCard from './DailyQuestCard';
import WeeklyChallengeCard from './WeeklyChallengeCard';
import MissionChecklist, { MISSION_STEPS } from './MissionChecklist';
import SeasonalEventPanel from './SeasonalEventPanel';
import UpcomingHolidayHint from './UpcomingHolidayHint';
import './tasks-hub.css';

type PhaseKey = 'onboarding' | 'daily' | 'weekly' | 'mission' | 'seasonal';

interface PhaseTab {
  key: PhaseKey;
  label: string;
  icon: string;
  /** Nhãn tiến độ nhỏ (vd "1/3"), rỗng nếu không có. */
  pill: string;
  /** Đã hoàn tất cả bộ → tab hiện mờ + dấu ✓. */
  done: boolean;
  /** Có quà chờ nhận / việc cần làm gấp → chấm sáng. */
  ready: boolean;
}

export default function TasksHub() {
  // ── Onboarding ──
  const isOnboardingDone = useQuestStore((s) => s.isOnboardingDone());
  const onboardingCompleted = useQuestStore((s) => s.getOnboardingCompletedCount());
  const onboardingInstances = useQuestStore((s) => s.onboardingInstances);

  // ── Daily ──
  const ensureToday = useQuestStore((s) => s.ensureTodayDailies);
  const getDailyTemplates = useQuestStore((s) => s.getDailyTemplates);
  const dailyInstances = useQuestStore((s) => s.dailyInstances);

  // ── Weekly ──
  const ensureWeekly = useQuestStore((s) => s.ensureCurrentWeekly);
  const weeklyInstance = useQuestStore((s) => s.weeklyInstance);

  // ── Mission ──
  const completedMissionIds = useMissionStore((s) => s.completedMissionIds);

  // ── Seasonal event + holiday teaser ──
  const ensureSeasonal = useQuestStore((s) => s.ensureSeasonalEvent);
  const evaluateSeasonal = useQuestStore((s) => s.evaluateSeasonal);
  const getCurrentSeasonal = useQuestStore((s) => s.getCurrentSeasonal);
  const seasonalStartedAt = useQuestStore((s) => s.seasonalStartedAt);
  const seasonalChapterInstances = useQuestStore((s) => s.seasonalChapterInstances);
  const seasonalFinalClaimedAt = useQuestStore((s) => s.seasonalFinalClaimedAt);

  // Data sources cho seasonal delta
  const user = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);
  const seasonalTasks = useTaskStore((s) => s.tasks);

  useEffect(() => {
    ensureToday();
    ensureWeekly();
    ensureSeasonal();
  }, [ensureToday, ensureWeekly, ensureSeasonal]);

  // Re-eval seasonal khi data đổi — chạy dù tab chưa mở để pill/chấm sáng cập nhật.
  useEffect(() => {
    if (!seasonalStartedAt) return;
    evaluateSeasonal(collectSeasonalDelta(seasonalStartedAt));
  }, [user, transactions, seasonalTasks, seasonalStartedAt, evaluateSeasonal, seasonalChapterInstances]);

  const tabs = useMemo<PhaseTab[]>(() => {
    const list: PhaseTab[] = [];

    // Tân thủ — chỉ hiện khi chưa xong toàn bộ lộ trình
    if (!isOnboardingDone) {
      const onbReady = Object.values(onboardingInstances).some(
        (i) => i?.completedAt && !i?.claimedAt,
      );
      list.push({
        key: 'onboarding',
        label: 'Tân thủ',
        icon: '🌱',
        pill: `${onboardingCompleted}/${TOTAL_ONBOARDING_QUESTS}`,
        done: false,
        ready: onbReady,
      });
    }

    // Hôm nay
    const dailyTemplates = getDailyTemplates();
    const dailyDone = dailyTemplates.filter((t) => dailyInstances[t.id]?.completedAt).length;
    const dailyReady = dailyTemplates.some(
      (t) => dailyInstances[t.id]?.completedAt && !dailyInstances[t.id]?.claimedAt,
    );
    const dailyAllClaimed =
      dailyTemplates.length > 0 && dailyTemplates.every((t) => dailyInstances[t.id]?.claimedAt);
    list.push({
      key: 'daily',
      label: 'Hôm nay',
      icon: '☀️',
      pill: `${dailyDone}/${dailyTemplates.length}`,
      done: dailyAllClaimed,
      ready: dailyReady,
    });

    // Tuần
    const weeklyCompleted = !!weeklyInstance?.completedAt;
    const weeklyClaimed = !!weeklyInstance?.claimedAt;
    list.push({
      key: 'weekly',
      label: 'Tuần',
      icon: '📦',
      pill: weeklyClaimed ? '✓' : '',
      done: weeklyClaimed,
      ready: weeklyCompleted && !weeklyClaimed,
    });

    // Tối ưu tài chính (3 tài khoản)
    const missionDone = MISSION_STEPS.filter((s) => completedMissionIds.includes(s.id)).length;
    list.push({
      key: 'mission',
      label: 'Tối ưu',
      icon: '🚀',
      pill: `${missionDone}/${MISSION_STEPS.length}`,
      done: missionDone === MISSION_STEPS.length,
      ready: false,
    });

    // Sự kiện theo mùa — chỉ hiện khi có event active HOẶC holiday sắp tới (≤30 ngày).
    // Luôn đứng cuối; không bao giờ là tab mặc định.
    const activeEvent = getCurrentSeasonal();
    const holiday = getUpcomingLunarHoliday();
    const holidayDays = holiday ? daysUntilHoliday(holiday) : -1;
    const holidayVisible =
      !!holiday &&
      holidayDays >= 0 &&
      holidayDays <= 30 &&
      !(activeEvent && HOLIDAY_TO_EVENT[holiday.id] === activeEvent.id);

    if (activeEvent || holidayVisible) {
      let pill = '';
      let ready = false;
      if (activeEvent) {
        const chapters = activeEvent.chapters;
        const claimed = chapters.filter((c) => seasonalChapterInstances[c.id]?.claimedAt).length;
        const chapterReady = chapters.some(
          (c) => seasonalChapterInstances[c.id]?.completedAt && !seasonalChapterInstances[c.id]?.claimedAt,
        );
        const allClaimed = claimed === chapters.length;
        pill = `${claimed}/${chapters.length}`;
        ready = chapterReady || (allClaimed && !seasonalFinalClaimedAt);
      }
      list.push({
        key: 'seasonal',
        label: 'Sự kiện',
        icon: activeEvent?.icon ?? holiday?.icon ?? '📅',
        pill,
        done: false,
        ready,
      });
    }

    return list;
  }, [
    isOnboardingDone,
    onboardingCompleted,
    onboardingInstances,
    getDailyTemplates,
    dailyInstances,
    weeklyInstance,
    completedMissionIds,
    getCurrentSeasonal,
    seasonalChapterInstances,
    seasonalFinalClaimedAt,
  ]);

  // Tab người dùng chọn (null = chưa chọn → dùng mặc định).
  const [picked, setPicked] = useState<PhaseKey | null>(null);
  // Tab hiệu lực: lựa chọn của user nếu còn tồn tại, không thì tab đầu (Tân thủ
  // nếu còn, không thì Hôm nay). Derive thay vì sửa trong effect → tránh cascading.
  const active: PhaseKey =
    picked && tabs.some((t) => t.key === picked) ? picked : tabs[0]?.key ?? 'daily';
  const setActive = setPicked;

  return (
    <section className="thub" aria-label="Nhiệm vụ của bạn">
      <div className="thub-head">
        <span className="thub-head-icon" aria-hidden="true">🎯</span>
        <h2 className="thub-head-title">Nhiệm vụ của bạn</h2>
      </div>

      <div className="thub-tabs" role="tablist" aria-label="Giai đoạn nhiệm vụ">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            className={`thub-tab${active === t.key ? ' is-active' : ''}${t.done ? ' is-done' : ''}`}
            onClick={() => setActive(t.key)}
          >
            <span className="thub-tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="thub-tab-label">{t.label}</span>
            {t.pill && <span className="thub-tab-pill">{t.pill}</span>}
            {t.ready && <span className="thub-tab-dot" aria-label="Sẵn quà" />}
          </button>
        ))}
      </div>

      <div className="thub-panel" role="tabpanel">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {active === 'onboarding' && <OnboardingQuestPanel />}
            {active === 'daily' && <DailyQuestCard />}
            {active === 'weekly' && <WeeklyChallengeCard />}
            {active === 'mission' && <MissionChecklist />}
            {active === 'seasonal' && (
              <div className="thub-seasonal">
                <SeasonalEventPanel />
                <UpcomingHolidayHint />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
