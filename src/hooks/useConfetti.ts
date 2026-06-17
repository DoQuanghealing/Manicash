/* ═══ Confetti Celebration — Constrained to mobile shell ═══
 *
 * canvas-confetti mặc định gắn canvas vào document.body (toàn viewport).
 * Trên desktop view (mobile-shell có max-width 430px ở giữa), pháo hoa
 * rơi ngoài khung phone → xấu.
 *
 * Fix: tạo custom canvas đặt INSIDE .mobile-shell với position: absolute,
 * dùng confetti.create() để bind vào canvas đó. Particle chỉ rơi trong shell.
 */
'use client';

import { useCallback } from 'react';
import confetti from 'canvas-confetti';

type CreatedConfetti = ReturnType<typeof confetti.create>;

let cachedConfetti: CreatedConfetti | null = null;
let cachedCanvas: HTMLCanvasElement | null = null;

/** Lấy / tạo canvas confetti gắn vào .mobile-shell. */
function getShellConfetti(): CreatedConfetti {
  if (cachedConfetti && cachedCanvas && document.body.contains(cachedCanvas)) {
    return cachedConfetti;
  }
  // Tạo mới
  const shell = document.querySelector('.mobile-shell') as HTMLElement | null;
  const host = shell || document.body;
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '250';
  // Đảm bảo host có position để canvas absolute nằm bên trong
  if (host !== document.body && getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }
  host.appendChild(canvas);

  const instance = confetti.create(canvas, {
    resize: true,
    useWorker: true,
  });
  cachedConfetti = instance;
  cachedCanvas = canvas;
  return instance;
}

export function useConfetti() {
  const fireConfetti = useCallback((type: 'rankUp' | 'mission' | 'streak' = 'mission') => {
    const fc = getShellConfetti();

    const configs: Record<typeof type, () => void> = {
      rankUp: () => {
        // Big celebration: 3 bursts từ 2 góc dưới
        const duration = 3000;
        const end = Date.now() + duration;

        const interval = setInterval(() => {
          if (Date.now() > end) {
            clearInterval(interval);
            return;
          }

          fc({
            particleCount: 50,
            angle: 60,
            spread: 70,
            origin: { x: 0.05, y: 0.85 },
            colors: ['#7C3AED', '#A78BFA', '#F97316', '#22C55E', '#FDBA74', '#67E8F9'],
            ticks: 200,
            gravity: 1.2,
            decay: 0.92,
            startVelocity: 30,
          });

          fc({
            particleCount: 50,
            angle: 120,
            spread: 70,
            origin: { x: 0.95, y: 0.85 },
            colors: ['#7C3AED', '#A78BFA', '#F97316', '#22C55E', '#FDBA74', '#67E8F9'],
            ticks: 200,
            gravity: 1.2,
            decay: 0.92,
            startVelocity: 30,
          });
        }, 250);
      },

      mission: () => {
        // Burst nhẹ từ giữa
        fc({
          particleCount: 35,
          spread: 55,
          origin: { x: 0.5, y: 0.6 },
          colors: ['#7C3AED', '#F97316', '#22C55E', '#A78BFA'],
          ticks: 120,
          gravity: 1.5,
          startVelocity: 22,
          scalar: 0.85,
        });
      },

      streak: () => {
        // Stars vàng
        fc({
          particleCount: 30,
          spread: 55,
          origin: { x: 0.5, y: 0.55 },
          colors: ['#F59E0B', '#F97316', '#FCD34D'],
          shapes: ['star'],
          ticks: 90,
          startVelocity: 18,
          scalar: 0.85,
        });
      },
    };

    configs[type]();
  }, []);

  return { fireConfetti };
}
