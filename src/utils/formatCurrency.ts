/* ═══ Format Vietnamese currency ═══ */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + 'đ';
}

export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1).replace('.0', '') + ' triệu';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(0) + 'k';
  }
  return amount + 'đ';
}

/**
 * Định dạng số tiền NGAY KHI GÕ: bỏ mọi ký tự không phải chữ số rồi chấm phân
 * cách nghìn kiểu Việt ("100000000" → "100.000.000").
 *
 * Ô nhập dùng hàm này BẮT BUỘC là `type="text"` + `inputMode="numeric"`.
 * `type="number"` KHÔNG hiển thị được dấu chấm — trình duyệt chỉ nhận chuỗi số
 * thuần, gán chuỗi có dấu chấm vào là ô rỗng trắng. Đó đúng là lý do hai form
 * Mục tiêu và Nhiệm vụ trước đây không chấm được.
 *
 * Nơi lưu vẫn phải tự lọc `\D` — đừng tin chuỗi hiển thị.
 */
export function formatAmountInput(raw: string, maxDigits = 15): string {
  const digits = raw.replace(/\D/g, '').slice(0, maxDigits);
  return digits ? parseInt(digits, 10).toLocaleString('vi-VN') : '';
}
