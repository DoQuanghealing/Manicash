/* ═══ PRISM — Lõi Kim Cương: bộ điều phối OFFLINE phía client (P1) ═══
 *
 * Cổng vào OFFLINE-FIRST của chat. Mirror ĐÚNG thứ tự của /api/chat:
 *   1) Lệnh hành động (chuyển quỹ, đặt ngân sách...) -> trả null
 *      (để server validate + tạo actionRequest, KHÔNG execute ở đây).
 *   2) routeIntent -> nếu là intent TRA CỨU read-only deterministic:
 *      chạy handler NGAY tại client từ clientSnapshot — 0đ, 0 mạng, tức thì.
 *   3) Còn lại (CFO / phân tích / tư vấn / follow-up / unknown) -> trả null
 *      để caller escalate lên /api/chat (LLM).
 *
 * Vì handler dùng buildMoneySnapshot(ctx.clientSnapshot) — đường thuần moneyBrain —
 * số liệu KHỚP TUYỆT ĐỐI với server (cùng một lõi). firebaseAdmin chỉ nằm sau
 * dynamic import của đường fallback Firestore, KHÔNG bao giờ chạy khi đã có
 * clientSnapshot (mà client thì luôn có).
 */

import { routeIntent } from '../intent/intentRouter';
import type { ChatIntent, ChatIntentType, ChatReply } from '../intent/types';
import type { ChatHandlerContext, ClientSnapshotInput } from '../aggregation/types';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import { parseActionCommand } from '../actions/actionCommandParser';

import { handleQueryBalance } from '../handlers/handleQueryBalance';
import { handleQueryIncome } from '../handlers/handleQueryIncome';
import { handleQueryBill } from '../handlers/handleQueryBill';
import { handleQueryBudget } from '../handlers/handleQueryBudget';
import { handleQueryTasks } from '../handlers/handleQueryTasks';
import { handleQuerySpending } from '../handlers/handleQuerySpending';
import { handleQuerySavings } from '../handlers/handleQuerySavings';
import { handleQuerySafeToSpend } from '../handlers/handleQuerySafeToSpend';
import { handleQueryGoals } from '../handlers/handleQueryGoals';
import { handleQueryHealth } from '../handlers/handleQueryHealth';
import { handleQueryStreak } from '../handlers/handleQueryStreak';

import { decorateWithVoice } from './prismVoice';

/**
 * Intent TRA CỨU read-only — an toàn chạy offline tại client
 * (0 side-effect, 0 LLM). Đồng bộ với switch-case của /api/chat.
 */
const READ_ONLY_INTENTS = new Set<ChatIntentType>([
  'QUERY_BALANCE',
  'QUERY_INCOME',
  'QUERY_BILL_STATUS',
  'QUERY_UPCOMING_BILLS',
  'QUERY_BILL_COVERAGE',
  'QUERY_BUDGET_STATUS',
  'QUERY_CATEGORY_SPENDING',
  'QUERY_TASKS_TODAY',
  'QUERY_EARNING_PIPELINE',
  'QUERY_SPENDING',
  'QUERY_SAVINGS',
  'QUERY_SAFE_TO_SPEND',
  'QUERY_GOAL_PROGRESS',
  'QUERY_HEALTH_SCORE',
  'QUERY_STREAK',
]);

export interface PrismDispatchInput {
  /** UID hiện tại (không bắt buộc — đường snapshot không dùng tới uid). */
  uid?: string;
  /** Snapshot client đóng gói từ Zustand (real-time). */
  clientSnapshot: ClientSnapshotInput;
}

/** Map intent -> handler deterministic (mirror /api/chat dispatch). */
async function runHandler(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext,
): Promise<ChatReply | null> {
  switch (intent.type) {
    case 'QUERY_BALANCE':
      return handleQueryBalance(uid, intent, ctx);
    case 'QUERY_INCOME':
      return handleQueryIncome(uid, intent, ctx);
    case 'QUERY_BILL_STATUS':
    case 'QUERY_UPCOMING_BILLS':
    case 'QUERY_BILL_COVERAGE':
      return handleQueryBill(uid, intent, ctx);
    case 'QUERY_BUDGET_STATUS':
    case 'QUERY_CATEGORY_SPENDING':
      return handleQueryBudget(uid, intent, ctx);
    case 'QUERY_TASKS_TODAY':
    case 'QUERY_EARNING_PIPELINE':
      return handleQueryTasks(uid, intent, ctx);
    case 'QUERY_SPENDING':
      return handleQuerySpending(uid, intent, ctx);
    case 'QUERY_SAVINGS':
      return handleQuerySavings(uid, intent, ctx);
    case 'QUERY_SAFE_TO_SPEND':
      return handleQuerySafeToSpend(uid, intent, ctx);
    case 'QUERY_GOAL_PROGRESS':
      return handleQueryGoals(uid, intent, ctx);
    case 'QUERY_HEALTH_SCORE':
      return handleQueryHealth(uid, intent, ctx);
    case 'QUERY_STREAK':
      return handleQueryStreak(uid, intent, ctx);
    default:
      return null;
  }
}

/**
 * Thử trả lời câu chat NGAY TẠI CLIENT (offline-first).
 * @returns ChatReply nếu PRISM tự trả lời được; null nếu cần escalate lên /api/chat.
 */
export async function dispatchPrism(
  text: string,
  input: PrismDispatchInput,
): Promise<ChatReply | null> {
  const message = text.trim();
  if (!message || !input.clientSnapshot) return null;

  // (1) Lệnh hành động -> để server validate + tạo actionRequest (không xử lý ở client).
  try {
    const money = toMoneySnapshotV1(input.clientSnapshot);
    if (parseActionCommand(message, money)) return null;
  } catch {
    return null; // snapshot/parse lỗi -> escalate cho an toàn
  }

  // (2) Phân loại intent.
  const intent = routeIntent(message);
  if (!READ_ONLY_INTENTS.has(intent.type)) return null; // (3) khó/LLM -> server

  const ctx: ChatHandlerContext = { clientSnapshot: input.clientSnapshot };
  try {
    const reply = await runHandler(input.uid || 'local', intent, ctx);
    if (!reply) return null;
    reply.message = decorateWithVoice(reply.message);
    reply.meta.source = 'deterministic';
    reply.meta.latencyMs = 0;
    return reply;
  } catch {
    return null; // handler lỗi bất ngờ -> để server thử lại
  }
}
