/* ═══ Money Sync — Firestore Remote Adapter (Phase 6B-2E) ═══
 * RemoteMoneySyncAdapter thật chạy trên Firestore. Optimistic concurrency qua
 * `version` + runTransaction (compare-and-set). Path: users/{uid}/money/state.
 *
 * Thiết kế tách PORT để test được logic (getHead/pull/push + CAS + dedup) bằng
 * fake port, còn glue Firebase (lazy import) giữ mỏng — theo đúng tiền lệ của
 * firestoreAdapter (load/save). Document shape: { version, updatedAt, envelope }.
 *
 * KHÔNG bật mặc định — chỉ dùng khi isMoneySyncEnabled() (flag) bật.
 */
import type { MoneySyncEnvelopeV1 } from './syncEnvelope';
import { isMoneySyncEnvelopeV1 } from './syncEnvelope';
import type {
  RemoteMoneySyncAdapter,
  RemoteMoneyHead,
  RemotePullResult,
  RemotePushResult,
} from './remoteAdapter';

// ─── Port (Firestore primitives, injectable) ──────────────────────────────────

export type RemoteRawRecord = { version: number; envelope: MoneySyncEnvelopeV1 };

export interface RemoteFirestorePort {
  /** Đọc raw doc; null nếu chưa có / payload không hợp lệ. */
  getRaw(uid: string): Promise<RemoteRawRecord | null>;
  /** Compare-and-set nguyên tử: chỉ ghi nếu version hiện tại === expectedVersion. */
  casSet(
    uid: string,
    expectedVersion: number,
    nextVersion: number,
    envelope: MoneySyncEnvelopeV1,
  ): Promise<'ok' | 'conflict'>;
}

function emptyHead(): RemoteMoneyHead {
  return { exists: false, version: 0, snapshotHash: null, updatedAt: null };
}

function headOf(rec: RemoteRawRecord): RemoteMoneyHead {
  return {
    exists: true,
    version: rec.version,
    snapshotHash: rec.envelope.snapshotHash,
    updatedAt: rec.envelope.createdAt,
  };
}

// ─── Adapter từ port (logic test được) ────────────────────────────────────────

export function createRemoteAdapterFromPort(
  port: RemoteFirestorePort,
): RemoteMoneySyncAdapter {
  return {
    async getHead(uid: string): Promise<RemoteMoneyHead> {
      const raw = await port.getRaw(uid);
      return raw ? headOf(raw) : emptyHead();
    },

    async pull(uid: string): Promise<RemotePullResult> {
      try {
        const raw = await port.getRaw(uid);
        if (!raw) return { ok: true, exists: false };
        return { ok: true, exists: true, envelope: raw.envelope, version: raw.version };
      } catch (err) {
        return { ok: false, error: { kind: 'network', message: errMsg(err) } };
      }
    },

    async push(
      uid: string,
      envelope: MoneySyncEnvelopeV1,
      expectedBaseVersion: number,
    ): Promise<RemotePushResult> {
      try {
        const raw = await port.getRaw(uid);
        const currentVersion = raw ? raw.version : 0;

        if (expectedBaseVersion !== currentVersion) {
          return { ok: false, reason: 'conflict', remoteHead: raw ? headOf(raw) : emptyHead() };
        }
        // Dedup: cùng snapshotHash → no-op (version giữ nguyên).
        if (raw && raw.envelope.snapshotHash === envelope.snapshotHash) {
          return { ok: true, version: currentVersion, head: headOf(raw), deduped: true };
        }

        const nextVersion = currentVersion + 1;
        const stamped: MoneySyncEnvelopeV1 = { ...envelope, baseVersion: nextVersion };
        const res = await port.casSet(uid, currentVersion, nextVersion, stamped);
        if (res === 'conflict') {
          const after = await port.getRaw(uid);
          return { ok: false, reason: 'conflict', remoteHead: after ? headOf(after) : emptyHead() };
        }
        return { ok: true, version: nextVersion, head: headOf({ version: nextVersion, envelope: stamped }), deduped: false };
      } catch (err) {
        return { ok: false, reason: 'error', error: { kind: 'network', message: errMsg(err) } };
      }
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Real Firebase port (glue mỏng, lazy import) ──────────────────────────────

const MONEY_DOC = (uid: string) => `users/${uid}/money/state`;

function createFirebaseRemotePort(): RemoteFirestorePort {
  return {
    async getRaw(uid: string): Promise<RemoteRawRecord | null> {
      const { getFirebaseDB } = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      const ref = doc(getFirebaseDB(), MONEY_DOC(uid));
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() as { version?: number; envelope?: unknown } | undefined;
      if (!data || !isMoneySyncEnvelopeV1(data.envelope)) return null;
      return { version: typeof data.version === 'number' ? data.version : 0, envelope: data.envelope };
    },

    async casSet(uid, expectedVersion, nextVersion, envelope): Promise<'ok' | 'conflict'> {
      const { getFirebaseDB } = await import('@/lib/firebase/config');
      const { doc, runTransaction } = await import('firebase/firestore');
      const db = getFirebaseDB();
      const ref = doc(db, MONEY_DOC(uid));
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists() ? ((snap.data() as { version?: number }).version ?? 0) : 0;
        if (cur !== expectedVersion) return 'conflict';
        tx.set(ref, { version: nextVersion, updatedAt: envelope.createdAt, envelope });
        return 'ok' as const;
      });
    },
  };
}

/** Adapter Firestore thật. CHỈ dùng khi flag bật. */
export function createFirestoreRemoteAdapter(): RemoteMoneySyncAdapter {
  return createRemoteAdapterFromPort(createFirebaseRemotePort());
}
