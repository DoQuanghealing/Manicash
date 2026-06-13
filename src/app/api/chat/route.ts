/* ═══ /api/chat — Unified Chat Endpoint (Phase 2) ═══
 * Flow:
 *   1. Auth: verify UID (cookie session + Bearer ID token).
 *   2. routeIntent(message) -> phân loại + slot (Phase 1).
 *   3. switch-case dispatch sang handler deterministic.
 *   4. Intent nhóm LLM (CFO_REPORT/ANALYZE_FINANCE/ADVICE_CUT_SPENDING):
 *      trả placeholder — sẽ nối LLM ở Phase 3.
 *   5. Đo latencyMs từ lúc nhận request đến lúc trả JSON.
 *
 * Body: { message: string, sessionId?: string, clientSnapshot?: object }
 * clientSnapshot = data client đóng gói từ Zustand (hybrid — xem snapshotBuilder).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import type { ChatIntent, ChatReply } from '@/lib/aiMoneyChat/intent/types';
import type { ChatHandlerContext } from '@/lib/aiMoneyChat/aggregation/types';
import { handleLogTransaction } from '@/lib/aiMoneyChat/handlers/handleLogTransaction';
import { handleQueryBalance } from '@/lib/aiMoneyChat/handlers/handleQueryBalance';
import { handleQueryIncome } from '@/lib/aiMoneyChat/handlers/handleQueryIncome';
import { handleQueryBill } from '@/lib/aiMoneyChat/handlers/handleQueryBill';
import { handleQueryBudget } from '@/lib/aiMoneyChat/handlers/handleQueryBudget';
import { handleQueryTasks } from '@/lib/aiMoneyChat/handlers/handleQueryTasks';
import { handleQuerySpending } from '@/lib/aiMoneyChat/handlers/handleQuerySpending';
import { handleQuerySavings } from '@/lib/aiMoneyChat/handlers/handleQuerySavings';
import { handleQuerySafeToSpend } from '@/lib/aiMoneyChat/handlers/handleQuerySafeToSpend';
import { handleQueryGoals } from '@/lib/aiMoneyChat/handlers/handleQueryGoals';
import { handleQueryHealth } from '@/lib/aiMoneyChat/handlers/handleQueryHealth';
import { handleQueryStreak } from '@/lib/aiMoneyChat/handlers/handleQueryStreak';
import { handleCFOReport } from '@/lib/aiMoneyChat/handlers/handleCFOReport';
import { handleFollowUp } from '@/lib/aiMoneyChat/handlers/handleFollowUp';
import { invalidateSnapshotCache } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import { isLicenseValid, LICENSE_ERROR_MESSAGE } from '@/lib/aiMoneyChat/security/license';
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { parseActionCommand } from '@/lib/aiMoneyChat/actions/actionCommandParser';
import { validateActionRequestAgainstSnapshot } from '@/lib/aiMoneyChat/actions/actionValidators';

/**
 * Phase 4A: phát hiện lệnh hành động (deterministic, 0 token). Server CHỈ tạo
 * actionRequest sau khi validate — KHÔNG execute. Trả null nếu không phải lệnh.
 */
function tryBuildActionReply(message: string, clientSnapshot: unknown): ChatReply | null {
  if (!clientSnapshot || typeof clientSnapshot !== 'object') return null;
  const money = toMoneySnapshotV1(clientSnapshot as ClientSnapshotInput);
  const actionRequest = parseActionCommand(message, money);
  if (!actionRequest) return null;

  const validation = validateActionRequestAgainstSnapshot(money, actionRequest);
  if (!validation.ok) {
    return {
      message: `Mình chưa thực hiện được thao tác này: ${validation.reason}`,
      ui: { kind: 'none' },
      meta: { intent: 'ACTION_REQUEST', source: 'deterministic', latencyMs: 0 },
    };
  }
  return {
    message: 'Tôi đã chuẩn bị thao tác này. Ngài xác nhận giúp nhé.',
    ui: { kind: 'none' },
    meta: { intent: 'ACTION_REQUEST', source: 'deterministic', latencyMs: 0 },
    actionRequest,
  };
}

const MAX_MESSAGE_LENGTH = 500;

function fallbackReply(intent: ChatIntent): ChatReply {
  return {
    message:
      'Mình chưa rõ ý ngài lắm. Ngài có thể hỏi số dư ("còn bao nhiêu tiền"), ' +
      'hóa đơn ("tiền điện đóng chưa"), nhiệm vụ hôm nay, hoặc nhập một giao dịch mới.',
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}

async function dispatch(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext,
): Promise<ChatReply> {
  switch (intent.type) {
    case 'LOG_TRANSACTION':
      return handleLogTransaction(intent);
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

    // Nhóm LLM (Phase 3): CFO report / phân tích / tư vấn cắt giảm.
    case 'CFO_REPORT':
    case 'ANALYZE_FINANCE':
    case 'ADVICE_CUT_SPENDING':
      return handleCFOReport(uid, intent, ctx);

    // FOLLOW_UP — tái dùng snapshot phiên (Phase 4).
    case 'FOLLOW_UP':
      return handleFollowUp(uid, intent, ctx);

    case 'UNKNOWN':
    default:
      return fallbackReply(intent);
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // 0) License gate (fail-loud, runtime). Dev/test luôn pass.
  if (!isLicenseValid()) {
    return NextResponse.json({ error: 'license_invalid', message: LICENSE_ERROR_MESSAGE }, { status: 503 });
  }

  // 1) Auth.
  const uid = await getVerifiedRequestUid(req);
  if (!uid) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2) Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  if (!message) {
    return NextResponse.json({ error: 'empty_message' }, { status: 400 });
  }
  const sessionId = typeof b.sessionId === 'string' && b.sessionId ? b.sessionId : `${uid}:${startedAt}`;

  // Invalidation hook: client gửi snapshot mới = dữ liệu vừa đổi -> bỏ cache cũ
  // để lượt sau (không kèm snapshot) buộc re-aggregate số liệu mới nhất.
  if (b.clientSnapshot && typeof b.clientSnapshot === 'object') {
    invalidateSnapshotCache(uid);
  }

  const ctx: ChatHandlerContext = { clientSnapshot: b.clientSnapshot, sessionId };

  // 3) Route + dispatch (không bao giờ throw ra ngoài).
  try {
    // Phase 4A: lệnh hành động thắng query khi câu có verb rõ + payload hợp lệ.
    const actionReply = tryBuildActionReply(message, b.clientSnapshot);
    if (actionReply) {
      actionReply.meta.latencyMs = Date.now() - startedAt;
      const actionIntent: ChatIntent = {
        type: 'ACTION_REQUEST',
        confidence: 'high',
        score: 1,
        pipeline: 'deterministic',
        slots: {},
        normalizedText: message,
        rawText: message,
        reason: 'action command',
      };
      return NextResponse.json({ sessionId, intent: actionIntent, reply: actionReply });
    }

    const intent = routeIntent(message);
    const reply = await dispatch(uid, intent, ctx);
    reply.meta.latencyMs = Date.now() - startedAt;

    return NextResponse.json({ sessionId, intent, reply });
  } catch (error) {
    console.error('[api/chat] handler error:', error);
    return NextResponse.json(
      {
        error: 'handler_failed',
        reply: {
          message: 'Có lỗi khi xử lý câu hỏi. Ngài thử lại sau nhé.',
          ui: { kind: 'none' },
          meta: { intent: 'UNKNOWN', source: 'deterministic', latencyMs: Date.now() - startedAt },
        },
      },
      { status: 500 },
    );
  }
}
