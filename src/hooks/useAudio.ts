/* ═══ useAudio — Howler.js sound effect controller ═══ */
'use client';

import { useCallback, useRef } from 'react';
import { Howl } from 'howler';
import { useAudioStore } from '@/stores/useAudioStore';

type SoundKey =
  | 'income'
  | 'expense'
  | 'missionComplete'
  | 'levelUp'
  | 'resist'
  | 'breath';

const SOUND_MAP: Record<SoundKey, { src: string; volume: number }> = {
  income:          { src: '/sounds/coin-clink.mp3',       volume: 0.6 },
  expense:         { src: '/sounds/swoosh-out.mp3',       volume: 0.4 },
  missionComplete: { src: '/sounds/mission-complete.mp3', volume: 0.8 },
  levelUp:         { src: '/sounds/level-up.mp3',         volume: 0.8 },
  resist:          { src: '/sounds/resist-ding.mp3',      volume: 0.6 },
  breath:          { src: '/sounds/breath-bell.mp3',      volume: 0.3 },
};

export function useAudio() {
  const { enabled } = useAudioStore();
  const soundCache = useRef<Map<SoundKey, Howl>>(new Map());

  const getSound = useCallback((key: SoundKey): Howl => {
    if (!soundCache.current.has(key)) {
      const config = SOUND_MAP[key];
      soundCache.current.set(
        key,
        new Howl({ src: [config.src], volume: config.volume, preload: true })
      );
    }
    return soundCache.current.get(key)!;
  }, []);

  const play = useCallback(
    (key: SoundKey) => {
      if (!enabled) return;
      try {
        const sound = getSound(key);
        sound.play();
      } catch {
        // Silently fail if audio not available
      }
    },
    [enabled, getSound]
  );

  const stop = useCallback(
    (key: SoundKey) => {
      const sound = soundCache.current.get(key);
      if (sound) sound.stop();
    },
    []
  );

  return { play, stop };
}
