'use client';

import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/useAuthStore';
import { getProStatus, isProActive, type ProStatus } from '@/lib/monetization/entitlement';

/** True when the signed-in user has an active Pro entitlement (respects kill-switch). */
export function useIsPro(): boolean {
  return useAuthStore((s) => isProActive(s.user));
}

/** Full Pro status (tier, expiry, days remaining, enforced) for the current user. */
export function useProStatus(): ProStatus {
  return useAuthStore(useShallow((s) => getProStatus(s.user)));
}
