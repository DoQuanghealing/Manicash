/* ═══ useMoneySyncRuntime (Phase 6B-2B) ═══
 * Bootstrap client money sync runtime: start CHỈ sau khi 5 store đã hydrate VÀ
 * có user đăng nhập. start() idempotent + tự xử lý đổi user. Stop khi unmount.
 *
 * Account boundary (logout/xóa tài khoản) do clearLocalMoneyPersistence ->
 * resetMoneySyncRuntime đảm nhiệm — hook này chỉ lo lifecycle theo auth+hydration.
 */
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydrationStore } from '@/stores/useHydrationStore';
import {
  startMoneySyncRuntime,
  stopMoneySyncRuntime,
} from '@/lib/moneySync/clientRuntime';

export function useMoneySyncRuntime(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const hydrated = useHydrationStore(
    (s) => s.finance && s.budget && s.goals && s.tasks && s.auth,
  );

  // Start/switch theo uid + hydration. start() idempotent + tự stop user cũ.
  useEffect(() => {
    if (!hydrated || !uid) return;
    startMoneySyncRuntime({ userId: uid });
  }, [uid, hydrated]);

  // Stop khi provider unmount (app teardown).
  useEffect(() => {
    return () => {
      stopMoneySyncRuntime();
    };
  }, []);
}
