/* ═══ SquashCritter — minigame "đập" 0đ (Care Companion) ═══
 * Con vật (gián/muỗi/tên Lười) chạy ngang; chạm để đập. Đủ số chạm → onDone().
 * Thuần client (framer-motion), KHÔNG asset ngoài, KHÔNG đổi tiền — chỉ animation.
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CareMinigame } from '@/lib/aiMoneyChat/care/careScripts';

const CRITTER: Record<Exclude<CareMinigame, null>, { emoji: string; taps: number; cta: string; splat: string }> = {
  'squash-roach':    { emoji: '🪳', taps: 1, cta: 'Đập tên sở khanh!', splat: '🩴💥' },
  'squash-mosquito': { emoji: '🦟', taps: 1, cta: 'Đập con muỗi!',      splat: '💥' },
  'squash-lazy':     { emoji: '😴', taps: 3, cta: 'Đập tên Lười Biếng!', splat: '📜💥' },
};

interface SquashCritterProps {
  kind: Exclude<CareMinigame, null>;
  onDone: () => void;
}

export default function SquashCritter({ kind, onDone }: SquashCritterProps) {
  const cfg = CRITTER[kind];
  const [hits, setHits] = useState(0);
  const [splatting, setSplatting] = useState(false);

  const done = hits >= cfg.taps;

  function hit() {
    if (done || splatting) return;
    const next = hits + 1;
    setHits(next);
    if (next >= cfg.taps) {
      setSplatting(true);
      // Cho splat hiện một nhịp rồi trả kết quả.
      setTimeout(onDone, 650);
    }
  }

  return (
    <div className="squash-arena" aria-label={cfg.cta}>
      <AnimatePresence mode="wait">
        {splatting ? (
          <motion.div
            key="splat"
            className="squash-splat"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          >
            {cfg.splat}
          </motion.div>
        ) : (
          <motion.button
            key="critter"
            type="button"
            className="squash-critter"
            onClick={hit}
            aria-label={cfg.cta}
            initial={{ x: '-40%' }}
            animate={{ x: ['-40%', '40%', '-40%'], rotate: [0, 12, -12, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            whileTap={{ scale: 0.7 }}
          >
            {cfg.emoji}
          </motion.button>
        )}
      </AnimatePresence>
      <div className="squash-hint">
        {done ? 'Xong! 🎉' : cfg.taps > 1 ? `${cfg.cta} (${hits}/${cfg.taps})` : cfg.cta}
      </div>
    </div>
  );
}
