'use client';

import { create } from 'zustand';
import { executeFinanceEvent } from '@/core/finance/engine';
import { getAccountBalance, getAccountBalances } from '@/core/finance/selectors';
import type {
  AccountBalances,
  AccountId,
  FinanceEvent,
  LedgerEntry,
} from '@/core/finance/types';

interface FinanceCoreState {
  ledgerEntries: LedgerEntry[];
  events: FinanceEvent[];
  lastError?: string;

  execute: (event: FinanceEvent) => void;
  executeMany: (events: FinanceEvent[]) => void;
  hydrate: (state: { ledgerEntries: LedgerEntry[]; events: FinanceEvent[] }) => void;
  getBalances: () => AccountBalances;
  getAccountBalance: (accountId: AccountId) => number;
  clear: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const useFinanceCoreStore = create<FinanceCoreState>((set, get) => ({
  ledgerEntries: [],
  events: [],
  lastError: undefined,

  execute: (event) => {
    try {
      const result = executeFinanceEvent({
        event,
        ledgerEntries: get().ledgerEntries,
      });

      set((state) => ({
        ledgerEntries: result.allLedgerEntries,
        events: [...state.events, event],
        lastError: undefined,
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      set({ lastError: message });
      throw error;
    }
  },

  executeMany: (events) => {
    try {
      let nextLedgerEntries = get().ledgerEntries;

      for (const event of events) {
        const result = executeFinanceEvent({
          event,
          ledgerEntries: nextLedgerEntries,
        });
        nextLedgerEntries = result.allLedgerEntries;
      }

      set((state) => ({
        ledgerEntries: nextLedgerEntries,
        events: [...state.events, ...events],
        lastError: undefined,
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      set({ lastError: message });
      throw error;
    }
  },

  getBalances: () => getAccountBalances(get().ledgerEntries),

  getAccountBalance: (accountId) =>
    getAccountBalance(get().ledgerEntries, accountId),

  hydrate: (state) =>
    set({
      ledgerEntries: state.ledgerEntries,
      events: state.events,
      lastError: undefined,
    }),

  clear: () =>
    set({
      ledgerEntries: [],
      events: [],
      lastError: undefined,
    }),
}));
