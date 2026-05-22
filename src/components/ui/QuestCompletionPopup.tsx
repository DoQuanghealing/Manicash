/* ═══ QuestCompletionPopup — Popup khi 1 quest đạt target ═══
 *
 * Mount ở (app)/layout.tsx — single instance.
 * Subscribe useQuestStore + detect transition in-progress → completed.
 * Queue popup (1 tại 1 thời điểm), auto-dismiss sau 8s nếu user không tương tác.
 *
 * Click "Nhận thưởng" → claim qua quest store + clearActiveContext → dequeue next
 * Click "Để sau" → dequeue (giữ quest ở trạng thái completed-not-claimed, user
 *                  có thể claim sau từ quest card).
 *
 * Audio: dùng sound 'levelUp' chung. Future: sound pack đã unlock có thể override.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, X, ArrowRight } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { useConfetti } from '@/hooks/useConfetti';
import { useAudio } from '@/hooks/useAudio';
import { ONBOARDING_QUEST_BY_ID } from '@/data/onboardingQuests';
import { DAILY_QUEST_BY_ID } from '@/data/dailyQuestPool';
import { pickWeeklyChallenge } from '@/data/weeklyChallenges';
import { getRewardById, RARITY_META } from '@/data/rewardCatalog';
import type { QuestType } from '@/stores/useQuestStore';
import './QuestCompletionPopup.css';

interface PendingPopup {
  questId: string;
  questType: QuestType;
  title: string;
  icon: string;
  xpReward: number;
  rewardItemIds: string[];
  /** Hàm thực hiện claim — gọi quest store action tương ứng. */
  doClaim: () => boolean;
}

const AUTO_DISMISS_MS = 8000;

