/* ═══ Audio Store ═══ */
'use client';

import { create } from 'zustand';

interface AudioStore {
  enabled: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (v: number) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  enabled: true,
  volume: 0.6,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setVolume: (volume) => set({ volume }),
}));
