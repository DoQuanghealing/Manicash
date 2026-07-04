/* ═══ Feature Flags — single source of truth cho mọi feature flag client-side ═══
 *
 * Mỗi flag đọc từ NEXT_PUBLIC_* env var.
 * Mặc định OFF cho tất cả — bật từng flag khi sẵn sàng production.
 *
 * Tại sao không để mặc định ON trong dev:
 *   - SMS Webhook cần thiết bị Android + MacroDroid; chạy dev không có nghĩa gì.
 *   - AI Chat đã có flag riêng trong featureFlag.ts (giữ tương thích ngược).
 */

/** SMS Webhook Banking — ẩn cho v1, bật lại ở Phase 7+ khi xác minh xong. */
export function isSmsWebhookEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SMS_WEBHOOK_ENABLED === 'true';
}