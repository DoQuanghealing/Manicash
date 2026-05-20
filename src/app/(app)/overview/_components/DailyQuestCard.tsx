/* ═══ DailyQuestCard — 3 nhiệm vụ hàng ngày ═══
 *
 * Reset 0h. Cùng 1 ngày → cùng set quest (deterministic seed).
 * Tự eval mỗi khi data đổi. User bấm "Nhận quà" để claim XP.
 */
'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Gift, Sun } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { collectAllMetrics } from '@/lib/questMetrics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useConfetti } from '@/hooks/useConfetti';
import './DailyQuestCard.css';

export default function DailyQuestCard() {
  const { fireConfetti } = useConfetti();
  const ensureToday = useQuestStore((s) => s.ensureTodayDailies);
  const evaluateDailies = useQuestStore((s) => s.evaluateDailies);
  const claimDaily = useQuestStore((s) => s.claimDaily);
  const dailyInstances = useQuestStore((s) => s.dailyInstances);
  const getTemplates = useQuestStore((s) => s.getDailyTemplates);

  // Subscribe data sources
  const user = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);

  // Init + re-eval khi data đổi
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

  const handleClaim = (templateId: string) => {
    const result = claimDaily(templateId);
    if (result.granted) {
      fireConfetti('mission');
    }
  };

  return (
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
          return (
            <motion.div
              key={t.id}
              className={`dqc-item ${isClaimed ? 'dqc-item--claimed' : isDone ? 'dqc-item--ready' : ''}`}
              layout
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
                ) : isDone ? (
                  <button className="dqc-claim-btn" onClick={() => handleClaim(t.id)}>
                    <Gift size={12} />
                    +{t.xpReward}
                  </button>
                ) : (
                  <span className="dqc-xp-badge">+{t.xpReward}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
