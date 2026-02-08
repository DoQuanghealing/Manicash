
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
