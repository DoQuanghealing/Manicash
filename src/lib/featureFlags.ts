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

/**
 * Mô hình 3-tài-khoản (core/finance ledger). CHƯA hoàn thiện:
 *  - useFinanceCoreStore không persist → ledger rỗng mỗi lần mở app.
 *  - Không có bước hydrate ledger từ số dư store cũ.
 * Giữ OFF để account-overview snapshot LUÔN đọc số dư store cũ (đúng). Nếu bật khi
 * ledger chỉ có vài bút toán của phiên hiện tại, số dư sẽ "lật" về delta phiên →
 * hiện sai (vd billFund 500k → 0 ngay sau 1 giao dịch). Chỉ bật khi migrate xong
 * (thêm persist + hydrate cho useFinanceCoreStore).
 */
export function isThreeAccountModelEnabled(): boolean {
  return process.env.NEXT_PUBLIC_THREE_ACCOUNT_MODEL === 'true';
}
