/* ═══ PayOS — helper THUẦN (test độc lập, no SDK/firebase) ═══ */

/** Max orderCode PayOS chấp nhận (số nguyên ≤ Number.MAX_SAFE_INTEGER). */
export const ORDER_CODE_MAX = 9_007_199_254_740_991;

/**
 * Sinh orderCode (số nguyên dương, duy nhất-tương đối). = giây-epoch×10000 + rand(0..9999).
 * Đủ nhỏ (<~1.8e13) so với MAX_SAFE_INTEGER; trùng (cùng giây+cùng rand) được chặn ở
 * tầng ghi payment_intents bằng transaction.create() → sinh lại.
 */
export function makeOrderCode(nowMs: number, rand: number): number {
  const secs = Math.floor(nowMs / 1000);
  return secs * 10000 + (Math.abs(Math.floor(rand)) % 10000);
}

/** Webhook PayOS = thanh toán THÀNH CÔNG? (chỉ code '00' + success mới cấp Pro). */
export function isPaidWebhook(
  webhook: { code?: string; success?: boolean; data?: { code?: string } | null } | null | undefined,
): boolean {
  return webhook?.success === true && webhook?.code === '00' && webhook?.data?.code === '00';
}
