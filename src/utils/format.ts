// src/utils/format.ts

/**
 * Định dạng tiền tệ VND chuẩn (VD: 1.000.000 ₫)
 */
export const formatVND = (amount: number): string => {
  if (amount === undefined || amount === null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Định dạng chuỗi số với dấu chấm phân cách hàng nghìn khi đang gõ (VD: 1.000)
 */
export const formatNumberInput = (val: string | number): string => {
  if (val === undefined || val === null || val === '') return '';
  // Loại bỏ tất cả ký tự không phải số
  const numStr = String(val).replace(/\D/g, '');
  if (!numStr) return '';
  // Định dạng lại và đảm bảo dùng dấu chấm làm phân cách hàng nghìn
  return new Intl.NumberFormat('vi-VN').format(Number(numStr)).replace(/,/g, '.');
};

/**
 * Chuyển đổi chuỗi định dạng (có dấu chấm) về số nguyên để tính toán
 */
export const parseNumberInput = (val: string | number): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  // Loại bỏ dấu chấm và các ký tự lạ để ép về kiểu Number
  const cleanStr = val.replace(/\./g, '').replace(/[^\d]/g, '');
  return Number(cleanStr) || 0;
};

/**
 * Rút gọn số tiền cho giao diện nhỏ (VD: 1.5M, 20k)
 */
export const formatCompactNumber = (num: number): string => {
  if (!num || num === 0) return '';
  
  if (num >= 1000000) {
    const val = num / 1000000;
    // Nếu là số nguyên thì không hiện .0, nếu lẻ thì hiện 1 chữ số thập phân
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'M';
  }
  
  if (num >= 1000) {
    const val = num / 1000;
    return val.toFixed(0) + 'k';
  }
  
  return num.toString();
};
