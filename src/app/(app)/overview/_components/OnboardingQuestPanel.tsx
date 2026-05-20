/* ═══ OnboardingQuestPanel — Lộ trình tân thủ 7 bước ═══
 *
 * Hiển thị quest hiện tại (currentOnboardingOrder), tiến độ tổng,
 * cho phép user nhận thưởng khi quest đã complete.
 *
 * Tự ẩn khi tất cả 7 quest đã claimed.
 */
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, Gift, Sparkles, X } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { collectAllMetrics } from '@/lib/questMetrics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useWishlistStore } from '@/stores/useWishlistStore';
import { useConfetti } from '@/hooks/useConfetti';
import { ONBOARDING_QUESTS, TOTAL_ONBOARDING_QUESTS } from '@/data/onboardingQuests';
import { getRewardById, RARITY_META } from '@/data/rewardCatalog';
import './OnboardingQuestPanel.css';

export default function OnboardingQuestPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [claimedItems, setClaimedItems] = useState<string[] | null>(null);
  const { fireConfetti } = useConfetti();

  // Subscribe các store cần thiết để re-evaluate khi data đổi
  const user = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);
  const tasks = useTaskStore((s) => s.tasks);
  const goals = useGoalsStore((s) => s.goals);
  const wishlist = useWishlistStore((s) => s.items);

  const evaluateOnboarding = useQuestStore((s) => s.evaluateOnboarding);
  const claimOnboarding = useQuestStore((s) => s.claimOnboarding);
  const onboardingInstances = useQuestStore((s) => s.onboardingInstances);
  const currentOrder = useQuestStore((s) => s.currentOnboardingOrder);
  const isDone = useQuestStore((s) => s.isOnboardingDone());
  const completedCount = useQuestStore((s) => s.getOnboardingCompletedCount());

  // Auto re-evaluate khi data thay đổi
  useEffect(() => {
    const metrics = collectAllMetrics();
    evaluateOnboarding(metrics.onboarding);
  }, [user, transactions, tasks, goals, wishlist, evaluateOnboarding]);

  // Đừng render nếu đã hoàn thành toàn bộ
  if (isDone) return null;

  const activeQuest = ONBOARDING_QUESTS.find((q) => q.order === currentOrder);
  if (!activeQuest) return null;

  const activeInstance = onboardingInstances[activeQuest.id];
  const isCompleted = !!activeInstance?.completedAt;

  const progress = Math.round((completedCount / TOTAL_ONBOARDING_QUESTS) * 100);

  const handleClaim = (questId: string) => {
    const result = claimOnboarding(questId);
    if (result.granted) {
      fireConfetti('mission');
      setClaimedItems(result.rewardIds);
      setTimeout(() => setClaimedItems(null), 4000);
    }
  };

  return (
    <>
      {/* ═══ Trigger card ═══ */}
      <motion.button
        className={`obq-trigger ${isCompleted ? 'obq-trigger--ready' : ''}`}
        onClick={() => setIsOpen(true)}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="obq-trigger-icon">
          <span className="obq-trigger-emoji">{activeQuest.icon}</span>
          {isCompleted && (
            <span className="obq-trigger-pulse">
              <Sparkles size={10} />
            </span>
          )}
        </div>
        <div className="obq-trigger-content">
          <div className="obq-trigger-header">
            <span className="obq-trigger-label">
              Tân Thủ {activeQuest.order}/{TOTAL_ONBOARDING_QUESTS}
            </span>
            {isCompleted && <span className="obq-trigger-ready-badge">Sẵn nhận quà</span>}
          </div>
          <p className="obq-trigger-title">{activeQuest.title}</p>
          <div className="obq-trigger-progress">
            <div className="obq-trigger-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <ChevronRight size={18} className="obq-trigger-arrow" />
      </motion.button>

      {/* ═══ Modal ═══ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="obq-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="obq-panel"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="obq-close" onClick={() => setIsOpen(false)} aria-label="Đóng">
                <X size={18} />
              </button>

              <header className="obq-header">
                <p className="obq-header-label">Lộ trình tân thủ</p>
                <h2 className="obq-header-title">
                  {completedCount}/{TOTAL_ONBOARDING_QUESTS} hoàn thành
                </h2>
                <div className="obq-header-progress">
                  <div className="obq-header-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </header>

              {/* Active quest detail */}
              <div className="obq-active-card">
                <div className="obq-active-icon">{activeQuest.icon}</div>
                <div className="obq-active-body">
                  <p className="obq-active-step">Bước {activeQuest.order}</p>
                  <h3 className="obq-active-title">{activeQuest.title}</h3>
                  <p className="obq-active-scenario">{activeQuest.scenario}</p>
                  <p className="obq-active-hint">
                    <span className="obq-hint-label">Cách làm: </span>
                    {activeQuest.hint}
                  </p>

                  <div className="obq-rewards-preview">
                    <span className="obq-reward-chip">+{activeQuest.xpReward} XP</span>
                    {activeQuest.rewardItemIds?.map((id) => {
                      const item = getRewardById(id);
                      if (!item) return null;
                      const rarity = RARITY_META[item.rarity];
                      return (
                        <span
                          key={id}
                          className="obq-reward-chip obq-reward-chip--item"
                          style={{ borderColor: rarity.color, color: rarity.color }}
                        >
                          {item.icon} {item.name}
                        </span>
                      );
                    })}
                  </div>

                  {isCompleted ? (
                    <button
                      className="obq-claim-btn"
                      onClick={() => handleClaim(activeQuest.id)}
                    >
                      <Gift size={16} />
                      Nhận thưởng
                    </button>
                  ) : (
                    <p className="obq-pending">
                      🕒 Hoàn thành tình huống trên — app sẽ tự nhận biết
                    </p>
                  )}
                </div>
              </div>

              {/* Locked future quests preview */}
              <div className="obq-future-list">
                <p className="obq-future-label">Tiếp theo bạn sẽ làm</p>
                {ONBOARDING_QUESTS.filter((q) => q.order > activeQuest.order)
                  .slice(0, 3)
                  .map((q) => (
                    <div key={q.id} className="obq-future-item">
                      <span className="obq-future-icon">{q.icon}</span>
                      <span className="obq-future-title">Bước {q.order}: {q.title}</span>
                      <span className="obq-future-xp">+{q.xpReward}</span>
                    </div>
                  ))}
              </div>

              {/* Completed list */}
              {completedCount > 0 && (
                <div className="obq-done-list">
                  <p className="obq-done-label">Đã hoàn thành</p>
                  {ONBOARDING_QUESTS.filter((q) => onboardingInstances[q.id]?.claimedAt).map(
                    (q) => (
                      <div key={q.id} className="obq-done-item">
                        <CheckCircle2 size={14} />
                        <span>{q.title}</span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Claim celebration */}
              <AnimatePresence>
                {claimedItems && claimedItems.length > 0 && (
                  <motion.div
                    className="obq-claim-toast"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Sparkles size={18} />
                    <div>
                      <p className="obq-claim-title">Mở khóa quà mới!</p>
                      <p className="obq-claim-body">
                        {claimedItems
                          .map((id) => getRewardById(id)?.name)
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
