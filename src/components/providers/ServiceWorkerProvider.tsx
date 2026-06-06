'use client';

/**
 * ServiceWorkerProvider — registers /sw.js in production builds only.
 * Must be a Client Component; renders nothing in the DOM.
 */

import { useEffect } from 'react';

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
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
