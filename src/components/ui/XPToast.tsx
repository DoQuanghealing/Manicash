/* ═══ XPToast — Stack toast top-right cho XP grant events ═══
 * Mount 1 lần ở app shell. Subscribe xpEvents singleton, render queue toasts.
 * Auto-dismiss 3s mỗi toast. Stack max 4 visible — mới nhất push vào top.
 */
'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeXPGranted, type XPGrantedDetail } from '@/lib/xpEvents';
import type { XPActionType } from '@/types/gamification';
import './XPToast.css';

const DISMISS_MS = 3000;
const MAX_VISIBLE = 4;

interface ToastItem {
  id: number;
  detail: XPGrantedDetail;
}

/** Label tiếng Việt cho từng XP action — toast chính. */
const ACTION_LABELS: Record<XPActionType, string> = {
  INCOME_LOGGED: 'Đã ghi thu nhập',
  EXPENSE_LOGGED: 'Đã ghi chi tiêu',
  RESIST_SPENDING: 'Nhịn chi tiêu — kỷ luật!',
  MISSION_COMPLETE: 'Hoàn thành nhiệm vụ',
  DAILY_STREAK: 'Streak hằng ngày',
  STREAK_BONUS: 'Mốc 7 ngày streak!',
  BUDGET_ON_TRACK: 'Ngân sách đúng kế hoạch',
  SAVINGS_DEPOSIT: 'Đã gửi tiết kiệm',
  TASK_COMPLETE: 'Hoàn thành nhiệm vụ kiếm tiền',
  TASK_OVERDUE: 'Trễ hạn nhiệm vụ',
};

/** Emoji prefix theo action — cảm xúc. */
const ACTION_EMOJI: Record<XPActionType, string> = {
  INCOME_LOGGED: '💰',
  EXPENSE_LOGGED: '📝',
  RESIST_SPENDING: '🛡️',
  MISSION_COMPLETE: '🎯',
  DAILY_STREAK: '✅',
  STREAK_BONUS: '🔥',
  BUDGET_ON_TRACK: '📊',
  SAVINGS_DEPOSIT: '🏦',
  TASK_COMPLETE: '🏆',
  TASK_OVERDUE: '⚠️',
};

export default function XPToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeXPGranted((detail) => {
      const id = ++idRef.current;
      setToasts((prev) => {
        // Cap visible — drop oldest nếu vượt MAX_VISIBLE.
        const next = [...prev, { id, detail }];
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });

      // Auto-dismiss sau DISMISS_MS — remove by id.
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DISMISS_MS);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="xp-toast-host" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastBubble key={t.id} detail={t.detail} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastBubble({ detail }: { detail: XPGrantedDetail }) {
  const isPositive = detail.amount >= 0;
  const isBonus = detail.type === 'STREAK_BONUS';
  const sign = isPositive ? '+' : '';
  const label = ACTION_LABELS[detail.type];
  const emoji = ACTION_EMOJI[detail.type];

  const variantClass = isBonus
    ? 'xp-toast--bonus'
    : isPositive
      ? 'xp-toast--positive'
      : 'xp-toast--negative';

  return (
    <motion.div
      className={`xp-toast ${variantClass}`}
      initial={{ opacity: 0, x: 40, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <span className="xp-toast-emoji">{emoji}</span>
      <div className="xp-toast-text">
        <span className="xp-toast-amount">{sign}{detail.amount} XP</span>
        <span className="xp-toast-label">{label}</span>
      </div>
    </motion.div>
  );
}
