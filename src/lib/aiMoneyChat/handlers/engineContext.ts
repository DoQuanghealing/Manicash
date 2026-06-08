/* ═══ AI Money Chat — Handler engine context (Phase 2) ═══
 * Helper dùng chung cho các handler deterministic: dựng MoneySnapshotV1 từ
 * clientSnapshot (đường isomorphic chính), và tạo ChatReply chuẩn.
 *
 * Mọi số liệu trong handler phải lấy từ src/lib/moneyBrain trên snapshot này —
 * KHÔNG tự tính lại công thức tài chính trong handler.
 */

import { toMoneySnapshotV1 } from '@/lib/moneyBrain/snapshot';
import type { MoneySnapshotV1 } from '@/lib/moneyBrain/types';
import type { ChatHandlerContext, ClientSnapshotInput } from '../aggregation/types';
import type { ChatIntent, ChatReply } from '../intent/types';

/** Dựng MoneySnapshotV1 từ clientSnapshot. Trả null nếu không có snapshot client. */
export function buildMoneySnapshot(ctx: ChatHandlerContext): MoneySnapshotV1 | null {
  if (ctx.clientSnapshot && typeof ctx.clientSnapshot === 'object') {
    return toMoneySnapshotV1(ctx.clientSnapshot as ClientSnapshotInput);
  }
  return null;
}

/** ChatReply deterministic chuẩn (0 token). */
export function deterministicReply(message: string, intent: ChatIntent): ChatReply {
  return {
    message,
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}

/** Thông điệp khi phiên thiếu dữ liệu client để tính chính xác. */
export const NEED_SYNC_MESSAGE =
  'Phiên hiện tại chưa có đủ dữ liệu để tính chính xác. Ngài thử mở lại app để đồng bộ dữ liệu nhé.';
