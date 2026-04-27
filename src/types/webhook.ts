/* ═══ SMS Webhook Types ═══
 * Shared types giữa server (API route + Firebase Admin) và client (hook + UI).
 */

export type BankCode =
  | 'vietcombank'
  | 'techcombank'
  | 'mbbank'
  | 'tpbank'
  | 'vpbank'
  | 'acb'
  | 'sacombank';

/** Tên hiển thị cho UI. */
export const BANK_NAMES: Record<BankCode, string> = {
  vietcombank: 'Vietcombank',
  techcombank: 'Techcombank',
  mbbank: 'MB Bank',
  tpbank: 'TPBank',
  vpbank: 'VPBank',
  acb: 'ACB',
  sacombank: 'Sacombank',
};

/** Payload mà MacroDroid/iOS Shortcut POST tới /api/sms-webhook. */
export interface WebhookPayload {
  /** Webhook secret token, format `mc_<43 base64url chars>`. */
  token: string;
  /** Sender ID raw từ điện thoại (vd "VCB", "Vietcombank"). */
  sender: string;
  /** Nội dung SMS đầy đủ. */
  body: string;
  /** ISO timestamp khi SMS nhận. Optional — fallback Date.now() server. */
  receivedAt?: string;
  /** Client-supplied dedupe key (string bất kỳ). Server hash → SHA256 32 chars. */
  messageId?: string;
}

/** Status code phân loại trong response 200. */
export type WebhookStatus = 'captured' | 'ignored' | 'deduped';

export interface WebhookSuccessResponse {
  status: WebhookStatus;
  /** ID của pending transaction được tạo — chỉ có khi status='captured'. */
  pendingTxId?: string;
  /** Lý do ignored — vd 'not_a_transaction_sms'. */
  reason?: string;
}

export type WebhookErrorCode =
  | 'invalid_payload'
  | 'invalid_token'
  | 'unparseable_sms'
  | 'rate_limit'
  | 'server_error';

export interface WebhookErrorResponse {
  error: string;
  code: WebhookErrorCode;
}

/** Document tại `users/{uid}/pending_transactions/{id}`. */
export interface PendingTransaction {
  id: string;
  userId: string;
  bankCode: BankCode;
  type: 'income' | 'expense';
  amount: number;
  /** Số dư sau giao dịch — null nếu SMS không có. */
  balance: number | null;
  /** Mô tả raw từ SMS (merchant name + ref code). */
  description: string;
  /** Predict từ categoryPredictor — null nếu không match rule nào. */
  predictedCategoryId: string | null;
  /** 0-1 confidence từ predictor. */
  confidence: number;
  /** ISO timestamp giao dịch xảy ra (theo SMS hoặc receivedAt). */
  receivedAt: string;
  /** Sender ID raw — debug + reproduce. */
  rawSender: string;
  /** Body raw — debug + cho phép user verify. */
  rawBody: string;
  /** Server timestamp khi pending tx được tạo. */
  createdAt: string;
}

/** Document tại `webhook_tokens/{uid}`. */
export interface WebhookToken {
  userId: string;
  token: string;
  createdAt: string;
  rotatedAt: string;
}
