/* ═══ TaskCard — Accordion with sub-tasks checklist + XP badge ═══ */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { EarningTask, TaskStatus } from '@/types/task';
import { calculateTaskXP } from '@/types/task';
import { useTaskStore } from '@/stores/useTaskStore';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './TaskCard.css';

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; emoji: string }> = {
  pending:   { label: 'Chuẩn bị',     color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  emoji: '🟡' },
  active:    { label: 'Đang diễn ra', color: '#10B981', bg: 'rgba(16,185,129,0.08)',  emoji: '🟢' },
  completed: { label: 'Hoàn thành',   color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   emoji: '✅' },
  overdue:   { label: 'Trễ hạn',      color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   emoji: '🔴' },
};

interface TaskCardProps {
  task: EarningTask;
  status: TaskStatus;
  onComplete: (id: string) => void;
  onOverdueAction: (id: string) => void;
  onEdit?: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function TaskCard({ task, status, onComplete, onOverdueAction, onEdit }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleSubTask = useTaskStore((s) => s.toggleSubTask);
  const cfg = STATUS_CONFIG[status];
  const xp = calculateTaskXP(task.expectedAmount, task.subTasks.length);
  const stDone = task.subTasks.filter((st) => st.isCompleted).length;
  const stTotal = task.subTasks.length;
  const stPercent = stTotal > 0 ? Math.round((stDone / stTotal) * 100) : 0;

  const handleToggleSub = useCallback((subId: string) => {
    if (status !== 'completed') toggleSubTask(task.id, subId);
  }, [task.id, status, toggleSubTask]);

  return (
    <motion.div
      className={`tc-card tc-card--${status}`}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ borderLeftColor: cfg.color }}
    >
      {/* Overdue blur overlay */}
      {status === 'overdue' && <div className="tc-overdue-overlay" />}

      {/* Header — clickable to expand */}
      <div className="tc-header" onClick={() => setExpanded(!expanded)}>
        <div className="tc-title-row">
          <span className="tc-emoji">{cfg.emoji}</span>
          <span className="tc-name">{task.name}</span>
        </div>
        <div className="tc-header-right">
          {/* XP Badge */}
          <span className="tc-xp-badge">⚡{xp} XP</span>
          <span className="tc-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
          <ChevronDown size={14} className={`tc-chevron ${expanded ? 'tc-chevron--open' : ''}`} />
        </div>
      </div>

      {/* Sub-task progress mini bar */}
      {stTotal > 0 && (
        <div className="tc-st-progress">
          <div className="tc-st-bar">
            <div className="tc-st-fill" style={{ width: `${stPercent}%`, background: cfg.color }} />
          </div>
          <span className="tc-st-label">{stDone}/{stTotal} bước</span>
        </div>
      )}

      {/* Details row */}
      <div className="tc-details">
        <div className="tc-detail">
          <span className="tc-detail-label">Kỳ vọng</span>
          <span className="tc-detail-value">{formatCurrencyShort(task.expectedAmount)}</span>
        </div>
        <div className="tc-detail">
          <span className="tc-detail-label">Thời gian</span>
          <span className="tc-detail-value">{formatDate(task.startDate)} → {formatDate(task.endDate)}</span>
        </div>
        {task.actualAmount && (
          <div className="tc-detail">
            <span className="tc-detail-label">Thực tế</span>
            <span className="tc-detail-value tc-actual">{formatCurrencyShort(task.actualAmount)}</span>
          </div>
        )}
      </div>

      {/* Expandable accordion — sub-tasks checklist */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tc-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {stTotal > 0 && (
              <div className="tc-checklist">
                <p className="tc-checklist-header">📋 Checklist ({stDone}/{stTotal})</p>
                {task.subTasks.map((st) => (
                  <motion.label
                    key={st.id}
                    className={`tc-check-item ${st.isCompleted ? 'tc-check-item--done' : ''}`}
                    whileTap={{ scale: 0.97 }}
                  >
                    <input
                      type="checkbox"
                      className="tc-checkbox"
                      checked={st.isCompleted}
                      onChange={() => handleToggleSub(st.id)}
                      disabled={status === 'completed'}
                    />
                    <span className="tc-check-custom">
                      {st.isCompleted && <span className="tc-check-mark">✓</span>}
                    </span>
                    <span className={`tc-check-text ${st.isCompleted ? 'tc-check-text--done' : ''}`}>
                      {st.name}
                    </span>
                  </motion.label>
                ))}
              </div>
            )}

            {/* Edit button */}
            {onEdit && status !== 'completed' && (
              <button className="tc-edit-btn" onClick={() => onEdit(task.id)}>
                ✏️ Chỉnh sửa
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {status === 'active' && (
        <button className="tc-btn tc-btn--complete" onClick={() => onComplete(task.id)}>
          ✅ Hoàn thành
        </button>
      )}
      {status === 'overdue' && (
        <button className="tc-btn tc-btn--overdue" onClick={() => onOverdueAction(task.id)}>
          ⚠️ Xử lý trễ hạn
        </button>
      )}
    </motion.div>
  );
}
