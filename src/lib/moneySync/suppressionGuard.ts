/* ═══ Money Sync — System-Apply Suppression Guard (Phase 6B-2D) ═══
 * Cho phép runtime phân biệt:
 *   - user sửa dữ liệu thật → handleStoreChange ENQUEUE outbox
 *   - system apply remote/merged vào store → KHÔNG enqueue (suppressed)
 *
 * Thiết kế:
 *   - Counter-based (re-entrant safe): nested apply không tắt sớm.
 *   - runWithSuppression tự tắt kể cả khi callback throw (finally).
 *   - Thuần, không React/Zustand → unit-test trực tiếp.
 */

let depth = 0;

/** Tăng mức suppression (re-entrant). */
export function beginSystemApply(): void {
  depth++;
}

/** Giảm mức suppression. Không bao giờ xuống âm. */
export function endSystemApply(): void {
  if (depth > 0) depth--;
}

/** True khi đang trong vùng system apply (runtime sẽ bỏ qua enqueue). */
export function isSystemApplying(): boolean {
  return depth > 0;
}

/** Hard-reset (dùng cho account boundary / test teardown). */
export function resetSuppression(): void {
  depth = 0;
}

/**
 * Chạy fn trong vùng suppression. Tự tắt suppression dù fn throw.
 * Trả về giá trị fn. Dùng cho cả apply lẫn rollback (rollback cũng không enqueue).
 */
export function runWithSuppression<T>(fn: () => T): T {
  beginSystemApply();
  try {
    return fn();
  } finally {
    endSystemApply();
  }
}
