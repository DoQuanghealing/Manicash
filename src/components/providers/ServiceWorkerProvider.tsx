'use client';

/**
 * ServiceWorkerProvider — registers /sw.js in production builds only.
 * Must be a Client Component; renders nothing in the DOM.
 */

import { useEffect } from 'react';

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Ngoài production: gỡ sạch SW + cache còn sót lại. Nếu từng chạy
    // `npm run build && npm start` trên cùng origin (vd localhost:3000), SW đó
    // vẫn sống và sẽ phục vụ asset cũ cho `npm run dev` → nhìn thấy giao diện cũ.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Optional: log or trigger background sync here
        registration.update();
      })
      .catch(() => {
        // SW registration failure is non-fatal — app works without it
      });
  }, []);

  return null;
}
