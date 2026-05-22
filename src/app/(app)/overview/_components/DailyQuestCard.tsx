/* ═══ DailyQuestCard — 3 nhiệm vụ hàng ngày (actionable) ═══
 *
 * UX mới: mỗi quest có 1 nút action rõ ràng (đưa user thẳng tới nơi cần làm).
 * Click quest chưa làm → action (navigate / highlight / checkin modal).
 * Click quest đã làm xong (completed, chưa claim) → nhận quà.
 * Quest đã claim → disable, gạch chéo.
 *
 * Reset 0h hôm sau. Deterministic 3-pick từ seed dateKey.
 */
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Gift, Sun, ChevronRight } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { collectAllMetrics } from '@/lib/questMetrics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useConfetti } from '@/hooks/useConfetti';
import { useQuestAction } from '@/hooks/useQuestAction';
import CheckInModal from '@/components/ui/CheckInModal';
import './DailyQuestCard.css';

export default function DailyQuestCard() {
  const { fireConfetti } = useConfetti();
  const dispatchAction = useQuestAction();
  const [checkinOpen, setCheckinOpen] = useState(false);

  const ensureToday = useQuestStore((s) => s.ensureTodayDailies);
  const evaluateDailies = useQuestStore((s) => s.evaluateDailies);
  const claimDaily = useQuestStore((s) => s.claimDaily);
  const dailyInstances = useQuestStore((s) => s.dailyInstances);
  const getTemplates = useQuestStore((s) => s.getDailyTemplates);

  const user = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);

  useEffect(() => {
    ensureToday();
  }, [ensureToday]);

  useEffect(() => {
    const metrics = collectAllMetrics();
    evaluateDailies(metrics.daily);
  }, [user, transactions, evaluateDailies, dailyInstances]);

  const templates = getTemplates();
  const completedCount = templates.filter((t) => dailyInstances[t.id]?.completedAt).length;
  const allClaimed = templates.every((t) => dailyInstances[t.id]?.claimedAt);

  const handleClaim = (templateId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const result = claimDaily(templateId);
    if (result.granted) {
      fireConfetti('mission');
    }
  };

  return (
    <>
      <motion.div
        className="dqc-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="dqc-header">
          <div className="dqc-header-left">
            <Sun size={16} className="dqc-header-icon" />
            <div>
              <p className="dqc-header-label">Nhiệm vụ hôm nay</p>
              <p className="dqc-header-sub">
                {allClaimed
                  ? '🎉 Hoàn thành tất! Quay lại ngày mai'
                  : `${completedCount}/${templates.length} đã xong`}
              </p>
            </div>
          </div>
          <div className="dqc-header-progress-circle">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#22C55E"
                strokeWidth="3"
                strokeDasharray={`${(completedCount / templates.length) * 88} 88`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <span className="dqc-progress-text">{completedCount}/{templates.length}</span>
          </div>
        </div>

        <div className="dqc-list">
          {templates.map((t) => {
            const inst = dailyInstances[t.id];
            const isDone = !!inst?.completedAt;
            const isClaimed = !!inst?.claimedAt;
            const canClaim = isDone && !isClaimed;

            // Click hành vi:
            //  - Đã claim: nothing
            //  - Đã complete chưa claim: claim ngay
            //  - Chưa complete: dispatch action
            const handleRowClick = () => {
              if (isClaimed) return;
              if (canClaim) {
                handleClaim(t.id);
                return;
              }
              dispatchAction(t.action, () => setCheckinOpen(true));
            };

            return (
              <motion.button
                key={t.id}
                type="button"
                className={`dqc-item ${isClaimed ? 'dqc-item--claimed' : ''} ${canClaim ? 'dqc-item--ready' : ''}`}
                onClick={handleRowClick}
                whileTap={!isClaimed ? { scale: 0.98 } : undefined}
                layout
                disabled={isClaimed}
              >
                <div className="dqc-item-icon">
                  {isClaimed ? <CheckCircle2 size={18} /> : <span>{t.icon}</span>}
                </div>
                <div className="dqc-item-body">
                  <p className="dqc-item-title">{t.title}</p>
                  <p className="dqc-item-hint">{t.hint}</p>
                </div>
                <div className="dqc-item-action">
                  {isClaimed ? (
                    <span className="dqc-xp-badge dqc-xp-badge--claimed">✓ +{t.xpReward}</span>
                  ) : canClaim ? (
                    <span className="dqc-claim-btn">
                      <Gift size={12} />
                      Nhận +{t.xpReward}
                    </span>
                  ) : (
                    <span className="dqc-go-btn">
                      <span className="dqc-go-label">
                        {t.action?.buttonLabel || 'Làm ngay'}
                      </span>
                      <ChevronRight size={14} />
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <CheckInModal isOpen={checkinOpen} onClose={() => setCheckinOpen(false)} />
    </>
  );
}
