/* ═══ BanMenhThemeApplier — Apply CSS variables theo bản mệnh ═══
 *
 * Khi activeTheme = 'theme-banmenh' AND user có yearOfBirth → đổi accent
 * color theo ngũ hành của user. Khi activeTheme khác → revert default.
 *
 * Map ngũ hành → accent color:
 *   Kim  → vàng (gold) — phú quý
 *   Mộc  → xanh lá đậm — sinh sôi
 *   Thủy → xanh dương — dòng tiền
 *   Hỏa  → đỏ cam — đam mê
 *   Thổ  → vàng đất — vững chãi
 *
 * Theme khác (theme-tet-2026, theme-luxury, ...) cũng được apply ở đây
 * để tập trung logic một chỗ.
 */
'use client';

import { useEffect } from 'react';
import { useRewardStore } from '@/stores/useRewardStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getBanMenh, type Menh } from '@/lib/banMenh';

/** Map mệnh → accent palette. */
const MENH_PALETTE: Record<Menh, {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  gradient: string;
}> = {
  Kim: {
    primary: '#C9A961',
    primaryLight: '#E8C97A',
    primaryDark: '#8B7340',
    gradient: 'linear-gradient(135deg, #C9A961, #F5F5F7)',
  },
  Mộc: {
    primary: '#16A34A',
    primaryLight: '#4ADE80',
    primaryDark: '#15803D',
    gradient: 'linear-gradient(135deg, #16A34A, #0EA5E9)',
  },
  Thủy: {
    primary: '#0EA5E9',
    primaryLight: '#38BDF8',
    primaryDark: '#0369A1',
    gradient: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
  },
  Hỏa: {
    primary: '#DC2626',
    primaryLight: '#F87171',
    primaryDark: '#991B1B',
    gradient: 'linear-gradient(135deg, #DC2626, #F97316)',
  },
  Thổ: {
    primary: '#A16207',
    primaryLight: '#EAB308',
    primaryDark: '#713F12',
    gradient: 'linear-gradient(135deg, #A16207, #EAB308)',
  },
};

/** Default purple palette (khi không apply banmenh hoặc theme khác). */
const DEFAULT_PALETTE = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  gradient: 'linear-gradient(135deg, #7C3AED, #F97316)',
};

/** Static theme palettes (cho theme-tet-2026, theme-luxury, ...) */
const STATIC_THEME_PALETTE: Record<string, typeof DEFAULT_PALETTE> = {
  'theme-tet-2026': {
    primary: '#DC2626',
    primaryLight: '#FCA5A5',
    primaryDark: '#7F1D1D',
    gradient: 'linear-gradient(135deg, #DC2626, #EAB308)',
  },
  'theme-luxury': {
    primary: '#EAB308',
    primaryLight: '#FDE047',
    primaryDark: '#A16207',
    gradient: 'linear-gradient(135deg, #1E1B2E, #EAB308)',
  },
  'theme-emerald': {
    primary: '#059669',
    primaryLight: '#34D399',
    primaryDark: '#064E3B',
    gradient: 'linear-gradient(135deg, #059669, #0EA5E9)',
  },
};

export default function BanMenhThemeApplier() {
  const activeTheme = useRewardStore((s) => s.activeTheme);
  const yearOfBirth = useAuthStore((s) => s.user?.yearOfBirth);

  useEffect(() => {
    const root = document.documentElement;
    let palette = DEFAULT_PALETTE;

    if (activeTheme === 'theme-banmenh' && yearOfBirth) {
      const banMenh = getBanMenh(yearOfBirth);
      if (banMenh) {
        palette = MENH_PALETTE[banMenh.menh];
      }
    } else if (STATIC_THEME_PALETTE[activeTheme]) {
      palette = STATIC_THEME_PALETTE[activeTheme];
    }

    root.style.setProperty('--c-purple', palette.primary);
    root.style.setProperty('--c-purple-light', palette.primaryLight);
    root.style.setProperty('--c-purple-dark', palette.primaryDark);
    root.style.setProperty('--gradient-primary', palette.gradient);

    // Cleanup khi unmount
    return () => {
      root.style.removeProperty('--c-purple');
      root.style.removeProperty('--c-purple-light');
      root.style.removeProperty('--c-purple-dark');
      root.style.removeProperty('--gradient-primary');
    };
  }, [activeTheme, yearOfBirth]);

  return null;
}
