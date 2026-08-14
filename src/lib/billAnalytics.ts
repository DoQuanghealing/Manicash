/* ═══ billAnalytics — trạng thái hạn đóng + lịch sử hóa đơn ═══
 *
 * Thuần (pure), không đụng store. Mọi phép so ngày dùng giờ ĐỊA PHƯƠNG.
 */

import type { BillPayment, FixedBill } from '@/stores/useFinanceStore';

/** Mức độ gấp của một hóa đơn — quyết định màu chữ trên thẻ. */
export type BillDueTone = 'paid' | 'overdue' | 'urgent' | 'soon' | 'later';

export interface BillDueStatus {
  tone: BillDueTone;
  /** Câu hiện trên thẻ: "Đã thanh toán" · "Còn 3 ngày" · "Quá hạn 2 ngày"… */
  label: string;
  /** Số ngày còn lại tới hạn (âm = đã quá hạn). null nếu đã đóng. */
  daysLeft: number | null;
}

/** Ngưỡng PO chốt: còn ≤3 ngày là gấp (cam), ≤7 ngày là sắp tới (xanh). */
export const URGENT_DAYS = 3;
export const SOON_DAYS = 7;

/**
 * Trạng thái hạn của 1 hóa đơn trong tháng đang xem.
 * Hạn rơi vào ngày không tồn tại (30/2) sẽ lùi về ngày cuối tháng.
 */
export function getBillDueStatus(bill: FixedBill, now: Date = new Date()): BillDueStatus {
  if (bill.isPaid) return { tone: 'paid', label: 'Đã thanh toán', daysLeft: null };

  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueDay = Math.min(bill.dueDay, lastDayOfMonth);
  const today = now.getDate();
  const daysLeft = dueDay - today;

  if (daysLeft < 0) {
    return { tone: 'overdue', label: `Quá hạn ${Math.abs(daysLeft)} ngày`, daysLeft };
  }
  if (daysLeft === 0) {
    return { tone: 'urgent', label: 'Tới hạn hôm nay', daysLeft };
  }
  if (daysLeft <= URGENT_DAYS) {
    return { tone: 'urgent', label: `Còn ${daysLeft} ngày`, daysLeft };
  }
  if (daysLeft <= SOON_DAYS) {
    return { tone: 'soon', label: `Còn ${daysLeft} ngày`, daysLeft };
  }
  return { tone: 'later', label: `Hạn ngày ${dueDay}`, daysLeft };
}

export interface BillMonthPoint {
  month: string;      // 'YYYY-MM'
  label: string;      // 'T1'…'T12'
  amount: number;
  /** % chênh so với THÁNG GẦN NHẤT CÓ ĐÓNG trước đó. null nếu chưa có mốc so. */
  changePercent: number | null;
  isCurrent: boolean;
}

/**
 * 12 tháng của `year` cho 1 hóa đơn: đóng bao nhiêu, tăng/giảm bao nhiêu %.
 * Tháng không đóng → amount 0 và KHÔNG dùng làm mốc so sánh (tránh -100% giả).
 */
export function buildBillYearSeries(
  payments: BillPayment[],
  billId: string,
  year: number,
  now: Date = new Date(),
): BillMonthPoint[] {
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (p.billId !== billId) continue;
    if (!p.month.startsWith(String(year))) continue;
    byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);
  }

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const points: BillMonthPoint[] = [];
  let lastPaid: number | null = null;

  for (let m = 0; m < 12; m++) {
    const month = `${year}-${String(m + 1).padStart(2, '0')}`;
    const amount = byMonth.get(month) ?? 0;
    const changePercent =
      amount > 0 && lastPaid !== null && lastPaid > 0
        ? Math.round(((amount - lastPaid) / lastPaid) * 1000) / 10
        : null;
    points.push({
      month,
      label: `T${m + 1}`,
      amount,
      changePercent,
      isCurrent: month === currentMonthKey,
    });
    if (amount > 0) lastPaid = amount;
  }

  return points;
}

export interface BillSlice {
  billId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percent: number;
}

/** Bảng màu cho hóa đơn — hóa đơn không có màu riêng như danh mục chi tiêu. */
export const BILL_COLORS = [
  '#F59E0B', // hổ phách
  '#6366F1', // chàm
  '#10B981', // ngọc lục bảo
  '#EC4899', // hồng
  '#0EA5E9', // xanh trời
  '#F97316', // cam
  '#8B5CF6', // tím
  '#14B8A6', // xanh mòng két
];

/** Chia hóa đơn thành các cung tròn, mỗi hóa đơn một màu cố định theo thứ tự. */
export function buildBillSlices(bills: FixedBill[]): BillSlice[] {
  const total = bills.reduce((s, b) => s + b.amount, 0);
  if (total === 0) return [];
  return bills
    .map((b, i) => ({
      billId: b.id,
      name: b.name,
      icon: b.icon,
      color: BILL_COLORS[i % BILL_COLORS.length],
      amount: b.amount,
      percent: Math.round((b.amount / total) * 1000) / 10,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Hóa đơn cố định ngốn bao nhiêu phần thu nhập tháng.
 * Thu nhập 0 → trả null để giao diện nói "chưa có thu nhập" thay vì chia cho 0.
 */
export function getBillShareOfIncome(totalBills: number, monthlyIncome: number): number | null {
  if (monthlyIncome <= 0) return null;
  return Math.round((totalBills / monthlyIncome) * 1000) / 10;
}
