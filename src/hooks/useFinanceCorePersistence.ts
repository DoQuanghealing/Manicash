'use client';

import { useEffect } from 'react';
import {
  loadFinanceCoreState,
  saveFinanceCoreState,
} from '@/lib/firebase/financeCorePersistence';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceCoreStore } from '@/stores/useFinanceCoreStore';

const SAVE_DEBOUNCE_MS = 500;

function isPersistableUid(uid: string | undefined): uid is string {
  return Boolean(uid && uid.trim().length > 0 && uid !== 'local_user');
}

function warnInDevelopment(message: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(message, error);
  }
}

export function useFinanceCorePersistence(): void {
  const uid = useAuthStore((state) => state.user?.uid);

  useEffect(() => {
    if (!isPersistableUid(uid)) return;

    let isCancelled = false;
    let saveTimeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const clearSaveTimeout = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = undefined;
      }
    };

    const startPersistence = async () => {
      try {
        const persistedState = await loadFinanceCoreState(uid);
        if (isCancelled) return;

        if (persistedState) {
          useFinanceCoreStore.getState().hydrate(persistedState);
        }
      } catch (error) {
        warnInDevelopment('[finance-core] hydrate failed:', error);
      }

      if (isCancelled) return;

      unsubscribe = useFinanceCoreStore.subscribe((state, previousState) => {
        const ledgerChanged = state.ledgerEntries !== previousState.ledgerEntries;
        const eventsChanged = state.events !== previousState.events;

        if (!ledgerChanged && !eventsChanged) return;

        clearSaveTimeout();
        saveTimeout = setTimeout(() => {
          void saveFinanceCoreState(uid, {
            ledgerEntries: state.ledgerEntries,
            events: state.events,
          }).catch((error) => {
            warnInDevelopment('[finance-core] save failed:', error);
          });
        }, SAVE_DEBOUNCE_MS);
      });
    };

    void startPersistence();

    return () => {
      isCancelled = true;
      clearSaveTimeout();
      unsubscribe?.();
    };
  }, [uid]);
}
