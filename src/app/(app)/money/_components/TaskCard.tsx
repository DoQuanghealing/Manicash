/* ═══ TaskCard — Thẻ nhiệm vụ kiếm tiền theo giai đoạn (mẫu D) ═══
 * Giữ nguyên nội dung cũ (XP, tiến độ bước, kỳ vọng/thời gian/thực nhận, checklist, sửa,
 * quản gia thẩm định) — chỉ thêm giai đoạn Đợt 1: Đang làm → Chờ thanh toán → Đã nhận tiền.
 */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { EarningTask, TaskStatus } from '@/types/task';
import { calculateTaskXP, getTaskStage } from '@/types/task';
import { useTaskStore } from '@/stores/useTaskStore';
import { templateVisualForTask } from '@/data/earningTemplates';
import { getPaymentLateDays } from '@/lib/tasks/receiveTaskPayment';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import TaskEvalPanel from './TaskEvalPanel';
import './earningTheme.css';
import './TaskCard.css';

type CardState = 'pending' | 'active' | 'overdue' | 'awaiting' | 'late' | 'paid';

const BADGE: Record<CardState, string> = {
  pending: 'Sắp tới',
  active: 'Đang làm',
  overdue: 'Trễ hạn',
  awaiting: 'Chờ thanh toán',
  late: 'Khách trễ hẹn',
  paid: 'Đã nhận tiền',
};

