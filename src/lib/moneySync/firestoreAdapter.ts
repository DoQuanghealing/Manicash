/* ═══ Money Sync — Firestore Adapter (Phase 6B-2A) ═══
 * Thin, mockable I/O layer. Only this file touches Firestore SDK.
 * All sync logic stays in syncService.ts (pure-ish, no direct Firestore calls).
 *
 * Path: users/{uid}/money/state  (different from legacy finance_core/state)
 */
import type { CloudMoneyDocumentV1 } from './cloudTypes';

// ─── Adapter interface ────────────────────────────────────────────────────────

export type MoneyCloudAdapter = {
  load(uid: string): Promise<CloudMoneyDocumentV1 | null>;
  save(uid: string, doc: CloudMoneyDocumentV1): Promise<void>;
};

// ─── Path helper ──────────────────────────────────────────────────────────────

function moneyDocPath(uid: string): string {
  return `users/${uid}/money/state`;
}

// ─── Firestore adapter ────────────────────────────────────────────────────────

/**
 * Tạo adapter Firestore thực. Lazy-import Firebase để:
 *  1. SSR không crash khi env thiếu.
 *  2. Test có thể dùng mock adapter thay thế.
 *
 * Throws nếu Firestore call thất bại — caller (syncService) xử lý lỗi.
 */
export function createFirestoreMoneyAdapter(): MoneyCloudAdapter {
  return {
    async load(uid: string): Promise<CloudMoneyDocumentV1 | null> {
      const { getFirebaseDB } = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      const db = getFirebaseDB();
      const ref = doc(db, moneyDocPath(uid));
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      // Basic version guard — deserializer does the full safe parse
      if (!data || data['version'] !== 'cloud_money_v1') return null;
      return data as CloudMoneyDocumentV1;
    },

    async save(uid: string, document: CloudMoneyDocumentV1): Promise<void> {
      const { getFirebaseDB } = await import('@/lib/firebase/config');
      const { doc, setDoc } = await import('firebase/firestore');
      const db = getFirebaseDB();
      const ref = doc(db, moneyDocPath(uid));
      await setDoc(ref, document);
    },
  };
}

// ─── Mock adapter (for tests) ─────────────────────────────────────────────────

/**
 * In-memory adapter cho unit tests. Không cần Firebase init.
 * Optionally pre-seed với existing doc.
 */
export function createMockMoneyAdapter(
  initial?: CloudMoneyDocumentV1 | null,
): MoneyCloudAdapter & { _store: Map<string, CloudMoneyDocumentV1> } {
  const store = new Map<string, CloudMoneyDocumentV1>();
  if (initial) store.set(initial.uid, initial);

  return {
    _store: store,
    async load(uid: string) {
      return store.get(uid) ?? null;
    },
    async save(uid: string, document: CloudMoneyDocumentV1) {
      store.set(uid, document);
    },
  };
}

/**
 * In-memory adapter cho RUNTIME (Phase 6B-2B) — production-safe placeholder
 * cho tới khi Firestore wiring thật bật. Giữ doc gần nhất theo uid trong RAM.
 * KHÔNG persist, KHÔNG network. Thay bằng createFirestoreMoneyAdapter sau.
 */
export function createInMemoryMoneyAdapter(): MoneyCloudAdapter {
  const store = new Map<string, CloudMoneyDocumentV1>();
  return {
    async load(uid: string) {
      return store.get(uid) ?? null;
    },
    async save(uid: string, document: CloudMoneyDocumentV1) {
      store.set(uid, document);
    },
  };
}

/** Mock adapter that always rejects — để test error handling. */
export function createFailingMoneyAdapter(
  errorMessage = 'adapter error',
): MoneyCloudAdapter {
  return {
    async load() {
      throw new Error(errorMessage);
    },
    async save() {
      throw new Error(errorMessage);
    },
  };
}
