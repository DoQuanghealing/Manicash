/* ═══ useSettingsStore — Theme + Butler Name (persisted) ═══ */
import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

interface SettingsState {
  theme: ThemeMode;
  butlerName: string;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setButlerName: (name: string) => void;
}

const DEFAULT_BUTLER_NAME = 'Lord Diamond';

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
}));
