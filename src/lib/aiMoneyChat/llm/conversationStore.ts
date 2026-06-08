/* ═══ AI Money Chat — Conversation Store (Phase 4) ═══
 * Bộ nhớ ngắn hạn cho hội thoại CFO follow-up. In-memory Map, TTL absolute 30 phút,
 * giữ tối đa MAX_TURNS lượt gần nhất để không phình context window.
 *
 * Mục tiêu cốt lõi: lưu lại SNAPSHOT của turn đầu để các câu follow-up
 * ("tại sao lố", "cắt thế nào") tái dùng — KHÔNG re-aggregate DB mỗi lượt.
 *
 * Lưu ý môi trường: thuần in-memory, KHÔNG import firebase -> test chạy không cần env.
 * Single-instance only (đủ cho beta). Khi scale, chuyển sang Redis/Vercel Cache,
 * giữ nguyên 3 hàm public.
 */

import type { MonthlyFinancialSnapshot } from '../aggregation/types';

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 phút
export const MAX_TURNS = 8;

export interface ConversationTurn {
  /** ISO timestamp lượt chat. */
  at: string;
  intent: string;
  userMessage: string;
  assistantMessage: string;
  tokensUsed: number;
}

export interface ConversationContext {
  sessionId: string;
  uid: string;
  /** Snapshot chốt ở turn đầu — dùng lại cho mọi follow-up trong phiên. */
  snapshot: MonthlyFinancialSnapshot;
  snapshotAt: string;
  turns: ConversationTurn[];
  /** Mốc hết hạn tuyệt đối (ISO). */
  expiresAt: string;
}

/**
 * STORE đặt trên globalThis qua Symbol.for để:
 *  1) Chống Next.js dev hot-reload tạo nhiều instance module (mất session).
 *  2) Đảm bảo mọi đường import (alias '@/...' vs relative '../...') chia sẻ chung
 *     một Map duy nhất.
 */
const STORE_KEY = Symbol.for('manicash.aiMoneyChat.conversationStore');
type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: Map<string, ConversationContext>;
};

function store(): Map<string, ConversationContext> {
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

/**
 * Khởi tạo (hoặc reset) phiên với snapshot mới. Gọi ở turn đầu khi tạo CFO report.
 * Ghi đè phiên cũ cùng sessionId — báo cáo mới = ngữ cảnh nền mới.
 */
export function createSession(
  sessionId: string,
  uid: string,
  snapshot: MonthlyFinancialSnapshot,
): ConversationContext {
  const at = nowMs();
  const ctx: ConversationContext = {
    sessionId,
    uid,
    snapshot,
    snapshotAt: new Date(at).toISOString(),
    turns: [],
    expiresAt: new Date(at + SESSION_TTL_MS).toISOString(),
  };
  store().set(sessionId, ctx);
  return ctx;
}

/**
 * Lấy phiên hiện có. Nếu hết hạn hoặc không thuộc uid -> purge + trả null.
 * (KHÔNG tự tạo phiên mới — createSession là cổng tạo riêng.)
 */
export function getOrCreateSession(sessionId: string, uid: string): ConversationContext | null {
  const ctx = store().get(sessionId);
  if (!ctx) return null;

  if (isExpired(ctx)) {
    store().delete(sessionId); // purge hết hạn
    return null;
  }

  // Chống rò rỉ chéo người dùng.
  if (ctx.uid !== uid) return null;

  return ctx;
}

/**
 * Đẩy một lượt chat vào phiên. Cap MAX_TURNS (bỏ lượt cũ nhất), gia hạn TTL 30 phút.
 * No-op nếu phiên không tồn tại.
 */
export function appendTurn(sessionId: string, turn: ConversationTurn): void {
  const ctx = store().get(sessionId);
  if (!ctx) return;

  ctx.turns.push(turn);
  if (ctx.turns.length > MAX_TURNS) {
    ctx.turns.splice(0, ctx.turns.length - MAX_TURNS);
  }
  ctx.expiresAt = new Date(nowMs() + SESSION_TTL_MS).toISOString(); // gia hạn
}

/** Dọn các phiên hết hạn (gọi định kỳ hoặc lazy). Trả số phiên đã xóa. */
export function purgeExpired(): number {
  const at = nowMs();
  let purged = 0;
  for (const [id, ctx] of Array.from(store().entries())) {
    if (isExpired(ctx, at)) {
      store().delete(id);
      purged += 1;
    }
  }
  return purged;
}

/* ─────────── Test helpers ─────────── */

export function __clearConversationStoreForTest(): void {
  store().clear();
}

/** Ép một phiên hết hạn (backdate) để test nhánh purge. */
export function __expireSessionForTest(sessionId: string): void {
  const ctx = store().get(sessionId);
  if (ctx) ctx.expiresAt = new Date(nowMs() - 1000).toISOString();
}
