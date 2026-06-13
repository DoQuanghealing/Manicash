/* ═══ useMoneySyncRuntime (Phase 6B-2B → 6B-2E) ═══
 * Bootstrap client money sync runtime: start CHỈ sau khi 5 store đã hydrate VÀ
 * có user đăng nhập. start() idempotent + tự xử lý đổi user. Stop khi unmount.
 *
 * Phase 6B-2E: nếu flag isMoneySyncEnabled() bật → cũng start production sync
 * controller (pull-on-login + debounced push + reconnect) với Firestore adapter
 * thật. MẶC ĐỊNH TẮT → hành vi y hệt 6B-2B (chỉ outbox in-memory, không network).
 *
 * Account boundary (logout/xóa tài khoản) do clearLocalMoneyPersistence ->
 * resetMoneySyncRuntime + clearAllSyncCursors đảm nhiệm.
 */
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHydrationStore } from '@/stores/useHydrationStore';
import {
  startMoneySyncRuntime,
  stopMoneySyncRuntime,
} from '@/lib/moneySync/clientRuntime';
import { isMoneySyncEnabled } from '@/lib/moneySync/moneySyncFlags';
import {
  startProductionSync,
  stopProductionSync,
} from '@/lib/moneySync/syncController';
import { createFirestoreRemoteAdapter } from '@/lib/moneySync/firestoreRemoteAdapter';

export function useMoneySyncRuntime(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const hydrated = useHydrationStore(
    (s) => s.finance && s.budget && s.goals && s.tasks && s.auth,
  );

  // Start/switch theo uid + hydration. start() idempotent + tự stop user cũ.
  useEffect(() => {
    if (!hydrated || !uid) return;
    startMoneySyncRuntime({ userId: uid });
    // Production cloud sync — CHỈ khi flag bật (mặc định tắt → no-op).
    if (isMoneySyncEnabled()) {
      startProductionSync(createFirestoreRemoteAdapter());
    }
    return () => {
      stopProductionSync();
    };
  }, [uid, hydrated]);

  // Stop khi provider unmount (app teardown).
  useEffect(() => {
    return () => {
      stopProductionSync();
      stopMoneySyncRuntime();
    };
  }, []);
}
