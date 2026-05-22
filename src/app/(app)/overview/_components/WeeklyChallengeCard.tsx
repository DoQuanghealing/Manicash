/* ═══ WeeklyChallengeCard — Thử thách 7 ngày ═══
 *
 * Hiển thị challenge tuần (xoay vòng 4 theme).
 * Tự ensure mỗi khi mount; eval khi data đổi; claim manual khi xong.
 */
'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Gift, CheckCircle2, ChevronRight } from 'lucide-react';
import { useQuestStore } from '@/stores/useQuestStore';
import { collectAllMetrics } from '@/lib/questMetrics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useWishlistStore } from '@/stores/useWishlistStore';
import { useConfetti } from '@/hooks/useConfetti';
import { useQuestAction } from '@/hooks/useQuestAction';
import { formatCurrency } from '@/utils/formatCurrency';
import { getRewardById, RARITY_META } from '@/data/rewardCatalog';
import './WeeklyChallengeCard.css';

export default function WeeklyChallengeCard() {
  const { fireConfetti } = useConfetti();
  const dispatchAction = useQuestAction();
  const ensureWeekly = useQuestStore((s) => s.ensureCurrentWeekly);
  const evaluateWeekly = useQuestStore((s) => s.evaluateWeekly);
  const claimWeekly = useQuestStore((s) => s.claimWeekly);
  const weeklyInstance = useQuestStore((s) => s.weeklyInstance);
  const getCurrent = useQuestStore((s) => s.getCurrentWeekly);
  const setActiveContext = useQuestStore((s) => s.setActiveContext);

  // Subscribe data sources cần thiết để re-eval
  const user = useAuthStore((s) => s.user);
  const transactions = useFinanceStore((s) => s.transactions);
  const tasks = useTaskStore((s) => s.tasks);
  const wishlist = useWishlistStore((s) => s.items);

  const template = getCurrent();

  // Tính target dynamic theo lastMonthIncome — collectAllMetrics đọc internally
  // từ các store; user/transactions/tasks/wishlist là subscribe-triggers cho re-render.
  // Touch các biến này để linter hài lòng + làm rõ intent.
  const { target, displayHint, currentValue } = useMemo(() => {
    void user; void transactions; void tasks; void wishlist;
    const metrics = collectAllMetrics();
    const { target, displayHint } = template.computeTarget(metrics.lastMonthIncome);
    return {
      target,
      displayHint,
      currentValue: metrics.weekly[template.metric] ?? 0,
    };
  }, [user, transactions, tasks, wishlist, template]);

  // Init + re-eval
  useEffect(() => {
    ensureWeekly();
  }, [ensureWeekly]);

  useEffect(() => {
    const metrics = collectAllMetrics();
    evaluateWeekly(metrics.weekly, target);
  }, [user, transactions, tasks, wishlist, target, evaluateWeekly, weeklyInstance]);

  if (!weeklyInstance) return null;

  const isCompleted = !!weeklyInstance.completedAt;
  const isClaimed = !!weeklyInstance.claimedAt;
  const progress = Math.min(100, Math.round((currentValue / target) * 100));

  const formatValue = (v: number): string => {
    if (template.metric === 'saved_this_week') return formatCurrency(v);
    return String(v);
  };

  const handleClaim = () => {
    const result = claimWeekly();
    if (result.granted) {
      fireConfetti('rankUp');
    }
  };

  return (
    <motion.div
      className={`wcc-card wcc-card--${template.theme} ${isClaimed ? 'wcc-card--claimed' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
    >
      <div className="wcc-header">
        <div className="wcc-header-icon">
          <span className="wcc-icon-emoji">{template.icon}</span>
        </div>
        <div className="wcc-header-content">
          <div className="wcc-header-meta">
            <CalendarDays size={11} />
            <span>Thử thách tuần này</span>
          </div>
          <h3 className="wcc-title">{template.title}</h3>
          <p className="wcc-desc">{template.description}</p>
        </div>
      </div>

      <div className="wcc-progress-block">
        <div className="wcc-progress-row">
          <span className="wcc-progress-current">{formatValue(currentValue)}</span>
          <span className="wcc-progress-divider">/</span>
          <span className="wcc-progress-target">{formatValue(target)}</span>
        </div>
        <p className="wcc-hint">{displayHint}</p>
        <div className="wcc-progress-bar">
          <div className="wcc-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="wcc-rewards-row">
        <span className="wcc-reward-chip">+{template.xpReward} XP</span>
        {template.rewardItemIds?.map((id) => {
          const item = getRewardById(id);
          if (!item) return null;
          const rarity = RARITY_META[item.rarity];
          return (
            <span
              key={id}
              className="wcc-reward-chip wcc-reward-chip--item"
              style={{ borderColor: rarity.color, color: rarity.color }}
            >
              {item.icon} {item.name}
            </span>
          );
        })}
      </div>

      {isClaimed ? (
        <div className="wcc-status wcc-status--claimed">
          <CheckCircle2 size={14} />
          <span>Đã nhận thưởng. Quay lại thứ 2 cho thử thách mới.</span>
        </div>
      ) : isCompleted ? (
        <button className="wcc-claim-btn" onClick={handleClaim}>
          <Gift size={14} />
          Nhận thưởng tuần
        </button>
      ) : (
        <button
          className="wcc-action-btn"
          onClick={() => {
            setActiveContext({
              questId: template.id,
              questType: 'weekly',
              startedAt: new Date().toISOString(),
              returnPath: '/overview',
            });
            dispatchAction(template.action);
          }}
        >
          <span>{template.action?.buttonLabel || 'Làm ngay'}</span>
          <ChevronRight size={14} />
        </button>
      )}
    </motion.div>
  );
}
