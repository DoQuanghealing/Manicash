/* ═══ Money Sync — Remote Sync Simulation Service (Phase 6B-2C) ═══
 * "Phòng thí nghiệm" remote sync: ghép decideSyncAction + RemoteMoneySyncAdapter
 * + mergeCloudAndLocal (tái dùng từ 6B-2A). Mô phỏng push/pull/conflict/retry.
 *
 * BẤT BIẾN:
 *  - KHÔNG mutate Zustand — trả patch/preview; caller (phase sau) tự apply.
 *  - KHÔNG viết merge logic mới — dùng lại mergeCloudAndLocal.
 *  - KHÔNG network thật — adapter là fake/in-memory.
 *  - clock truyền vào (now) — không Date.now ở đây.
 */
import type { CloudMoneyDocumentV1, LocalMoneyStatePatch, ConflictRecord } from './cloudTypes';
import type { MoneySyncEnvelopeV1 } from './syncEnvelope';
import {
  decideSyncAction,
  type RemoteMoneySyncAdapter,
  type RemoteSyncError,
  type SyncDecision,
} from './remoteAdapter';
import { mergeCloudAndLocal } from './merge';
import { deserializeCloudMoneyDocument } from './serialize';

// ─── Dry-run apply preview (PURE shapes) ──────────────────────────────────────

export type RemoteSyncOutcome =
  | { ok: true; action: 'noop'; decision: SyncDecision }
  | { ok: true; action: 'pushed'; remoteVersion: number; deduped: boolean; decision: SyncDecision }
  | {
      ok: true;
      action: 'pulled';
      remoteVersion: number;
      /** Patch remote (caller tự apply — phase này KHÔNG apply vào store). */
      patch: LocalMoneyStatePatch;
      decision: SyncDecision;
    }
  | {
      ok: true;
      action: 'merged';
      remoteVersion: number;
      /** Preview doc đã merge (chưa apply). */
      mergedPreview: CloudMoneyDocumentV1;
      patch: LocalMoneyStatePatch;
      conflicts: ConflictRecord[];
      /** true nếu đã push bản merge ngược lên remote (applyMerge=true). */
      pushedMerge: boolean;
      decision: SyncDecision;
    }
  | { ok: false; reason: 'uid_missing' | 'error'; error?: RemoteSyncError };

export type SimulateRemoteSyncInput = {
  userId: string;
  adapter: RemoteMoneySyncAdapter;
  localEnvelope: MoneySyncEnvelopeV1;
  /** Hash local đã sync gần nhất (null nếu chưa). */
  baseHash: string | null;
  now: string;
  deviceId: string;
  /** Nếu true: khi conflict, push bản merge ngược lên remote. Mặc định false. */
  applyMerge?: boolean;
};

function toError(err: unknown): RemoteSyncError {
  if (err && typeof err === 'object' && 'kind' in err) return err as RemoteSyncError;
  return { kind: 'unknown', message: err instanceof Error ? err.message : String(err) };
}

/**
 * Một vòng simulate push/pull/conflict. Không tự apply vào Zustand.
 */
export async function simulateRemoteSyncOnce(
  input: SimulateRemoteSyncInput,
): Promise<RemoteSyncOutcome> {
  const { userId, adapter, localEnvelope, baseHash, now, deviceId, applyMerge = false } = input;

  if (!userId || userId.trim().length === 0) {
    return { ok: false, reason: 'uid_missing' };
  }

  // 1) Đọc remote head.
  let head;
  try {
    head = await adapter.getHead(userId);
  } catch (err) {
    return { ok: false, reason: 'error', error: toError(err) };
  }

  // 2) Quyết định hành động (thuần).
  const decision = decideSyncAction({
    localHash: localEnvelope.snapshotHash,
    baseHash,
    baseVersion: localEnvelope.baseVersion,
    remote: head,
  });

  if (decision.kind === 'noop') {
    return { ok: true, action: 'noop', decision };
  }

  // 3) PUSH (remote rỗng hoặc local đi trước).
  if (decision.kind === 'push') {
    const res = await adapter.push(userId, localEnvelope, head.version);
    if (res.ok) {
      return {
        ok: true,
        action: 'pushed',
        remoteVersion: res.version,
        deduped: res.deduped,
        decision,
      };
    }
    if (res.reason === 'error') {
      return { ok: false, reason: 'error', error: res.error };
    }
    // push gặp conflict (ai đó vừa push) → rơi xuống nhánh conflict bên dưới.
    return resolveConflict(userId, adapter, localEnvelope, now, deviceId, applyMerge, decision);
  }

  // 4) PULL (remote đi trước, local chưa đổi).
  if (decision.kind === 'pull') {
    const pull = await adapter.pull(userId);
    if (!pull.ok) return { ok: false, reason: 'error', error: pull.error };
    if (!pull.exists) {
      // Remote vừa biến mất → coi như noop an toàn (không mutate store).
      return { ok: true, action: 'noop', decision };
    }
    const patch = deserializeCloudMoneyDocument(pull.envelope.payload);
    return { ok: true, action: 'pulled', remoteVersion: pull.version, patch, decision };
  }

  // 5) CONFLICT (cùng base, hai phía đổi).
  return resolveConflict(userId, adapter, localEnvelope, now, deviceId, applyMerge, decision);
}

/** Pull remote → merge với local (tái dùng mergeCloudAndLocal) → preview/patch. */
async function resolveConflict(
  userId: string,
  adapter: RemoteMoneySyncAdapter,
  localEnvelope: MoneySyncEnvelopeV1,
  now: string,
  deviceId: string,
  applyMerge: boolean,
  decision: SyncDecision,
): Promise<RemoteSyncOutcome> {
  const pull = await adapter.pull(userId);
  if (!pull.ok) return { ok: false, reason: 'error', error: pull.error };
  if (!pull.exists) {
    // Không còn remote để xung đột → push thẳng.
    const res = await adapter.push(userId, localEnvelope, 0);
    if (res.ok) {
      return { ok: true, action: 'pushed', remoteVersion: res.version, deduped: res.deduped, decision };
    }
    if (res.reason === 'error') return { ok: false, reason: 'error', error: res.error };
    return { ok: false, reason: 'error', error: { kind: 'conflict', message: 'unexpected conflict on empty remote' } };
  }

  const mergeResult = mergeCloudAndLocal({
    local: localEnvelope.payload,
    cloud: pull.envelope.payload,
    now,
    deviceId,
  });
  const patch = deserializeCloudMoneyDocument(mergeResult.merged);

  let pushedMerge = false;
  let remoteVersion = pull.version;
  if (applyMerge) {
    const mergedEnvelope: MoneySyncEnvelopeV1 = {
      ...localEnvelope,
      snapshotHash: `${localEnvelope.snapshotHash}+${pull.envelope.snapshotHash}`,
      baseVersion: pull.version,
      createdAt: now,
      payload: mergeResult.merged,
    };
    const res = await adapter.push(userId, mergedEnvelope, pull.version);
    if (res.ok) {
      pushedMerge = true;
      remoteVersion = res.version;
    } else if (res.reason === 'error') {
      return { ok: false, reason: 'error', error: res.error };
    }
    // res.reason === 'conflict' → giữ pushedMerge=false, vẫn trả preview merge.
  }

  return {
    ok: true,
    action: 'merged',
    remoteVersion,
    mergedPreview: mergeResult.merged,
    patch,
    conflicts: mergeResult.conflicts,
    pushedMerge,
    decision,
  };
}
