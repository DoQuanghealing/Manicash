/* ═══ RankUpCelebration — Fullscreen rank-up overlay ═══ */
'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RankDefinition } from '@/types/gamification';
import './RankUpCelebration.css';

interface RankUpCelebrationProps {
  isVisible: boolean;
  rank: RankDefinition | null;
  onDone: () => void;
}

export default function RankUpCelebration({ isVisible, rank, onDone }: RankUpCelebrationProps) {
  const fireConfetti = useCallback(async () => {
    try {
      const confetti = (await import('canvas-confetti')).default;
      // Big burst
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 }, colors: [rank?.gradientFrom || '#7C3AED', rank?.gradientTo || '#A78BFA', '#FFD700'] });
      setTimeout(() => {
        confetti({ particleCount: 60, spread: 120, origin: { y: 0.4 } });
      }, 400);
    } catch { /* ok */ }
  }, [rank]);

  useEffect(() => {
    if (isVisible && rank) {
      fireConfetti();
      const timer = setTimeout(onDone, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, rank, fireConfetti, onDone]);

  if (!rank) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div className="ruc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
          <motion.div
            className="ruc-content"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <motion.div
              className="ruc-badge"
              style={{ background: `linear-gradient(135deg, ${rank.gradientFrom}, ${rank.gradientTo})` }}
              animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: 2 }}
            >
              <span className="ruc-badge-icon">{rank.icon}</span>
            </motion.div>
            <p className="ruc-label">THĂNG HẠNG!</p>
            <h2 className="ruc-name" style={{ color: rank.gradientTo }}>{rank.name}</h2>
            <p className="ruc-encourage">{rank.encouragement}</p>
            <p className="ruc-perk">🎁 {rank.perkDescription}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
