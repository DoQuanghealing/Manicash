
export const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
};

// Định dạng chuỗi số với dấu chấm phân cách hàng nghìn khi đang gõ
export const formatNumberInput = (val: string | number): string => {
  const numStr = String(val).replace(/\./g, '').replace(/[^\d]/g, '');
  if (!numStr) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(numStr)).replace(/,/g, '.');
};

// Chuyển đổi chuỗi định dạng (có dấu chấm) về số nguyên để tính toán
export const parseNumberInput = (val: string): number => {
  if (!val) return 0;
  return Number(val.replace(/\./g, '')) || 0;
};

// Rút gọn số tiền cho giao diện nhỏ (Lịch)
export const formatCompactNumber = (num: number): string => {
  if (!num || num === 0) return '';
  if (num >= 1000000) {
    const val = num / 1000000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'M';
  }
  if (num >= 1000) {
    const val = num / 1000;
    return val.toFixed(0) + 'k';
  }
  return num.toString();
};
