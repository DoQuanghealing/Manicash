/* ═══ SeasonalEventPanel — Sự kiện theo mùa (bản INLINE trong hub Nhiệm vụ) ═══
 *
 * Trước: banner riêng trên đầu Overview (nút trigger → mở modal).
 * Giờ: render thẳng vào tab "Sự kiện" của TasksHub — không nút, không modal.
 * Vòng đời (ensureSeasonalEvent + evaluateSeasonal) do TasksHub sở hữu để pill/
 * chấm sáng trên tab cập nhật kể cả khi tab chưa mở. Panel này chỉ ĐỌC tiến độ
 * + xử lý hành động (nhận thưởng / điểm danh / mở tab liên quan).
 *
 * Tự ẩn (return null) khi không có event active.
 */
'use client';

import { useState } from 'react';
import { CalendarDays, ChevronRight, Crown, Gift, Lock, Sparkles } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { useConfetti } from '@/hooks/useConfetti';
import { useQuestAction } from '@/hooks/useQuestAction';
import { getRewardById, RARITY_META } from '@/data/rewardCatalog';
import CheckInModal from '@/components/ui/CheckInModal';
import type { SeasonalMetric } from '@/data/seasonalEvents';
import type { QuestAction } from '@/data/dailyQuestPool';
import './SeasonalEventPanel.css';

/** Map seasonal metric → default action — destination user cần làm. */
function actionForMetric(metric: SeasonalMetric): QuestAction {
  switch (metric) {
    case 'event_app_days':
      return { kind: 'checkin', buttonLabel: 'Điểm danh' };
    case 'event_task_completed':
      return { kind: 'openMoney', buttonLabel: 'Mở Tab Tiền' };
    case 'event_saved':
      return { kind: 'navigate', target: '/input', query: { type: 'income' }, buttonLabel: 'Mở Ghi tiền' };
    case 'event_resist':
      return { kind: 'openWishlist', buttonLabel: 'Mở Wishlist' };
    case 'event_income_logged':
      return { kind: 'navigate', target: '/input', query: { type: 'income' }, buttonLabel: 'Ghi thu nhập' };
  }
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. */
function fmtViDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Số ngày từ hôm nay (local) đến mốc 'YYYY-MM-DD'; âm nếu đã qua. */
function daysFromToday(iso: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function SeasonalEventPanel() {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const { fireConfetti } = useConfetti();
  const dispatchAction = useQuestAction();
  const setActiveContext = useQuestStore((s) => s.setActiveContext);

  const claimChapter = useQuestStore((s) => s.claimSeasonalChapter);
  const claimFinal = useQuestStore((s) => s.claimSeasonalFinal);
  const chapterInstances = useQuestStore((s) => s.seasonalChapterInstances);
  const startedAt = useQuestStore((s) => s.seasonalStartedAt);
  const finalClaimedAt = useQuestStore((s) => s.seasonalFinalClaimedAt);
  const getCurrent = useQuestStore((s) => s.getCurrentSeasonal);

  const event = getCurrent();
  if (!event || !startedAt) return null;

  const sortedChapters = [...event.chapters].sort((a, b) => a.order - b.order);
  const claimedCount = sortedChapters.filter((c) => chapterInstances[c.id]?.claimedAt).length;
  const allChaptersClaimed = claimedCount === sortedChapters.length;
  const totalProgress = Math.round((claimedCount / sortedChapters.length) * 100);

  // Find next un-claimed chapter (the "active" one)
  const activeChapter = sortedChapters.find((c) => !chapterInstances[c.id]?.claimedAt);

  // Mốc thời gian sự kiện
  const daysToStart = daysFromToday(event.startDate);
  const daysToEnd = daysFromToday(event.endDate);
  const notStarted = daysToStart > 0;
  const countdownLabel = notStarted
    ? `Bắt đầu sau ${daysToStart} ngày`
    : daysToEnd <= 0
      ? 'Kết thúc hôm nay'
      : `Còn ${daysToEnd} ngày`;
  const isUrgent = !notStarted && daysToEnd >= 0 && daysToEnd <= 7;

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
    <div className="seb-inline" style={{ '--seb-color': event.themeColor } as React.CSSProperties}>
      <header className="seb-header">
        <span className="seb-header-icon">{event.icon}</span>
        <p className="seb-header-meta">SỰ KIỆN ĐẶC BIỆT</p>
        <h2 className="seb-header-name">{event.name}</h2>
        <p className="seb-header-sub">{event.subtitle}</p>
        {event.lunarLabel && (
          <p className="seb-header-lunar">
            🌙 {event.lunarLabel}
            {event.primaryDate && (
              <span className="seb-header-primary-date">
                {' '}· {new Date(event.primaryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </p>
        )}
        <div className="seb-header-dates">
          <span className="seb-header-daterange">
            <CalendarDays size={12} />
            {fmtViDate(event.startDate)} → {fmtViDate(event.endDate)}
          </span>
          <span className={`seb-header-countdown${isUrgent ? ' is-urgent' : ''}`}>
            {countdownLabel}
          </span>
        </div>
      </header>

      <div className="seb-progress-block">
        <div className="seb-progress-bar">
          <div className="seb-progress-bar-fill" style={{ width: `${totalProgress}%` }} />
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
                      <button
                        className="seb-chapter-action"
                        onClick={() => {
                          const act = actionForMetric(chapter.metric);
                          setActiveContext({
                            questId: chapter.id,
                            questType: 'seasonal',
                            startedAt: new Date().toISOString(),
                            returnPath: '/overview',
                          });
                          dispatchAction(act, () => setCheckinOpen(true));
                        }}
                      >
                        <span>{actionForMetric(chapter.metric).buttonLabel}</span>
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </>
                )}

                {claimed && <p className="seb-chapter-claimed-label">✓ Đã hoàn thành</p>}

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

      <CheckInModal isOpen={checkinOpen} onClose={() => setCheckinOpen(false)} />
    </div>
  );
}