export default function QuestCompletionPopup() {
  const { fireConfetti } = useConfetti();
  const { play } = useAudio();
  const seenIds = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<PendingPopup[]>([]);
  const [dismissing, setDismissing] = useState(false);

  // Subscribe
  const onboardingInstances = useQuestStore((s) => s.onboardingInstances);
  const dailyInstances = useQuestStore((s) => s.dailyInstances);
  const weeklyInstance = useQuestStore((s) => s.weeklyInstance);
  const seasonalChapterInstances = useQuestStore((s) => s.seasonalChapterInstances);
  const claimOnboarding = useQuestStore((s) => s.claimOnboarding);
  const claimDaily = useQuestStore((s) => s.claimDaily);
  const claimWeekly = useQuestStore((s) => s.claimWeekly);
  const claimSeasonalChapter = useQuestStore((s) => s.claimSeasonalChapter);
  const getCurrentSeasonal = useQuestStore((s) => s.getCurrentSeasonal);
  const clearActiveContext = useQuestStore((s) => s.clearActiveContext);

  // Detect new completions → enqueue
  useEffect(() => {
    const newPopups: PendingPopup[] = [];

    // Onboarding
    Object.values(onboardingInstances).forEach((inst) => {
      if (!inst.completedAt || inst.claimedAt) return;
      const key = `onb:${inst.templateId}`;
      if (seenIds.current.has(key)) return;
      seenIds.current.add(key);
      const quest = ONBOARDING_QUEST_BY_ID[inst.templateId];
      if (!quest) return;
      newPopups.push({
        questId: quest.id,
        questType: 'onboarding',
        title: quest.title,
        icon: quest.icon,
        xpReward: quest.xpReward,
        rewardItemIds: quest.rewardItemIds || [],
        doClaim: () => claimOnboarding(quest.id).granted,
      });
    });

    // Daily
    Object.values(dailyInstances).forEach((inst) => {
      if (!inst.completedAt || inst.claimedAt) return;
      const key = `daily:${inst.templateId}`;
      if (seenIds.current.has(key)) return;
      seenIds.current.add(key);
      const template = DAILY_QUEST_BY_ID[inst.templateId];
      if (!template) return;
      newPopups.push({
        questId: template.id,
        questType: 'daily',
        title: template.title,
        icon: template.icon,
        xpReward: template.xpReward,
        rewardItemIds: [],
        doClaim: () => claimDaily(template.id).granted,
      });
    });

    // Weekly
    if (weeklyInstance?.completedAt && !weeklyInstance.claimedAt) {
      const key = `weekly:${weeklyInstance.templateId}`;
      if (!seenIds.current.has(key)) {
        seenIds.current.add(key);
        const template = pickWeeklyChallenge(new Date());
        newPopups.push({
          questId: template.id,
          questType: 'weekly',
          title: template.title,
          icon: template.icon,
          xpReward: template.xpReward,
          rewardItemIds: template.rewardItemIds || [],
          doClaim: () => claimWeekly().granted,
        });
      }
    }

    // Seasonal chapters
    Object.values(seasonalChapterInstances).forEach((inst) => {
      if (!inst.completedAt || inst.claimedAt) return;
      const key = `seasonal:${inst.templateId}`;
      if (seenIds.current.has(key)) return;
      seenIds.current.add(key);
      const event = getCurrentSeasonal();
      const chapter = event?.chapters.find((c) => c.id === inst.templateId);
      if (!chapter) return;
      newPopups.push({
        questId: chapter.id,
        questType: 'seasonal',
        title: chapter.title,
        icon: chapter.icon,
        xpReward: chapter.xpReward,
        rewardItemIds: chapter.rewardItemIds || [],
        doClaim: () => claimSeasonalChapter(chapter.id).granted,
      });
    });

    if (newPopups.length > 0) {
      // Defer setState ra ngoài effect body để tránh cascading render warning.
      // Subscribe pattern hợp lệ (store update → UI queue) — chỉ cần microtask.
      queueMicrotask(() => setQueue((q) => [...q, ...newPopups]));
    }
  }, [
    onboardingInstances, dailyInstances, weeklyInstance, seasonalChapterInstances,
    claimOnboarding, claimDaily, claimWeekly, claimSeasonalChapter, getCurrentSeasonal,
  ]);

  const current = queue[0];

  // Mount sound + confetti khi popup mới hiện
  useEffect(() => {
    if (!current) return;
    try { play('levelUp'); } catch {}
    fireConfetti('mission');
  }, [current, fireConfetti, play]);

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setDismissing(false);
    }, 250);
  }, []);

  const handleClaim = useCallback(() => {
    if (!current) return;
    setDismissing(true);
    current.doClaim();
    clearActiveContext();
    fireConfetti('rankUp');
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setDismissing(false);
    }, 400);
  }, [current, clearActiveContext, fireConfetti]);

  // Auto dismiss 8s
  useEffect(() => {
    if (!current || dismissing) return;
    const timer = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current, dismissing, handleDismiss]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="qcp-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: dismissing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
        >
          <motion.div
            className="qcp-panel"
            initial={{ y: 60, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="qcp-close" onClick={handleDismiss} aria-label="Để sau">
              <X size={18} />
            </button>

            <div className="qcp-confetti-aura">
              <motion.div
                className="qcp-icon-wrap"
                animate={{
                  rotate: [0, -10, 10, -6, 6, 0],
                  scale: [1, 1.15, 1, 1.1, 1],
                }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              >
                <span className="qcp-icon">{current.icon}</span>
                <motion.span
                  className="qcp-sparkle"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles size={18} />
                </motion.span>
              </motion.div>
            </div>

            <p className="qcp-label">🎉 ĐÃ HOÀN THÀNH</p>
            <h2 className="qcp-title">{current.title}</h2>

            <div className="qcp-rewards">
              <div className="qcp-reward-chip qcp-reward-chip--xp">
                +{current.xpReward} XP
              </div>
              {current.rewardItemIds.map((id) => {
                const item = getRewardById(id);
                if (!item) return null;
                const rarity = RARITY_META[item.rarity];
                return (
                  <div
                    key={id}
                    className="qcp-reward-chip qcp-reward-chip--item"
                    style={{ borderColor: rarity.color, color: rarity.color }}
                  >
                    {item.icon} {item.name}
                  </div>
                );
              })}
            </div>

            <div className="qcp-actions">
              <button className="qcp-claim-btn" onClick={handleClaim}>
                <Gift size={16} />
                Nhận thưởng
                <ArrowRight size={14} />
              </button>
              <button className="qcp-later-btn" onClick={handleDismiss}>
                Để sau
              </button>
            </div>

            <div className="qcp-timer-bar">
              <motion.div
                className="qcp-timer-fill"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
