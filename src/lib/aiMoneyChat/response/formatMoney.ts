/* ═══ AI Money Chat — Response format helpers (Phase 2) ═══
 * Định dạng tiền/phần trăm/list nhất quán cho mọi handler deterministic.
 */

const DECIMAL_FORMATTER = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

/** Định dạng tiền VND kiểu "1.500.000đ" (âm: "-500.000đ"). */
export function formatVND(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${DECIMAL_FORMATTER.format(n)}đ`;
}

/**
 * Định dạng phần trăm: số nguyên không hiện thập phân ("24%"),
 * số lẻ giữ 1 chữ số thập phân ("23.5%").
 */
export function formatPercent(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(v * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(1)}%`;
}

/** Danh sách bullet "- item" mỗi dòng. */
export function bulletList(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}
