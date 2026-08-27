/* ═══ expenseBreakdown — gom chi tiêu theo kỳ (ngày/tuần/tháng/năm) ═══
 *
 * Thuần (pure), không đụng store — để màn Chi tiêu đổi mốc so sánh mà vẫn kiểm
 * thử được. Mọi phép so ngày dùng giờ ĐỊA PHƯƠNG: người dùng nghĩ theo lịch
 * treo tường của họ, không phải theo UTC.
 */

import type { Transaction } from '@/stores/useFinanceStore';
import { EXPENSE_CATEGORIES } from '@/data/categories';

export type ExpensePeriod = 'day' | 'week' | 'month' | 'year';

export const EXPENSE_PERIODS: { id: ExpensePeriod; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];

/** Nhãn cho ô tổng ứng với từng mốc. */
export const PERIOD_TOTAL_LABEL: Record<ExpensePeriod, string> = {
  day: 'Tổng chi hôm nay',
  week: 'Tổng chi tuần này',
  month: 'Tổng chi tháng này',
  year: 'Tổng chi năm nay',
};

/** Nhãn cho dải cột so sánh. */
export const PERIOD_CHART_TITLE: Record<ExpensePeriod, string> = {
  day: '7 ngày gần nhất',
  week: '6 tuần gần nhất',
  month: '12 tháng năm nay',
  year: '4 năm gần nhất',
};