interface TaskCardProps {
  task: EarningTask;
  status: TaskStatus;
  /** "Xong việc" (Đang làm) → hỏi khách trả chưa. */
  onWorkDone?: (id: string) => void;
  /** "Đã nhận tiền" (Chờ thanh toán). */
  onReceive?: (id: string) => void;
  /** "Hẹn lại" (Chờ thanh toán). */
  onReschedule?: (id: string) => void;
  onOverdueAction?: (id: string) => void;
  onEdit?: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function cardState(task: EarningTask, status: TaskStatus): CardState {
  const stage = getTaskStage(task);
  if (stage === 'paid' || task.completedAt) return 'paid';
  if (stage === 'awaiting_payment') return getPaymentLateDays(task) > 0 ? 'late' : 'awaiting';
  if (status === 'overdue') return 'overdue';
  if (status === 'pending') return 'pending';
  return 'active';
}

export default function TaskCard({ task, status, onWorkDone, onReceive, onReschedule, onOverdueAction, onEdit }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleSubTask = useTaskStore((s) => s.toggleSubTask);
  const state = cardState(task, status);
  const isDone = state === 'paid';
  const isAwaiting = state === 'awaiting' || state === 'late';
  const visual = templateVisualForTask(task.templateId);
  const xp = calculateTaskXP(task.expectedAmount, task.subTasks.length);
  const stDone = task.subTasks.filter((st) => st.isCompleted).length;
  const stTotal = task.subTasks.length;
  const stPercent = stTotal > 0 ? Math.round((stDone / stTotal) * 100) : 0;
  const lateDays = getPaymentLateDays(task);
  const detailsId = `tc-details-${task.id}`;

  const handleToggleSub = useCallback((subId: string) => {
    if (!isDone) toggleSubTask(task.id, subId);
  }, [task.id, isDone, toggleSubTask]);

  let subline: string;
  if (isAwaiting) {
    const who = task.payerName ? `Khách: ${task.payerName}` : 'Chưa ghi tên khách';
    subline = state === 'late'
      ? `${who} · trễ hẹn ${lateDays} ngày`
      : task.paymentDueDate ? `${who} · hẹn ${formatDate(task.paymentDueDate)}` : who;
  } else if (isDone) {
    subline = task.completedAt ? `Nhận ngày ${formatDate(task.completedAt)}` : 'Đã khép việc';
  } else {
    subline = `${formatDate(task.startDate)} → ${formatDate(task.endDate)}`;
  }

  return (
    <motion.article
      className={`tc-card tc-card--${state}`}
      data-tid={visual.themeId ?? 'freelance'}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="tc-emo" aria-hidden="true">{visual.emoji}</span>

      <button
        type="button"
        className="tc-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <span className="tc-name">{task.name}</span>
        <span className="tc-sub">{subline}</span>
      </button>

      <div className="tc-mid">
        <span className="tc-tags">
          <span className="tc-badge">{BADGE[state]}</span>
          <span className="tc-xp-badge">⚡{xp} XP</span>
        </span>
        <span className="tc-amt">
          {isDone && task.actualAmount !== undefined ? formatCurrency(task.actualAmount) : formatCurrency(task.expectedAmount)}
        </span>
        <button
          type="button"
          className="tc-chevron-btn"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Thu gọn chi tiết' : 'Xem chi tiết'}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          <ChevronDown size={16} className={`tc-chevron ${expanded ? 'tc-chevron--open' : ''}`} />
        </button>
      </div>

      {/* Tiến độ bước (chỉ khi còn đang làm) */}
      {stTotal > 0 && !isDone && !isAwaiting && (
        <div className="tc-st-progress">
          <div className="tc-st-bar" role="progressbar" aria-valuenow={stPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ các bước">
            <div className="tc-st-fill" style={{ width: `${stPercent}%` }} />
          </div>
          <span className="tc-st-label">{stDone}/{stTotal} bước</span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={detailsId}
            className="tc-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="tc-details">
              <div className="tc-detail">
                <span className="tc-detail-label">Kỳ vọng</span>
                <span className="tc-detail-value">{formatCurrencyShort(task.expectedAmount)}</span>
              </div>
              <div className="tc-detail">
                <span className="tc-detail-label">Thời gian</span>
                <span className="tc-detail-value">{formatDate(task.startDate)} → {formatDate(task.endDate)}</span>
              </div>
              {task.actualAmount !== undefined && (
                <div className="tc-detail">
                  <span className="tc-detail-label">Thực nhận</span>
                  <span className="tc-detail-value tc-actual">{formatCurrencyShort(task.actualAmount)}</span>
                </div>
              )}
            </div>

            {stTotal > 0 && (
              <div className="tc-checklist">
                <p className="tc-checklist-header">📋 Checklist ({stDone}/{stTotal})</p>
                {task.subTasks.map((st) => (
                  <label key={st.id} className={`tc-check-item ${st.isCompleted ? 'tc-check-item--done' : ''}`}>
                    <input
                      type="checkbox"
                      className="tc-checkbox"
                      checked={st.isCompleted}
                      onChange={() => handleToggleSub(st.id)}
                      disabled={isDone}
                    />
                    <span className="tc-check-custom" aria-hidden="true">
                      {st.isCompleted && <span className="tc-check-mark">✓</span>}
                    </span>
                    <span className={`tc-check-text ${st.isCompleted ? 'tc-check-text--done' : ''}`}>
                      {st.name}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {onEdit && !isDone && (
              <button type="button" className="tc-edit-btn" onClick={() => onEdit(task.id)}>
                ✏️ Chỉnh sửa
              </button>
            )}

            {/* T5 — Quản gia thẩm định (chỉ tier Phú Vương; ẩn với task đã xong) */}
            {!isDone && <TaskEvalPanel task={task} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hành động theo giai đoạn */}
      {(state === 'active' || state === 'pending') && onWorkDone && (
        <div className="tc-actions">
          <button type="button" className="tc-btn tc-btn--pri" onClick={() => onWorkDone(task.id)}>Xong việc</button>
        </div>
      )}
      {state === 'overdue' && (
        <div className="tc-actions">
          {onWorkDone && (
            <button type="button" className="tc-btn tc-btn--pri" onClick={() => onWorkDone(task.id)}>Xong việc</button>
          )}
          {onOverdueAction && (
            <button type="button" className="tc-btn tc-btn--warn" onClick={() => onOverdueAction(task.id)}>Xử lý trễ hạn</button>
          )}
        </div>
      )}
      {isAwaiting && (
        <div className="tc-actions">
          {onReceive && (
            <button type="button" className="tc-btn tc-btn--income" onClick={() => onReceive(task.id)}>Đã nhận tiền</button>
          )}
          {onReschedule && (
            <button type="button" className="tc-btn tc-btn--ghost" onClick={() => onReschedule(task.id)}>Hẹn lại</button>
          )}
        </div>
      )}
    </motion.article>
  );
}
