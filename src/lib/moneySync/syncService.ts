/* ═══ Money Sync — Sync Service (Phase 6B-2A) ═══
 * Orchestrates a single pull-merge-push cycle.
 *
 * Invariants:
 *  - KHÔNG mutate Zustand trực tiếp — trả SyncResult; caller apply patch.
 *  - KHÔNG import React / localStorage / server-only code.
 *  - KHÔNG tự gọi Firestore — dùng MoneyCloudAdapter (mockable).
 *  - uid rỗng hoặc store chưa hydrate → fail nhanh.
 */
import type { CloudMoneyDocumentV1, LocalMoneyStatePatch } from './cloudTypes';
import type { MoneyCloudAdapter } from './firestoreAdapter';
import { serializeMoneyStateToCloud } from './serialize';
import { deserializeCloudMoneyDocument } from './serialize';
import { mergeCloudAndLocal } from './merge';
import type { MergeResult } from './merge';
import type { LocalMoneyStateInput } from './cloudTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncMode =
  | 'pull_only'    // chỉ pull về, không push
  | 'push_only'    // chỉ push lên, không pull/merge
  | 'full';        // pull → merge → push (default)

export type SyncResultOk = {
  ok: true;
  mode: SyncMode;
  action: 'created' | 'pushed' | 'merged' | 'pulled' | 'noop';
  patch: LocalMoneyStatePatch | null;
  conflicts: MergeResult['conflicts'];
  source: MergeResult['source'] | null;
  savedDoc: CloudMoneyDocumentV1;
};

export type SyncResultFail = {
  ok: false;
  reason:
    | 'uid_missing'
    | 'not_hydrated'
    | 'user_null'
    | 'adapter_error'
    | 'serialize_error';
  error?: string;
};

export type SyncResult = SyncResultOk | SyncResultFail;

export type SyncOnceInput = {
  uid: string;
  adapter: MoneyCloudAdapter;
  localState: LocalMoneyStateInput;
  now: string;
  deviceId: string;
  hydrated: boolean;
  mode?: SyncMode;
};

// ─── Main sync function ────────────────────────────────────────────────────────

/**
 * Pull-merge-push cycle (một lần). Gọi từ UI event; không tự gọi.
 *
 * Flow:
 *  1. Guard: uid phải có, stores phải hydrated, user không null
 *  2. Serialize local → localDoc
 *  3. Nếu mode != push_only: load cloud doc
 *  4. Nếu cloud null (lần đầu): save localDoc → return created
 *  5. Nếu mode == pull_only: deserialize cloud → return patch
 *  6. Merge localDoc + cloudDoc
 *  7. Save merged → return patch + conflicts
 */
export async function syncMoneyStateOnce(
  input: SyncOnceInput,
): Promise<SyncResult> {
  const { uid, adapter, localState, now, deviceId, hydrated, mode = 'full' } =
    input;

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!uid || uid.trim().length === 0) {
    return { ok: false, reason: 'uid_missing' };
  }
  if (!hydrated) {
    return { ok: false, reason: 'not_hydrated' };
  }
  if (!localState.auth.user) {
    return { ok: false, reason: 'user_null' };
  }

  // ── Serialize ────────────────────────────────────────────────────────────────
  let localDoc: CloudMoneyDocumentV1;
  try {
    localDoc = serializeMoneyStateToCloud(localState);
  } catch (err) {
    return {
      ok: false,
      reason: 'serialize_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── push_only: skip pull entirely ───────────────────────────────────────────
  if (mode === 'push_only') {
    try {
      await adapter.save(uid, localDoc);
      return {
        ok: true,
        mode,
        action: 'pushed',
        patch: null,
        conflicts: [],
        source: null,
        savedDoc: localDoc,
      };
    } catch (err) {
      return {
        ok: false,
        reason: 'adapter_error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Load cloud ───────────────────────────────────────────────────────────────
  let cloudDoc: CloudMoneyDocumentV1 | null;
  try {
    cloudDoc = await adapter.load(uid);
  } catch (err) {
    return {
      ok: false,
      reason: 'adapter_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── pull_only: deserialize cloud, don't save ────────────────────────────────
  if (mode === 'pull_only') {
    if (!cloudDoc) {
      return {
        ok: true,
        mode,
        action: 'noop',
        patch: null,
        conflicts: [],
        source: null,
        savedDoc: localDoc,
      };
    }
    const patch = deserializeCloudMoneyDocument(cloudDoc);
    return {
      ok: true,
      mode,
      action: 'pulled',
      patch,
      conflicts: [],
      source: 'cloud',
      savedDoc: cloudDoc,
    };
  }

  // ── full: first sync (no cloud doc) ────────────────────────────────────────
  if (!cloudDoc) {
    try {
      await adapter.save(uid, localDoc);
    } catch (err) {
      return {
        ok: false,
        reason: 'adapter_error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      ok: true,
      mode,
      action: 'created',
      patch: null,
      conflicts: [],
      source: null,
      savedDoc: localDoc,
    };
  }

  // ── full: merge + save ──────────────────────────────────────────────────────
  const mergeResult = mergeCloudAndLocal({
    local: localDoc,
    cloud: cloudDoc,
    now,
    deviceId,
  });

  try {
    await adapter.save(uid, mergeResult.merged);
  } catch (err) {
    return {
      ok: false,
      reason: 'adapter_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const patch = deserializeCloudMoneyDocument(mergeResult.merged);
  return {
    ok: true,
    mode,
    action: 'merged',
    patch,
    conflicts: mergeResult.conflicts,
    source: mergeResult.source,
    savedDoc: mergeResult.merged,
  };
}
