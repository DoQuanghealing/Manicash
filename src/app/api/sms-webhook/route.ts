/* ═══ SMS Webhook Endpoint ═══
 *
 * POST /api/sms-webhook
 *
 * Thin orchestrator — KHÔNG chứa business logic.
 * Flow:
 *   1. Parse JSON + validate payload shape          → 400 invalid_payload
 *   2. Validate token format + lookup user          → 401 invalid_token
 *   3. Dedupe check qua messageId hash              → 200 deduped
 *   4. parseSms(sender, body) detect bank + parse   → 422 unparseable_sms / 200 ignored
 *   5. predictCategory(parsed)
 *   6. Write users/{uid}/pending_transactions/{id}
 *   7. Write dedupe record (TTL — config separate)
 *                                                   → 200 captured
 */

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { parseSms } from '@/lib/sms/parsers';
import { predictCategory } from '@/lib/sms/categoryPredictor';
import { validateTokenFormat, hashMessageId } from '@/lib/sms/tokenGenerator';
import type {
  PendingTransaction,
  WebhookPayload,
  WebhookErrorResponse,
  WebhookSuccessResponse,
} from '@/types/webhook';

const DEDUPE_TTL_DAYS = 1;

function err(error: string, code: WebhookErrorResponse['code'], status: number) {
  return NextResponse.json<WebhookErrorResponse>({ error, code }, { status });
}

function ok(data: WebhookSuccessResponse) {
  return NextResponse.json<WebhookSuccessResponse>(data);
}

function parsePayload(raw: unknown): WebhookPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.token !== 'string') return null;
  if (typeof p.sender !== 'string' || !p.sender) return null;
  if (typeof p.body !== 'string' || !p.body) return null;
  if (p.receivedAt !== undefined && typeof p.receivedAt !== 'string') return null;
  if (p.messageId !== undefined && typeof p.messageId !== 'string') return null;
  return {
    token: p.token,
    sender: p.sender,
    body: p.body,
    receivedAt: p.receivedAt as string | undefined,
    messageId: p.messageId as string | undefined,
  };
}

async function findUserByToken(token: string): Promise<string | null> {
  const snap = await getAdminDb()
    .collection('webhook_tokens')
    .where('token', '==', token)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  // === 1. Parse body ===
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err('Body không phải JSON hợp lệ', 'invalid_payload', 400);
  }

  const payload = parsePayload(raw);
  if (!payload) {
    return err('Payload thiếu field bắt buộc (token/sender/body)', 'invalid_payload', 400);
  }

  // === 2. Token format + ownership ===
  if (!validateTokenFormat(payload.token)) {
    return err('Token sai format', 'invalid_token', 401);
  }

  let userId: string | null;
  try {
    userId = await findUserByToken(payload.token);
  } catch (e) {
    console.error('[sms-webhook] findUserByToken failed:', e);
    return err('Lỗi server', 'server_error', 500);
  }
  if (!userId) {
    return err('Token không hợp lệ', 'invalid_token', 401);
  }

  // === 3. Dedupe (chỉ khi messageId được cung cấp) ===
  const db = getAdminDb();
  if (payload.messageId) {
    const hash = hashMessageId(payload.messageId);
    const dedupeRef = db
      .collection('webhook_tokens')
      .doc(userId)
      .collection('recent_msgs')
      .doc(hash);
    const existing = await dedupeRef.get();
    if (existing.exists) {
      return ok({ status: 'deduped' });
    }
  }

  // === 4. Detect bank + parse SMS ===
  const result = parseSms(payload.sender, payload.body);
  if (!result) {
    // Sender không match bank nào — caller có thể setup sai
    return err('Không nhận diện được ngân hàng từ sender', 'unparseable_sms', 422);
  }
  if (!result.parsed) {
    // Bank đúng, nhưng SMS body không phải transaction (OTP, marketing, balance check)
    return ok({ status: 'ignored', reason: 'not_a_transaction_sms' });
  }

  // === 5. Predict category ===
  const prediction = predictCategory(result.parsed);

  // === 6. Build + write pending transaction ===
  const nowIso = new Date().toISOString();
  const receivedAt = result.parsed.occurredAt || payload.receivedAt || nowIso;

  const pendingRef = db
    .collection('users')
    .doc(userId)
    .collection('pending_transactions')
    .doc();

  const pending: PendingTransaction = {
    id: pendingRef.id,
    userId,
    bankCode: result.bank,
    type: result.parsed.type,
    amount: result.parsed.amount,
    balance: result.parsed.balance,
    description: result.parsed.description,
    predictedCategoryId: prediction.categoryId,
    confidence: prediction.confidence,
    receivedAt,
    rawSender: payload.sender,
    rawBody: payload.body,
    createdAt: nowIso,
  };

  try {
    await pendingRef.set(pending);
  } catch (e) {
    console.error('[sms-webhook] write pending failed:', e);
    return err('Lỗi server khi lưu giao dịch', 'server_error', 500);
  }

  // === 7. Write dedupe record (TTL config riêng — Firebase Console) ===
  if (payload.messageId) {
    try {
      const hash = hashMessageId(payload.messageId);
      const expireAt = new Date(Date.now() + DEDUPE_TTL_DAYS * 24 * 60 * 60 * 1000);
      await db
        .collection('webhook_tokens')
        .doc(userId)
        .collection('recent_msgs')
        .doc(hash)
        .set({
          messageHash: hash,
          createdAt: nowIso,
          expireAt: Timestamp.fromDate(expireAt),
        });
    } catch (e) {
      // Dedupe record fail không fail toàn bộ — tx đã captured.
      console.error('[sms-webhook] dedupe write failed (non-fatal):', e);
    }
  }

  return ok({ status: 'captured', pendingTxId: pending.id });
}
