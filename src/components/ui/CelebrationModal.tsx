/* ═══ CelebrationModal — Dopamine Popup after transaction ═══ */
'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfetti } from '@/hooks/useConfetti';
import { useAudio } from '@/hooks/useAudio';
import { getButlerMessage } from '@/data/butlerMessages';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatCurrency } from '@/utils/formatCurrency';
import type { TxnType } from '@/stores/useFinanceStore';
import './CelebrationModal.css';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TxnType;
  amount: number;
  categoryName: string;
  xpEarned: number;
}

export default function CelebrationModal({
  isOpen,
  onClose,
  type,
  amount,
  categoryName,
  xpEarned,
}: CelebrationModalProps) {
  const { fireConfetti } = useConfetti();
  const { play } = useAudio();
  const butlerName = useSettingsStore((s) => s.butlerName);

  useEffect(() => {
    if (!isOpen) return;

    // Fire confetti + play sound
    fireConfetti('mission');

    if (type === 'income') {
      play('income');
    } else {
      play('missionComplete');
    }

    // Auto close after 4 seconds
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [isOpen, type, fireConfetti, play, onClose]);

  if (!isOpen) return null;

  const emoji = type === 'income' ? '💰✨' : type === 'expense' ? '📝✓' : '🔄✓';
  const title = type === 'income' ? 'Thu nhập đã ghi!' : type === 'expense' ? 'Chi tiêu đã ghi!' : 'Chuyển khoản thành công!';
  const context = type === 'income' ? 'income' : 'expense_small';
  const butlerMsg = getButlerMessage(context, butlerName);

  return (
    <AnimatePresence>
      <motion.div
        className="celebration-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        id="celebration-modal"
      >
        <div className="celebration-card" onClick={(e) => e.stopPropagation()}>
          <div className="celebration-emoji">{emoji}</div>
          <h2 className={`celebration-title ${type}`}>{title}</h2>
          <p className="celebration-amount">
            {type === 'income' ? '+' : '-'}{formatCurrency(amount)}
          </p>

          <div className="celebration-xp">
            ⚡ +{xpEarned} XP
          </div>

          <p className="celebration-butler">
            🎩 {butlerMsg.text}
          </p>

          <button className="celebration-close-btn" onClick={onClose} id="celebration-close">
            Tuyệt vời! 🎉
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