export interface ExpenseBucket {
  key: string;
  /** Dòng trên của trục (T2, W32, Th 8, 2026). */
  label: string;
  /** Dòng dưới của trục (13/8, 5–11/8…). Rỗng nếu không cần. */
  sub: string;
  amount: number;
  /** true = cột của kỳ HIỆN TẠI (tô đậm). */
  isCurrent: boolean;
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  /** % trên tổng chi của kỳ (làm tròn 1 số lẻ). */
  percent: number;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
/** Màu cho danh mục lạ (không có trong EXPENSE_CATEGORIES). */
const FALLBACK_COLOR = '#94A3B8';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Đầu tuần theo kiểu Việt Nam: THỨ HAI. */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const offset = (s.getDay() + 6) % 7; // CN=0 -> 6, T2=1 -> 0
  s.setDate(s.getDate() - offset);
  return s;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Ngày của giao dịch theo giờ địa phương. */
function txnDate(txn: Transaction): Date {
  return new Date(txn.date);
}

function dmy(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Khoảng [từ, đến) của kỳ hiện tại ứng với `period`. */
export function getPeriodRange(period: ExpensePeriod, now: Date): { from: Date; to: Date } {
  const to = addDays(startOfDay(now), 1); // hết ngày hôm nay
  if (period === 'day') return { from: startOfDay(now), to };
  if (period === 'week') return { from: startOfWeek(now), to };
  if (period === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  return { from: new Date(now.getFullYear(), 0, 1), to };
}

/** Chỉ lấy giao dịch CHI nằm trong kỳ, mới nhất trước. */
export function filterExpensesForPeriod(
  transactions: Transaction[],
  period: ExpensePeriod,
  now: Date = new Date(),
): Transaction[] {
  const { from, to } = getPeriodRange(period, now);
  return transactions
    .filter((t) => t.type === 'expense')
    .filter((t) => {
      const d = txnDate(t);
      return d >= from && d < to;
    })
    .sort((a, b) => txnDate(b).getTime() - txnDate(a).getTime());
}

/** Tổng chi của kỳ hiện tại. */
export function getPeriodTotal(
  transactions: Transaction[],
  period: ExpensePeriod,
  now: Date = new Date(),
): number {
  return filterExpensesForPeriod(transactions, period, now).reduce((s, t) => s + t.amount, 0);
}

/** Một ô trên trục thời gian, kèm khoảng [from, to) để gom giao dịch vào. */
export interface PeriodSlot extends Omit<ExpenseBucket, 'amount'> {
  from: Date;
  to: Date;
}

/**
 * Khung trục thời gian cho một mốc — CHƯA gắn số tiền.
 *   ngày  → 7 ngày · tuần → 6 tuần · tháng → 12 tháng · năm → 4 năm
 *
 * Tách riêng vì biểu đồ thu nhập, chi tiêu và ngưỡng phải chia kỳ GIỐNG HỆT
 * nhau; hai bản sao của "tuần bắt đầu từ thứ mấy" là mầm lệch số về sau.
 */
export function buildPeriodSlots(period: ExpensePeriod, now: Date = new Date()): PeriodSlot[] {
  const buckets: PeriodSlot[] = [];

  if (period === 'day') {
    for (let i = 6; i >= 0; i--) {
      const from = addDays(startOfDay(now), -i);
      buckets.push({
        key: `d-${from.toDateString()}`,
        label: WEEKDAYS[from.getDay()],
        sub: dmy(from),
        isCurrent: i === 0,
        from,
        to: addDays(from, 1),
      });
    }
  } else if (period === 'week') {
    const thisWeek = startOfWeek(now);
    for (let i = 5; i >= 0; i--) {
      const from = addDays(thisWeek, -i * 7);
      const to = addDays(from, 7);
      buckets.push({
        key: `w-${from.toDateString()}`,
        label: i === 0 ? 'Tuần này' : `${dmy(from)}`,
        sub: i === 0 ? dmy(from) : `→ ${dmy(addDays(to, -1))}`,
        isCurrent: i === 0,
        from,
        to,
      });
    }
  } else if (period === 'month') {
    const year = now.getFullYear();
    for (let m = 0; m < 12; m++) {
      const from = new Date(year, m, 1);
      buckets.push({
        key: `m-${year}-${m}`,
        label: `T${m + 1}`,
        sub: '',
        isCurrent: m === now.getMonth(),
        from,
        to: new Date(year, m + 1, 1),
      });
    }
  } else {
    const year = now.getFullYear();
    for (let i = 3; i >= 0; i--) {
      const y = year - i;
      buckets.push({
        key: `y-${y}`,
        label: `${y}`,
        sub: '',
        isCurrent: i === 0,
        from: new Date(y, 0, 1),
        to: new Date(y + 1, 0, 1),
      });
    }
  }

  return buckets;
}

/**
 * Dải cột so sánh chi tiêu: mỗi mốc nhìn lại vài kỳ liền trước để thấy xu hướng.
 */
export function buildExpenseBuckets(
  transactions: Transaction[],
  period: ExpensePeriod,
  now: Date = new Date(),
): ExpenseBucket[] {
  const slots = buildPeriodSlots(period, now);
  const totals = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.type !== 'expense') continue;
    const d = txnDate(txn);
    const slot = slots.find((b) => d >= b.from && d < b.to);
    if (slot) totals.set(slot.key, (totals.get(slot.key) ?? 0) + txn.amount);
  }

  return slots.map((s) => ({
    key: s.key,
    label: s.label,
    sub: s.sub,
    isCurrent: s.isCurrent,
    amount: totals.get(s.key) ?? 0,
  }));
}

/**
 * Phân bổ chi tiêu theo danh mục trong kỳ — dữ liệu cho biểu đồ tròn.
 * Sắp theo số tiền giảm dần; danh mục 0đ bị loại.
 */
export function buildCategoryBreakdown(
  transactions: Transaction[],
  period: ExpensePeriod,
  now: Date = new Date(),
): CategorySlice[] {
  const inPeriod = filterExpensesForPeriod(transactions, period, now);
  const total = inPeriod.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return [];

  const sums = new Map<string, number>();
  for (const txn of inPeriod) {
    sums.set(txn.categoryId, (sums.get(txn.categoryId) ?? 0) + txn.amount);
  }

  return [...sums.entries()]
    .map(([categoryId, amount]) => {
      const meta = EXPENSE_CATEGORIES.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: meta?.name ?? categoryId,
        icon: meta?.icon ?? '📦',
        color: meta?.color ?? FALLBACK_COLOR,
        amount,
        percent: Math.round((amount / total) * 1000) / 10,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Toạ độ cung tròn cho biểu đồ vành khuyên (SVG).
 * Nhận bất cứ lát nào có { color, percent } — dùng chung cho phân bổ chi tiêu
 * lẫn cơ cấu hóa đơn. Trả { color, dash, offset } cho stroke-dasharray.
 */
export function buildDonutSegments(
  slices: { color: string; percent: number }[],
  circumference: number,
): { color: string; dash: string; offset: number }[] {
  let acc = 0;
  return slices.map((s) => {
    const len = (s.percent / 100) * circumference;
    const seg = {
      color: s.color,
      dash: `${len} ${circumference - len}`,
      // Cung đầu bắt đầu ở 12h (nhờ rotate -90 trên <svg>), các cung sau nối tiếp.
      // `acc === 0 ? 0` để tránh -0 lọt vào thuộc tính SVG.
      offset: acc === 0 ? 0 : -acc,
    };
    acc += len;
    return seg;
  });
}
