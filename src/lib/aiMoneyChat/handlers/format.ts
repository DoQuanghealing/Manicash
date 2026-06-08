/* ═══ AI Money Chat — Handler format helpers (Phase 2) ═══ */

const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/** Định dạng tiền VND chuẩn vi-VN, vd 30000 -> "30.000 ₫". */
export function formatVnd(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return VND_FORMATTER.format(Math.round(n));
}
