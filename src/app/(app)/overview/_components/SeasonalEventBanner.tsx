/* ═══ SeasonalEventBanner — Sự kiện theo mùa ═══
 *
 * Hiển thị event đang active với chapter line tuyến tính.
 * Tự ẩn khi không có event active.
 */
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronRight, Crown, Gift, Lock, Sparkles, X } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { collectSeasonalDelta } from '@/lib/questMetrics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useConfetti } from '@/hooks/useConfetti';
import { getRewardById, RARITY_META } from '@/data/rewardCatalog';
import './SeasonalEventBanner.css';

export default function SeasonalEventBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const { fireConfetti } = useConfetti();

  const ensureSeasonal = useQuestStore((s) => s.ensureSeasonalEvent);
  const evaluateSeasonal = useQuestStore((s) => s.evaluateSeasonal);
  const claimChapter = useQuestStore((s) => s.claimSeasonalChapter);
  const claimFinal = useQuestStore((s) => s.claimSeasonalFinal);
  const chapterInstances = useQuestStore((s) => s.seasonalChapterInstances);
  const startedAt = useQuestStore((s) => s.seasonalStartedAt);
  const finalClaimedAt = useQuestStore((s) => s.seasonalFinalClaimedAt);
  const getCurrent = useQuestStore((s) => s.getCurrentSeasonal);

  // Subscribe data sources
  const user = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);
  const tasks = useTaskStore((s) => s.tasks);

  // Init + re-eval
  useEffect(() => {
    ensureSeasonal();
  }, [ensureSeasonal]);

  useEffect(() => {
    if (!startedAt) return;
    const delta = collectSeasonalDelta(startedAt);
    evaluateSeasonal(delta);
  }, [user, transactions, tasks, startedAt, evaluateSeasonal, chapterInstances]);

  const event = getCurrent();
  if (!event || !startedAt) return null;

  const sortedChapters = [...event.chapters].sort((a, b) => a.order - b.order);
  const claimedCount = sortedChapters.filter((c) => chapterInstances[c.id]?.claimedAt).length;
  const allChaptersClaimed = claimedCount === sortedChapters.length;
  const totalProgress = Math.round((claimedCount / sortedChapters.length) * 100);

  // Find next un-claimed chapter (the "active" one)
  const activeChapter = sortedChapters.find((c) => !chapterInstances[c.id]?.claimedAt);

  const handleClaimChapter = (chapterId: string) => {
    const result = claimChapter(chapterId);
    if (result.granted) {
      fireConfetti('mission');
    }
  };

  const handleClaimFinal = () => {
    const result = claimFinal();
    if (result.granted) {
      fireConfetti('rankUp');
    }
  };

  return (
    <>
      {/* ═══ Trigger banner ═══ */}
      <motion.button
        className="seb-trigger"
        onClick={() => setIsOpen(true)}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ '--seb-color': event.themeColor } as React.CSSProperties}
      >
        <div className="seb-trigger-icon">
          <span className="seb-trigger-emoji">{event.icon}</span>
        </div>
        <div className="seb-trigger-content">
          <div className="seb-trigger-meta">
            <Calendar size={11} />
            <span>SỰ KIỆN ĐẶC BIỆT</span>
          </div>
          <h3 className="seb-trigger-name">{event.name}</h3>
          <p className="seb-trigger-sub">{event.subtitle}</p>
          <div className="seb-trigger-progress">
            <div
              className="seb-trigger-progress-fill"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <p className="seb-trigger-progress-text">
            {claimedCount}/{sortedChapters.length} chương · {totalProgress}%
          </p>
        </div>
        <ChevronRight size={18} className="seb-trigger-arrow" />
      </motion.button>

      {/* ═══ Modal full ═══ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="seb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="seb-panel"
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              style={{ '--seb-color': event.themeColor } as React.CSSProperties}
            >
              <button className="seb-close" onClick={() => setIsOpen(false)} aria-label="Đóng">
                <X size={18} />
              </button>

              <header className="seb-header">
                <span className="seb-header-icon">{event.icon}</span>
                <p className="seb-header-meta">SỰ KIỆN ĐẶC BIỆT</p>
                <h2 className="seb-header-name">{event.name}</h2>
                <p className="seb-header-sub">{event.subtitle}</p>
                <p className="seb-header-period">
                  {event.startDate} → {event.endDate}
                </p>
              </header>

              <div className="seb-progress-block">
                <div className="seb-progress-bar">
                  <div
                    className="seb-progress-bar-fill"
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
                <p className="seb-progress-label">
                  {claimedCount}/{sortedChapters.length} chương hoàn thành
                </p>
              </div>

              <div className="seb-chapters">
                {sortedChapters.map((chapter) => {
                  const inst = chapterInstances[chapter.id];
                  const claimed = !!inst?.claimedAt;
                  const completed = !!inst?.completedAt;
                  const isActive = chapter.id === activeChapter?.id;
                  const isLocked = !claimed && !isActive;

                  return (
                    <div
                      key={chapter.id}
                      className={`seb-chapter ${claimed ? 'seb-chapter--claimed' : ''} ${isActive ? 'seb-chapter--active' : ''} ${isLocked ? 'seb-chapter--locked' : ''}`}
                    >
                      <div className="seb-chapter-icon">
                        {isLocked ? <Lock size={16} /> : <span>{chapter.icon}</span>}
                      </div>
                      <div className="seb-chapter-body">
                        <p className="seb-chapter-order">Chương {chapter.order}</p>
                        <h3 className="seb-chapter-title">{chapter.title}</h3>

                        {isActive && (
                          <>
                            <p className="seb-chapter-scenario">{chapter.scenario}</p>
                            <p className="seb-chapter-hint">💡 {chapter.hint}</p>

                            <div className="seb-chapter-rewards">
                              <span className="seb-chip">+{chapter.xpReward} XP</span>
                              {chapter.rewardItemIds?.map((id) => {
                                const item = getRewardById(id);
                                if (!item) return null;
                                const rarity = RARITY_META[item.rarity];
                                return (
                                  <span
                                    key={id}
                                    className="seb-chip seb-chip--item"
                                    style={{ borderColor: rarity.color, color: rarity.color }}
                                  >
                                    {item.icon} {item.name}
                                  </span>
                                );
                              })}
                            </div>

                            {completed ? (
                              <button
                                className="seb-chapter-claim"
                                onClick={() => handleClaimChapter(chapter.id)}
                              >
                                <Gift size={14} />
                                Nhận thưởng chương
                              </button>
                            ) : (
                              <p className="seb-chapter-pending">⏳ Đang theo dõi tiến độ...</p>
                            )}
                          </>
                        )}

                        {claimed && (
                          <p className="seb-chapter-claimed-label">✓ Đã hoàn thành</p>
                        )}

                        {isLocked && (
                          <p className="seb-chapter-locked-label">
                            Mở khóa sau khi hoàn thành chương trước
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Final reward */}
              <div
                className={`seb-final ${allChaptersClaimed && !finalClaimedAt ? 'seb-final--ready' : ''} ${finalClaimedAt ? 'seb-final--claimed' : ''}`}
              >
                <div className="seb-final-header">
                  <Crown size={18} />
                  <span>Phần thưởng cuối</span>
                </div>
                <p className="seb-final-label">{event.finalRewardLabel}</p>
                {finalClaimedAt ? (
                  <p className="seb-final-status">
                    <Sparkles size={14} /> Đã nhận. Cảm ơn bạn đã hoàn thành sự kiện!
                  </p>
                ) : allChaptersClaimed ? (
                  <button className="seb-final-btn" onClick={handleClaimFinal}>
                    <Gift size={14} />
                    Nhận trọn bộ phần thưởng
                  </button>
                ) : (
                  <p className="seb-final-status seb-final-status--locked">
                    <Lock size={14} /> Hoàn thành {sortedChapters.length} chương để mở khóa
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
