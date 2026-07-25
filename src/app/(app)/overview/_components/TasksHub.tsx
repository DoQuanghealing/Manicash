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
import { TOTAL_ONBOARDING_QUESTS } from '@/data/onboardingQuests';
import OnboardingQuestPanel from './OnboardingQuestPanel';
import DailyQuestCard from './DailyQuestCard';
import WeeklyChallengeCard from './WeeklyChallengeCard';
import MissionChecklist, { MISSION_STEPS } from './MissionChecklist';
import './tasks-hub.css';

type PhaseKey = 'onboarding' | 'daily' | 'weekly' | 'mission';

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

  useEffect(() => {
    ensureToday();
    ensureWeekly();
  }, [ensureToday, ensureWeekly]);

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

    return list;
  }, [
    isOnboardingDone,
    onboardingCompleted,
    onboardingInstances,
    getDailyTemplates,
    dailyInstances,
    weeklyInstance,
    completedMissionIds,
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
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
