/* ═══ useBankSyncStore — Track when user last synced with bank ═══
 *
 * Purpose: remind user to reconcile in-app balances with actual bank balance
 * to avoid drift. Persists to localStorage so reminder state survives reload.
 */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Default reminder cadence: nudge user every 7 days. */
const SYNC_REMINDER_DAYS = 7;

/** Snooze duration when user clicks "Để sau". */
const SNOOZE_HOURS = 24;

interface BankSyncState {
  /** ISO timestamp of last "I've synced" acknowledgment. Null if never. */
  lastSyncedAt: string | null;
  /** ISO timestamp until which the reminder is hidden. Null = no snooze. */
  snoozedUntil: string | null;

  /** User clicks "Tôi đã đồng bộ" — reset reminder cadence. */
  markSynced: () => void;
  /** User clicks "Để sau" — hide for SNOOZE_HOURS. */
  snooze: () => void;
  /** Computed: should the reminder banner show right now? */
  shouldShowReminder: () => boolean;
  /** Days since last sync (Infinity if never). */
  daysSinceSync: () => number;
}

function daysBetween(fromIso: string, nowIso: string): number {
  const from = new Date(fromIso).getTime();
  const now = new Date(nowIso).getTime();
  return Math.floor((now - from) / (1000 * 60 * 60 * 24));
}

export const useBankSyncStore = create<BankSyncState>()(
  persist(
    (set, get) => ({
      lastSyncedAt: null,
      snoozedUntil: null,

      markSynced: () => {
        set({
          lastSyncedAt: new Date().toISOString(),
          snoozedUntil: null,
        });
      },

      snooze: () => {
        const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000).toISOString();
        set({ snoozedUntil: until });
      },

      daysSinceSync: () => {
        const { lastSyncedAt } = get();
        if (!lastSyncedAt) return Infinity;
        return daysBetween(lastSyncedAt, new Date().toISOString());
      },

      shouldShowReminder: () => {
        const { lastSyncedAt, snoozedUntil } = get();
        const now = Date.now();

        // Still snoozed?
        if (snoozedUntil && new Date(snoozedUntil).getTime() > now) {
          return false;
        }

        // Never synced — always show.
        if (!lastSyncedAt) return true;

        // Past cadence — show.
        return daysBetween(lastSyncedAt, new Date(now).toISOString()) >= SYNC_REMINDER_DAYS;
      },
    }),
    {
      name: 'manicash-bank-sync',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
