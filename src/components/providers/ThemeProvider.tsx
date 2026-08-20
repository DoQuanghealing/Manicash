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
        '#FFFFFF'
      );
    }
  }, [theme]);

  return <>{children}</>;
}
