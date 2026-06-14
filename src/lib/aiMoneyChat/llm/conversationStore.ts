/* ═══ AI Money Chat — Conversation Store (Phase 4 · B-03 durable) ═══
 * Bộ nhớ ngắn hạn cho hội thoại CFO follow-up. TTL tuyệt đối 30 phút, giữ tối đa
 * MAX_TURNS lượt gần nhất.
 *
 * B-03: trước đây in-memory Map trên globalThis → CHẾT khi serverless cold-start /
 * multi-instance (mỗi request có thể trúng instance khác → mất phiên → re-aggregate).
 * Nay BACKEND KÉP:
 *   - Firestore (Admin SDK) `ai_conversations/{sessionId}` khi có cấu hình → bền vững.
 *   - Fallback in-memory Map khi KHÔNG có firebase env (test/dev) → chạy không cần env.
 * Dynamic import firebaseAdmin (không kéo vào graph khi test). API public là ASYNC.
 */

import type { MonthlyFinancialSnapshot } from '../aggregation/types';

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 phút
export const MAX_TURNS = 8;

export interface ConversationTurn {
  at: string;
  intent: string;
  userMessage: string;
  assistantMessage: string;
  tokensUsed: number;
}

export interface ConversationContext {
  sessionId: string;
  uid: string;
  snapshot: MonthlyFinancialSnapshot;
  snapshotAt: string;
  turns: ConversationTurn[];
  expiresAt: string;
}

const COLLECTION = 'ai_conversations';

/* ─────────── In-memory fallback (test/dev không có firebase env) ─────────── */
const STORE_KEY = Symbol.for('manicash.aiMoneyChat.conversationStore');
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: Map<string, ConversationContext> };

function memStore(): Map<string, ConversationContext> {
  const g = globalThis as GlobalWithStore;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, ConversationContext>();
  return g[STORE_KEY]!;
}

function nowMs(): number {
  return Date.now();
}
function isExpired(ctx: ConversationContext, at = nowMs()): boolean {
  return new Date(ctx.expiresAt).getTime() <= at;
}

/** Lấy Firestore (Admin SDK) nếu cấu hình đủ; null nếu không (→ dùng in-memory). */
async function tryDb(): Promise<FirebaseFirestore.Firestore | null> {
  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin');
    return getAdminDb(); // throws nếu thiếu env
  } catch {
    return null;
  }
}

/** Loại undefined để Firestore .set() không lỗi. */
function firestoreSafe(ctx: ConversationContext): ConversationContext {
  return JSON.parse(JSON.stringify(ctx)) as ConversationContext;
}

/**
 * Khởi tạo (hoặc reset) phiên với snapshot mới. Gọi ở turn đầu khi tạo CFO report.
 * Ghi đè phiên cũ cùng sessionId.
 */
export async function createSession(
  sessionId: string,
  uid: string,
  snapshot: MonthlyFinancialSnapshot,
): Promise<ConversationContext> {
  const at = nowMs();
  const ctx: ConversationContext = {
    sessionId,
    uid,
    snapshot,
    snapshotAt: new Date(at).toISOString(),
    turns: [],
    expiresAt: new Date(at + SESSION_TTL_MS).toISOString(),
  };
  const db = await tryDb();
  if (db) {
    await db.collection(COLLECTION).doc(sessionId).set(firestoreSafe(ctx));
  } else {
    memStore().set(sessionId, ctx);
  }
  return ctx;
}

/**
 * Lấy phiên hiện có. Hết hạn / sai uid → purge (nếu hết hạn) + trả null.
 * (KHÔNG tự tạo phiên — createSession là cổng tạo riêng.)
 */
export async function getOrCreateSession(
  sessionId: string,
  uid: string,
): Promise<ConversationContext | null> {
  const db = await tryDb();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(sessionId).get();
    if (!snap.exists) return null;
    const ctx = snap.data() as ConversationContext;
    if (isExpired(ctx)) {
      await db.collection(COLLECTION).doc(sessionId).delete().catch(() => {});
      return null;
    }
    if (ctx.uid !== uid) return null;
    return ctx;
  }

  const ctx = memStore().get(sessionId);
  if (!ctx) return null;
  if (isExpired(ctx)) {
    memStore().delete(sessionId);
    return null;
  }
  if (ctx.uid !== uid) return null;
  return ctx;
}

/**
 * Đẩy một lượt chat vào phiên. Cap MAX_TURNS (bỏ lượt cũ nhất), gia hạn TTL 30 phút.
 * No-op nếu phiên không tồn tại.
 */
export async function appendTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
  const db = await tryDb();
  if (db) {
    const ref = db.collection(COLLECTION).doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const ctx = snap.data() as ConversationContext;
    ctx.turns.push(turn);
    if (ctx.turns.length > MAX_TURNS) ctx.turns.splice(0, ctx.turns.length - MAX_TURNS);
    ctx.expiresAt = new Date(nowMs() + SESSION_TTL_MS).toISOString();
    await ref.set(firestoreSafe(ctx));
    return;
  }

  const ctx = memStore().get(sessionId);
  if (!ctx) return;
  ctx.turns.push(turn);
  if (ctx.turns.length > MAX_TURNS) ctx.turns.splice(0, ctx.turns.length - MAX_TURNS);
  ctx.expiresAt = new Date(nowMs() + SESSION_TTL_MS).toISOString();
}

/**
 * Dọn phiên hết hạn. In-memory: quét Map. Firestore: dựa lazy-purge khi đọc +
 * Firestore TTL policy trên `expiresAt` (cấu hình ở console) → đây trả 0.
 */
export async function purgeExpired(): Promise<number> {
  const db = await tryDb();
  if (db) return 0; // Firestore: TTL policy + lazy purge on read.

  const at = nowMs();
  let purged = 0;
  for (const [id, ctx] of Array.from(memStore().entries())) {
    if (isExpired(ctx, at)) {
      memStore().delete(id);
      purged += 1;
    }
  }
  return purged;
}

/* ─────────── Test helpers (in-memory) ─────────── */

export function __clearConversationStoreForTest(): void {
  memStore().clear();
}

/** Ép một phiên hết hạn (backdate) để test nhánh purge. */
export function __expireSessionForTest(sessionId: string): void {
  const ctx = memStore().get(sessionId);
  if (ctx) ctx.expiresAt = new Date(nowMs() - 1000).toISOString();
}
