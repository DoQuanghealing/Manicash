/* ═══ AI Money Chat — Action Request Builder (Phase 4A) ═══
 * Tạo MoneyActionRequest (pending_confirmation). KHÔNG execute gì cả.
 */

import type { MoneySnapshotV1 } from '@/lib/moneyBrain';
import type { MoneyActionRequest, MoneyActionRiskLevel } from './actionTypes';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 phút

let requestCounter = 0;

function genRequestId(createdAtMs: number): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  return `act-${createdAtMs}-${requestCounter}`;
}

export function createActionRequest(
  _snapshot: MoneySnapshotV1,
  input: {
    action: MoneyActionRequest['action'];
    payload: MoneyActionRequest['payload'];
    preview: string;
    riskLevel?: MoneyActionRiskLevel;
    ttlMs?: number;
  },
): MoneyActionRequest {
  // Safe: request metadata only, not financial period logic.
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString();

  const base = {
    type: 'action_request' as const,
    requestId: genRequestId(nowMs),
    createdAt,
    expiresAt,
    snapshotVersion: 'money_snapshot_v1' as const,
    preview: input.preview,
    requiresConfirmation: true as const,
    status: 'pending_confirmation' as const,
    riskLevel: input.riskLevel ?? 'low',
  };

  // payload đã được caller truyền đúng theo action → build object rồi cast về union.
  return { ...base, action: input.action, payload: input.payload } as MoneyActionRequest;
}
