/* ═══ MilestoneCelebration — Confetti + animation on milestone complete ═══ */
'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './MilestoneCelebration.css';

interface MilestoneCelebrationProps {
  isVisible: boolean;
  milestoneName: string;
  onDone: () => void;
}

export default function MilestoneCelebration({ isVisible, milestoneName, onDone }: MilestoneCelebrationProps) {
  const fireConfetti = useCallback(async () => {
    try {
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#7C3AED', '#22C55E', '#F97316', '#3B82F6'] });
      setTimeout(() => {
        confetti({ particleCount: 40, spread: 100, origin: { y: 0.5 } });
      }, 300);
    } catch { /* confetti not available */ }
  }, []);

  useEffect(() => {
    if (isVisible) {
      fireConfetti();
      const timer = setTimeout(onDone, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, fireConfetti, onDone]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="msc-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          <motion.div
            className="msc-content"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span className="msc-emoji">🎉</span>
            <h2 className="msc-title">Mốc hoàn thành!</h2>
            <p className="msc-name">{milestoneName}</p>
            <p className="msc-sub">Tiếp tục cố gắng nhé! 🔥</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
