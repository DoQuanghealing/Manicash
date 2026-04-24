/* ═══ ThemeProvider — Syncs data-theme attribute on <html> ═══ */
'use client';

import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme === 'dark' ? '#0A0A12' : '#F5F5F7'
      );
    }
  }, [theme]);

  return <>{children}</>;
}
