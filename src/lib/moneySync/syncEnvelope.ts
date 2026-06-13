/* ═══ Money Sync — Sync Envelope + Version Metadata (Phase 6B-2C) ═══
 * Lớp metadata mỏng bọc quanh CloudMoneyDocumentV1 để phase sau nối remote thật
 * mà không phải viết lại nền móng. PURE — KHÔNG import React/Zustand/Firebase và
 * KHÔNG dùng Date.now (clock/clientNow truyền từ ngoài).
 *
 * Versioning model (optimistic concurrency):
 *  - baseVersion: remote head version mà client thấy gần nhất (0 nếu chưa từng sync).
 *  - localVersion: bộ đếm tăng dần phía client (debug/trace, không quyết định merge).
 *  - snapshotHash: content hash hiện tại (từ snapshotBuilder) — quyết định no-op.
 */
import type { CloudMoneyDocumentV1 } from './cloudTypes';

export type MoneySyncEnvelopeV1 = {
  envelopeVersion: 'money_sync_envelope_v1';
  userId: string;
  snapshotHash: string;
  /** Remote version envelope này được dẫn xuất từ (last seen remote head). */
  baseVersion: number;
  /** Bộ đếm local tăng dần (trace-only). */
  localVersion: number;
  /** ISO timestamp — clock/clientNow truyền vào, KHÔNG Date.now. */
  createdAt: string;
  payload: CloudMoneyDocumentV1;
};

export type BuildEnvelopeInput = {
  userId: string;
  snapshotHash: string;
  baseVersion: number;
  localVersion: number;
  createdAt: string;
  payload: CloudMoneyDocumentV1;
};

export function buildSyncEnvelope(input: BuildEnvelopeInput): MoneySyncEnvelopeV1 {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new Error('buildSyncEnvelope: userId is empty');
  }
  return {
    envelopeVersion: 'money_sync_envelope_v1',
    userId: input.userId,
    snapshotHash: input.snapshotHash,
    baseVersion: input.baseVersion,
    localVersion: input.localVersion,
    createdAt: input.createdAt,
    payload: input.payload,
  };
}

/** Type guard an toàn cho envelope nhận về từ remote (fake/real). */
export function isMoneySyncEnvelopeV1(value: unknown): value is MoneySyncEnvelopeV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v['envelopeVersion'] === 'money_sync_envelope_v1' &&
    typeof v['userId'] === 'string' &&
    typeof v['snapshotHash'] === 'string' &&
    typeof v['baseVersion'] === 'number' &&
    typeof v['payload'] === 'object' &&
    v['payload'] !== null
  );
}
