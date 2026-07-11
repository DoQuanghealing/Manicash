/* ═══ useSettingsStore — Theme + Butler Name + App Vibe (persisted) ═══ */
import { create } from 'zustand';
import type { VibeMode } from '@/lib/ageGroup';

export type ThemeMode = 'dark' | 'light';

/** Cấp độ quản gia:
 * 'basic' = dùng cho vui (không ghi dữ liệu) ·
 * 'wise' = hỗ trợ sâu + cá nhân hoá (bật analyticsConsent) ·
 * 'sovereign' = Phú Vương: đồng hành sâu + chủ động đề xuất (bật sovereignConsent). */
export type ButlerTier = 'basic' | 'wise' | 'sovereign';

interface SettingsState {
  theme: ThemeMode;
  butlerName: string;
  /** Cách quản gia gọi chủ nhân: 'cô' | 'cậu' | 'tổng tài' | tự đặt. '' = chưa chọn. */
  honorific: string;
  /** Cấp độ quản gia (xem ButlerTier). */
  butlerTier: ButlerTier;
  /** Đã hoàn tất màn làm quen quản gia chưa. */
  butlerOnboarded: boolean;
  /** Phong cách text/tone — 'auto' detect từ yearOfBirth, hoặc override 'young'/'pro'/'classic'. */
  appVibe: VibeMode;
  /** Bật nhắc tự động "Tổng kết tối" 21h mỗi ngày (Web Notification). */
  dailyReminderEnabled: boolean;
  /** Che số dư khả dụng trên Tổng quan (mặc định che; nhớ lựa chọn qua nút mắt). */
  hideBalance: boolean;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setButlerName: (name: string) => void;
  setHonorific: (h: string) => void;
  setButlerTier: (t: ButlerTier) => void;
  setButlerOnboarded: (v: boolean) => void;
  setAppVibe: (vibe: VibeMode) => void;
  toggleDailyReminder: () => void;
  setDailyReminderEnabled: (enabled: boolean) => void;
  toggleHideBalance: () => void;
}

const DEFAULT_BUTLER_NAME = 'Lord Diamond';
const DEFAULT_APP_VIBE: VibeMode = 'auto';

/* ── Safely read from localStorage (SSR-safe) ── */
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: readStorage<ThemeMode>('manicash-theme', 'dark'),
  butlerName: readStorage<string>('manicash-butler-name', DEFAULT_BUTLER_NAME),
  honorific: readStorage<string>('manicash-honorific', ''),
  butlerTier: readStorage<ButlerTier>('manicash-butler-tier', 'basic'),
  butlerOnboarded: readStorage<boolean>('manicash-butler-onboarded', false),
  appVibe: readStorage<VibeMode>('manicash-app-vibe', DEFAULT_APP_VIBE),
  dailyReminderEnabled: readStorage<boolean>('manicash-daily-reminder', false),
  hideBalance: readStorage<boolean>('manicash-hide-balance', true),

  setTheme: (t) => {
    writeStorage('manicash-theme', t);
    set({ theme: t });
  },

  toggleTheme: () =>
    set((s) => {
      const next: ThemeMode = s.theme === 'dark' ? 'light' : 'dark';
      writeStorage('manicash-theme', next);
      return { theme: next };
    }),

  setButlerName: (name) => {
    const trimmed = name.trim() || DEFAULT_BUTLER_NAME;
    writeStorage('manicash-butler-name', trimmed);
    set({ butlerName: trimmed });
  },

  setHonorific: (h) => {
    const trimmed = h.trim().slice(0, 20);
    writeStorage('manicash-honorific', trimmed);
    set({ honorific: trimmed });
  },

  setButlerTier: (t) => {
    writeStorage('manicash-butler-tier', t);
    set({ butlerTier: t });
  },

  setButlerOnboarded: (v) => {
    writeStorage('manicash-butler-onboarded', v);
    set({ butlerOnboarded: v });
  },

  setAppVibe: (vibe) => {
    writeStorage('manicash-app-vibe', vibe);
    set({ appVibe: vibe });
  },

  toggleDailyReminder: () =>
    set((s) => {
      const next = !s.dailyReminderEnabled;
      writeStorage('manicash-daily-reminder', next);
      return { dailyReminderEnabled: next };
    }),

  setDailyReminderEnabled: (enabled) => {
    writeStorage('manicash-daily-reminder', enabled);
    set({ dailyReminderEnabled: enabled });
  },

  toggleHideBalance: () =>
    set((s) => {
      const next = !s.hideBalance;
      writeStorage('manicash-hide-balance', next);
      return { hideBalance: next };
    }),
}));
