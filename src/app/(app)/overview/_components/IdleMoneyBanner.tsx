/* ═══ IdleMoneyBanner — CTA khi user có tiền nhàn rỗi ═══
 *
 * Hiển thị khi mainBalance > 100tr VÀ có ≥1 goal chưa hoàn thành.
 * KHÔNG auto chia tiền — chỉ gợi ý + dẫn user vào /goals.
 *
 * User có thể "Để sau" → dismiss 24h (lưu localStorage).
 *
 * Visual: gradient xanh lá pulse nhẹ → catch attention nhưng không annoying.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Sparkles, X, ArrowRight, Wallet } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './IdleMoneyBanner.css';

const IDLE_THRESHOLD = 100_000_000; // 100tr
const DISMISS_KEY = 'manicash_idle_money_dismissed_until';

export default function IdleMoneyBanner() {
  const router = useRouter();
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const goals = useGoalsStore((s) => s.goals);
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
  });
  // "now" state — update mỗi 60s để re-evaluate isDismissed. Đặt trong state
  // thay vì gọi Date.now() trực tiếp trong render (React Compiler complain impure).
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Reset dismissal khi qua hạn + heartbeat update nowMs mỗi phút
  useEffect(() => {
    if (dismissedUntil && nowMs > dismissedUntil) {
      // Defer setState ra ngoài effect — subscribe pattern hợp lệ
      queueMicrotask(() => setDismissedUntil(0));
      try { localStorage.removeItem(DISMISS_KEY); } catch {}
    }
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [dismissedUntil, nowMs]);

  // Conditions: có tiền nhàn rỗi, có goals chưa xong, chưa dismiss
  const incompleteGoals = useMemo(
    () => goals.filter((g) => g.currentAmount < g.targetAmount),
    [goals]
  );
  const isIdle = mainBalance > IDLE_THRESHOLD;
  const isDismissed = dismissedUntil > nowMs;
  const shouldShow = isIdle && incompleteGoals.length > 0 && !isDismissed;

  if (!shouldShow) return null;

  // Gợi ý chia: 30% số tiền nhàn rỗi vào goal chưa đạt nhất
  const suggestedAmount = Math.floor((mainBalance * 0.3) / 100_000) * 100_000;
  const targetGoal = incompleteGoals
    .slice()
    .sort((a, b) => (b.targetAmount - b.currentAmount) - (a.targetAmount - a.currentAmount))[0];

  const handleDismiss = () => {
    const until = Date.now() + 24 * 60 * 60 * 1000; // 24h
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissedUntil(until);
  };

  const handleGo = () => {
    router.push('/goals');
  };

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        className="imb-banner"
        onClick={handleGo}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="imb-icon">
          <Wallet size={18} />
          <Sparkles size={11} className="imb-spark" />
        </div>
        <div className="imb-body">
          <p className="imb-title">
            💰 Bạn đang giữ {formatCurrencyShort(mainBalance)} nhàn rỗi
          </p>
          <p className="imb-sub">
            Đề xuất chuyển <strong>{formatCurrencyShort(suggestedAmount)}</strong> sang
            &ldquo;{targetGoal?.name}&rdquo; để tiền sinh lời
          </p>
        </div>
        <div className="imb-actions">
          <span className="imb-cta">
            <span>Phân bổ</span>
            <ArrowRight size={12} />
          </span>
          <button
            type="button"
            className="imb-dismiss"
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            aria-label="Để sau 24h"
          >
            <X size={12} />
          </button>
        </div>
      </motion.button>
    </AnimatePresence>
  );
}
