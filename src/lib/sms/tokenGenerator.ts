/* ═══ Webhook Token Generator ═══
 * Pure utility — generate + validate format + hash messageId.
 * Server-side only (uses node:crypto). KHÔNG import từ client code.
 */

import { randomBytes, createHash } from 'crypto';

const TOKEN_PREFIX = 'mc_';
const TOKEN_BYTES = 32;
// 32 bytes base64url ≈ 43 chars (32 * 8 / 6 ≈ 42.67, no padding).
const TOKEN_REGEX = /^mc_[A-Za-z0-9_-]{43}$/;

/** Generate cryptographically secure webhook token. */
export function generateToken(): string {
  const random = randomBytes(TOKEN_BYTES).toString('base64url');
  return `${TOKEN_PREFIX}${random}`;
}

/**
 * Type guard cho token format. Chỉ kiểm tra shape, KHÔNG kiểm tra ownership.
 * Caller phải lookup Firestore để verify token thuộc về user nào.
 */
export function validateTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_REGEX.test(token);
}

/**
 * Hash messageId thành 32 hex chars để dùng làm Firestore doc ID.
 * Tránh control chars + length cap trong path.
 *
 * Dùng cho dedupe collection `webhook_tokens/{uid}/recent_msgs/{hash}`.
 */
export function hashMessageId(messageId: string): string {
  return createHash('sha256').update(messageId).digest('hex').slice(0, 32);
}
