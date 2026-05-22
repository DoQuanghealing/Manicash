/* ═══ GoalCard — Single goal with progress + milestones ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowDownToLine, FileClock, Landmark } from 'lucide-react';
import type { Goal } from '@/types/budget';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import { calcUrgency } from '@/lib/goalStats';
import GoalPet from './GoalPet';
import './GoalCard.css';

interface GoalCardProps {
  goal: Goal;
  onDelete: (id: string) => void;
  onCompleteMilestone: (goalId: string, msId: string) => void;
  onDeposit: (goal: Goal) => void;
  onViewDetail: (goal: Goal) => void;
}

export default function GoalCard({ goal, onDelete, onCompleteMilestone, onDeposit, onViewDetail }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progress = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  const completedMs = goal.milestones.filter((m) => m.isCompleted).length;
  const urgency = calcUrgency(goal);

  return (
    <motion.div
      className={`gc-card gc-card--urgency-${urgency}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="gc-header" onClick={() => setExpanded(!expanded)}>
        <div className="gc-header-left">
          <span className="gc-icon">{goal.icon}</span>
          <div>
            <p className="gc-name">
              {goal.name}
              {goal.bankInfo && (
                <Landmark size={11} className="gc-bank-badge" aria-label="Có TK ngân hàng" />
              )}
            </p>
            <p className="gc-deadline">Mục tiêu {goal.deadline.slice(0, 4)}</p>
          </div>
        </div>
        <div className="gc-header-right">
          <GoalPet progress={progress} size={20} />
          <span className="gc-pct-badge" style={{ background: `${goal.color}20`, color: goal.color }}>
            {progress}%
          </span>
          <ChevronDown
            className={`gc-chevron ${expanded ? 'gc-chevron--open' : ''}`}
            size={16}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div className="gc-progress-bar">
        <motion.div
          className="gc-progress-fill"
          style={{ background: goal.color, boxShadow: `0 0 12px ${goal.color}40` }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="gc-progress-labels">
        <span>{formatCurrencyShort(goal.currentAmount)}</span>
        <span>{formatCurrencyShort(goal.targetAmount)}</span>
      </div>

      {/* Action row */}
      <div className="gc-actions">
        <button
          className="gc-action-btn gc-action-btn--primary"
          onClick={(e) => { e.stopPropagation(); onDeposit(goal); }}
          style={{ background: `linear-gradient(135deg, ${goal.color}, ${goal.color}cc)` }}
        >
          <ArrowDownToLine size={13} />
          <span>Nạp vào</span>
        </button>
        <button
          className="gc-action-btn gc-action-btn--ghost"
          onClick={(e) => { e.stopPropagation(); onViewDetail(goal); }}
        >
          <FileClock size={13} />
          <span>Lịch sử ({(goal.deposits?.length ?? 0)})</span>
        </button>
      </div>

      {/* Expandable milestones */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="gc-milestones"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {goal.milestones.length > 0 ? (
              <>
                <p className="gc-ms-header">
                  Mốc tiến độ ({completedMs}/{goal.milestones.length})
                </p>
                {goal.milestones.map((ms) => (
                  <div key={ms.id} className={`gc-ms-item ${ms.isCompleted ? 'gc-ms-item--done' : ''}`}>
                    <button
                      className={`gc-ms-check ${ms.isCompleted ? 'gc-ms-check--done' : ''}`}
                      onClick={() => !ms.isCompleted && onCompleteMilestone(goal.id, ms.id)}
                      disabled={ms.isCompleted}
                    >
                      {ms.isCompleted ? '✓' : '○'}
                    </button>
                    <div className="gc-ms-info">
                      <span className="gc-ms-name">{ms.name}</span>
                      <span className="gc-ms-target">{formatCurrencyShort(ms.amount)}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="gc-ms-empty">Chưa có mốc tiến độ</p>
            )}

            <button className="gc-delete-btn" onClick={() => onDelete(goal.id)}>
              🗑️ Xóa mục tiêu
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
