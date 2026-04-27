/* ═══ usePendingTransactions — Realtime sync pending tx từ Firestore ═══
 *
 * Subscribe `users/{uid}/pending_transactions` ordered by createdAt desc.
 * Expose actions: confirm (with optional edits), reject.
 *
 * Demo mode (uid không có hoặc Firebase chưa setup): subscription fail silent,
 * pending = []. UI sẽ không hiển thị banner.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { getFirebaseDB } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinanceStore, type WalletType } from '@/stores/useFinanceStore';
import type { PendingTransaction } from '@/types/webhook';

export interface ConfirmEdits {
  categoryId?: string;
  note?: string;
  wallet?: WalletType;
}

export interface UsePendingTransactionsReturn {
  pending: PendingTransaction[];
  isLoading: boolean;
  error: string | null;
  /** Confirm — accept edits override category/note/wallet. */
  confirm: (id: string, edits?: ConfirmEdits) => Promise<void>;
  /** Reject — xoá pending, không tạo transaction. Không penalty XP. */
  reject: (id: string) => Promise<void>;
}

export function usePendingTransactions(): UsePendingTransactionsReturn {
  const uid = useAuthStore((s) => s.user?.uid);
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [snapshotUid, setSnapshotUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    const db = getFirebaseDB();
    const q = query(
      collection(db, 'users', uid, 'pending_transactions'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: PendingTransaction[] = [];
        snap.forEach((d) => {
          items.push({ ...(d.data() as PendingTransaction), id: d.id });
        });
        setSnapshotUid(uid);
        setPending(items);
        setIsLoading(false);
        setError(null);
      },
      (e) => {
        console.error('[pending-tx] snapshot error:', e);
        setSnapshotUid(uid);
        setError(e.message);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [uid]);

  const removeDoc = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDoc(doc(getFirebaseDB(), 'users', uid, 'pending_transactions', id));
    },
    [uid],
  );

  const confirm = useCallback(
    async (id: string, edits: ConfirmEdits = {}) => {
      if (!uid) return;
      const item = pending.find((p) => p.id === id);
      if (!item) return;

      // Add transaction qua finance store. Side-effect: updateStreak fire trong addTransaction.
      useFinanceStore.getState().addTransaction({
        type: item.type,
        amount: item.amount,
        categoryId: edits.categoryId ?? item.predictedCategoryId ?? 'other',
        note: edits.note ?? item.description,
        wallet: edits.wallet ?? 'main',
      });

      // WEBHOOK_CONFIRMED — Decision #1: +10 fixed analytics tag.
      // Replace regular log XP — không grant INCOME/EXPENSE_LOGGED ở flow này.
      useAuthStore.getState().awardXP({ type: 'WEBHOOK_CONFIRMED' });

      try {
        await removeDoc(id);
      } catch (e) {
        console.error('[pending-tx] confirm delete failed:', e);
        setError('Đã thêm vào sổ nhưng xoá pending fail. Reload sẽ tự dọn.');
      }
    },
    [uid, pending, removeDoc],
  );

  const reject = useCallback(
    async (id: string) => {
      try {
        await removeDoc(id);
      } catch (e) {
        console.error('[pending-tx] reject delete failed:', e);
        setError('Không xoá được pending. Thử lại.');
      }
    },
    [removeDoc],
  );

  const isCurrentUserSnapshot = Boolean(uid && snapshotUid === uid);

  return {
    pending: isCurrentUserSnapshot ? pending : [],
    isLoading: isCurrentUserSnapshot ? isLoading : false,
    error: isCurrentUserSnapshot ? error : null,
    confirm,
    reject,
  };
}
