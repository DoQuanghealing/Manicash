/* ═══ useIncomeCelebration — Fire confetti + sound on income events ═══ */
'use client';

import { useCallback } from 'react';

/**
 * Call fireConfetti() when an income task is completed or money
 * is added to the Income wallet.
 */
export function useIncomeCelebration() {
  const fireConfetti = useCallback(async () => {
    try {
      const confetti = (await import('canvas-confetti')).default;
      // Gold + green burst — "money" vibe
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#22C55E', '#10B981', '#F59E0B', '#7C3AED'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { y: 0.4, x: 0.6 },
          colors: ['#FFD700', '#22C55E'],
        });
      }, 300);
    } catch {
      /* canvas-confetti not available */
    }
  }, []);

  return { fireConfetti };
}
