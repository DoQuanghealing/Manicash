/* ═══ AI Money Chat — Amount Parser (Phase 4A) ═══
 * Deterministic. KHÔNG dùng LLM để suy ra số tiền.
 * Hỗ trợ: 50k, 500 nghìn/ngàn/ngan, 1 triệu/trieu, 1tr5, 2.5 triệu, 15tr, 1.500.000.
 */

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function toNumber(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

export function parseMoneyAmount(text: string): number | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = fold(text);

  // 1) Triệu / tr (+ optional single trailing digit = hàng trăm nghìn). VD 1tr5 = 1.500.000.
  const trMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)(?![a-z])\s*(\d)?/);
  if (trMatch) {
    const base = toNumber(trMatch[1]) * 1_000_000;
    const extra = trMatch[2] ? parseInt(trMatch[2], 10) * 100_000 : 0;
    const val = Math.round(base + extra);
    return val > 0 ? val : null;
  }

  // 2) Nghìn / ngàn / ngan / k.
  const kMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:nghin|ngan|k)(?![a-z])/);
  if (kMatch) {
    const val = Math.round(toNumber(kMatch[1]) * 1_000);
    return val > 0 ? val : null;
  }

  // 3) Số nhóm hàng nghìn: 1.500.000 hoặc 1,500,000.
  const grouped = t.match(/(\d{1,3}(?:[.,]\d{3})+)/);
  if (grouped) {
    const val = parseInt(grouped[1].replace(/[.,]/g, ''), 10);
    return val > 0 ? val : null;
  }

  // 4) Số trần >= 1000 (kèm đ/dong/vnd tuỳ chọn). Tránh nuốt số ngày nhỏ.
  const bare = t.match(/(\d{4,})\s*(?:d|dong|vnd)?(?![a-z0-9])/);
  if (bare) {
    const val = parseInt(bare[1], 10);
    return val > 0 ? val : null;
  }

  return null;
}
