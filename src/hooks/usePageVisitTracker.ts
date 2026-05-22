/* ═══ usePageVisitTracker — Record visit khi mount ═══
 *
 * Dùng trong page component:
 *   usePageVisitTracker('ledger');
 */
'use client';

import { useEffect } from 'react';
import { usePageVisitStore, type TrackedPage } from '@/stores/usePageVisitStore';

export function usePageVisitTracker(page: TrackedPage) {
  useEffect(() => {
    usePageVisitStore.getState().recordVisit(page);
  }, [page]);
}
