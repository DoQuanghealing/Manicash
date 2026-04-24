/* ═══ Confetti Celebration — Rank Up & Achievements ═══ */
'use client';

import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const fireConfetti = useCallback((type: 'rankUp' | 'mission' | 'streak' = 'mission') => {
    const configs: Record<typeof type, () => void> = {
      rankUp: () => {
        // Big celebration: 3 bursts from multiple angles
        const duration = 3000;
        const end = Date.now() + duration;

        const interval = setInterval(() => {
          if (Date.now() > end) {
            clearInterval(interval);
            return;
          }

          confetti({
            particleCount: 60,
            angle: 60,
            spread: 80,
            origin: { x: 0, y: 0.7 },
            colors: ['#7C3AED', '#A78BFA', '#F97316', '#22C55E', '#FDBA74', '#67E8F9'],
            ticks: 200,
            gravity: 1.2,
            decay: 0.92,
            startVelocity: 35,
          });

          confetti({
            particleCount: 60,
            angle: 120,
            spread: 80,
            origin: { x: 1, y: 0.7 },
            colors: ['#7C3AED', '#A78BFA', '#F97316', '#22C55E', '#FDBA74', '#67E8F9'],
            ticks: 200,
            gravity: 1.2,
            decay: 0.92,
            startVelocity: 35,
          });
        }, 250);
      },

      mission: () => {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#7C3AED', '#F97316', '#22C55E'],
          ticks: 150,
          gravity: 1.5,
          startVelocity: 30,
        });
      },

      streak: () => {
        // Stars + emojis
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.5 },
          colors: ['#F59E0B', '#F97316', '#FCD34D'],
          shapes: ['star'],
          ticks: 100,
          startVelocity: 25,
        });
      },
    };

    configs[type]();
  }, []);

  return { fireConfetti };
}
