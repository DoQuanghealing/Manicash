/* ═══ Money Sync — Fake Remote Adapter (Phase 6B-2C) ═══
 * In-memory cloud giả lập, account-scoped theo userId. Dùng cho test runtime +
 * service. KHÔNG network, KHÔNG persist, KHÔNG Firebase. Mô phỏng version bump,
 * dedup, optimistic-concurrency conflict, và lỗi network/permission/conflict.
 *
 * Lỗi tiêm theo kiểu one-shot (fail lần tới rồi tự hết) → test retry-success
 * không cần reset thủ công.
 */
import type { MoneySyncEnvelopeV1 } from './syncEnvelope';
import type {
  RemoteMoneySyncAdapter,
  RemoteMoneyHead,
  RemotePullResult,
  RemotePushResult,
  RemoteSyncErrorKind,
} from './remoteAdapter';

type RemoteRecord = { version: number; envelope: MoneySyncEnvelopeV1 };

type FailOp = 'getHead' | 'pull' | 'push';

export type FakeRemoteAdapter = RemoteMoneySyncAdapter & {
  /** Tiêm lỗi one-shot cho op kế tiếp. */
  _failNext: (op: FailOp, kind: RemoteSyncErrorKind) => void;
  /** Set thẳng remote state cho user (mô phỏng remote-newer / other device). */
  _setRemote: (userId: string, envelope: MoneySyncEnvelopeV1, version: number) => void;
  /** Đọc raw store (debug/test). */
  _peek: (userId: string) => RemoteRecord | null;
  /** Số user có remote state (kiểm tra isolation). */
  _userCount: () => number;
};

function emptyHead(): RemoteMoneyHead {
  return { exists: false, version: 0, snapshotHash: null, updatedAt: null };
}

function headOf(rec: RemoteRecord): RemoteMoneyHead {
  return {
    exists: true,
    version: rec.version,
    snapshotHash: rec.envelope.snapshotHash,
    updatedAt: rec.envelope.createdAt,
  };
}

export function createFakeRemoteAdapter(opts?: {
  seed?: Record<string, RemoteRecord>;
}): FakeRemoteAdapter {
  const store = new Map<string, RemoteRecord>();
  if (opts?.seed) {
    for (const [uid, rec] of Object.entries(opts.seed)) store.set(uid, { ...rec });
  }
  // one-shot failures: op -> kind queue
  const pending: Record<FailOp, RemoteSyncErrorKind[]> = {
    getHead: [],
    pull: [],
    push: [],
  };

  function takeFailure(op: FailOp): RemoteSyncErrorKind | null {
    return pending[op].length > 0 ? pending[op].shift()! : null;
  }

  /** getHead chỉ có kênh lỗi là throw — gắn kèm kind để service đọc được. */
  function headError(op: FailOp, kind: RemoteSyncErrorKind): Error {
    const err = new Error(`fake-remote ${op} ${kind}`) as Error & { kind: RemoteSyncErrorKind };
    err.kind = kind;
    return err;
  }

  return {
    async getHead(userId: string): Promise<RemoteMoneyHead> {
      const fail = takeFailure('getHead');
      if (fail) throw headError('getHead', fail);
      const rec = store.get(userId);
      return rec ? headOf(rec) : emptyHead();
    },

    async pull(userId: string): Promise<RemotePullResult> {
      const fail = takeFailure('pull');
      if (fail) {
        return { ok: false, error: { kind: fail, message: `fake-remote pull ${fail}` } };
      }
      const rec = store.get(userId);
      if (!rec) return { ok: true, exists: false };
      return { ok: true, exists: true, envelope: rec.envelope, version: rec.version };
    },

    async push(
      userId: string,
      envelope: MoneySyncEnvelopeV1,
      expectedBaseVersion: number,
    ): Promise<RemotePushResult> {
      const fail = takeFailure('push');
      if (fail) {
        return { ok: false, reason: 'error', error: { kind: fail, message: `fake-remote push ${fail}` } };
      }
      const rec = store.get(userId);
      const currentVersion = rec ? rec.version : 0;

      // Optimistic concurrency: base phải khớp remote head.
      if (expectedBaseVersion !== currentVersion) {
        return {
          ok: false,
          reason: 'conflict',
          remoteHead: rec ? headOf(rec) : emptyHead(),
        };
      }

      // Dedup: cùng snapshotHash → no-op, version giữ nguyên.
      if (rec && rec.envelope.snapshotHash === envelope.snapshotHash) {
        return { ok: true, version: rec.version, head: headOf(rec), deduped: true };
      }

      const nextVersion = currentVersion + 1;
      const stored: RemoteRecord = {
        version: nextVersion,
        envelope: { ...envelope, baseVersion: nextVersion },
      };
      store.set(userId, stored);
      return { ok: true, version: nextVersion, head: headOf(stored), deduped: false };
    },

    _failNext(op, kind) {
      pending[op].push(kind);
    },
    _setRemote(userId, envelope, version) {
      store.set(userId, { version, envelope: { ...envelope, baseVersion: version } });
    },
    _peek(userId) {
      const rec = store.get(userId);
      return rec ? { version: rec.version, envelope: rec.envelope } : null;
    },
    _userCount() {
      return store.size;
    },
  };
}
