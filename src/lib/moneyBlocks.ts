/* ═══ moneyBlocks — số liệu cho cụm 3 khối Thu nhập · Chi tiêu · Tiết kiệm ═══
 *
 * Thuần (pure), không đụng store — giao diện chỉ vẽ, mọi phép tính nằm ở đây và
 * kiểm thử được. Trục thời gian tái dùng `buildPeriodSlots` của expenseBreakdown
 * để biểu đồ thu nhập và chi tiêu KHÔNG BAO GIỜ lệch mốc nhau.
 *
 * ⚠️ `Transaction.method` là tùy chọn: giao dịch nhập trước 15/08/2026 không có
 * trường này. Theo chú thích ở store, THIẾU = chuyển khoản. Nghĩa là đường "tiền
 * mặt" sẽ bằng 0 ở giai đoạn dữ liệu cũ — đó là sự thật của dữ liệu, không phải
 * lỗi vẽ. Đừng "sửa" bằng cách đoán ngược.
 */

import type { BillPayment, Transaction } from '@/stores/useFinanceStore';
import { INCOME_CATEGORIES } from '@/data/categories';
import { buildPeriodSlots, type ExpensePeriod } from './expenseBreakdown';

/** Màu hai túi tiền — PO chốt: tiền mặt cam, tiền trong tài khoản xanh. */
export const CASH_COLOR = '#F97316';
export const BANK_COLOR = '#3B82F6';

/** Thiếu `method` = chuyển khoản (xem chú thích đầu file). */
function isCash(txn: Transaction): boolean {
  return txn.method === 'cash';
}

// ─────────────────────────── Thu nhập: tiền mặt vs ngân hàng ───────────────────────────

export interface IncomePoint {
  key: string;
  label: string;
  sub: string;
  cash: number;
  bank: number;
  total: number;
  isCurrent: boolean;
}

/**
 * Chuỗi thu nhập theo kỳ, tách hai túi — dữ liệu cho biểu đồ hai đường.
 * Kỳ không có giao dịch vẫn giữ chỗ (amount 0) để trục thời gian liền mạch.
 */
export function buildIncomeSeries(
  transactions: Transaction[],
  period: ExpensePeriod,
  now: Date = new Date(),
): IncomePoint[] {
  const slots = buildPeriodSlots(period, now);
  const cash = new Map<string, number>();
  const bank = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.type !== 'income') continue;
    const d = new Date(txn.date);
    const slot = slots.find((s) => d >= s.from && d < s.to);
    if (!slot) continue;
    const bucket = isCash(txn) ? cash : bank;
    bucket.set(slot.key, (bucket.get(slot.key) ?? 0) + txn.amount);
  }

  return slots.map((s) => {
    const c = cash.get(s.key) ?? 0;
    const b = bank.get(s.key) ?? 0;
    return { key: s.key, label: s.label, sub: s.sub, isCurrent: s.isCurrent, cash: c, bank: b, total: c + b };
  });
}

// ─────────────────────────── Mảnh ghép thu nhập ───────────────────────────

export interface IncomeSlice {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percent: number;
}

/**
 * Thu nhập tháng này đến từ đâu — dữ liệu cho vành khuyên "mảnh ghép thu nhập".
 * Khác `buildCategoryBreakdown` (chỉ gom khoản CHI): ở đây gom khoản THU và tra
 * bảng danh mục thu, vì lương/làm thêm/bán đồ nằm ở danh sách riêng.
 */
export function buildIncomeBreakdown(
  transactions: Transaction[],
  period: ExpensePeriod,
  now: Date = new Date(),
): IncomeSlice[] {
  const slots = buildPeriodSlots(period, now);
  const cur = slots.find((s) => s.isCurrent);
  if (!cur) return [];

  const sums = new Map<string, number>();
  let total = 0;
  for (const txn of transactions) {
    if (txn.type !== 'income') continue;
    const d = new Date(txn.date);
    if (d < cur.from || d >= cur.to) continue;
    sums.set(txn.categoryId, (sums.get(txn.categoryId) ?? 0) + txn.amount);
    total += txn.amount;
  }
  if (total === 0) return [];

  return [...sums.entries()]
    .map(([categoryId, amount]) => {
      const meta = INCOME_CATEGORIES.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: meta?.name ?? categoryId,
        icon: meta?.icon ?? '💵',
        color: meta?.color ?? '#6B7280',
        amount,
        percent: Math.round((amount / total) * 1000) / 10,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Góc bắt đầu để cung "còn lại" nằm CHÍNH GIỮA ĐÁY vòng tròn.
 *
 * Giao diện có một mũi tên vẽ cứng chỉ thẳng lên đáy vành khuyên với nhãn
 * "chưa chi — còn lại". Nếu vòng tròn cứ bắt đầu ở 12 giờ thì cung còn lại kết
 * thúc ở đỉnh, và mũi tên chỉ vào một lát ĐÃ CHI — tức hình vẽ nói sai.
 *
 * conic-gradient tính góc từ 12 giờ, thuận chiều kim đồng hồ. Cung còn lại chiếm
 * đoạn cuối, tâm của nó nằm ở (100 − restPercent/2) × 3.6 độ kể từ mốc bắt đầu.
 * Ép tâm đó về 180° (đáy) ⇒ from = restPercent × 1.8 − 180.
 */
export function restAnchoredStartAngle(restPercent: number): number {
  return ((restPercent * 1.8 - 180) % 360 + 360) % 360;
}

/**
 * Chuỗi `conic-gradient` cho vành khuyên dựng bằng CSS (không phải SVG).
 * `restColor` lấp phần còn thiếu khi tổng lát chưa đủ 100% — ví dụ phần chưa chi.
 * Không truyền `fromDeg` thì tự xoay để cung còn lại rơi xuống đáy (xem trên).
 */
export function buildConicGradient(
  slices: { color: string; percent: number }[],
  restColor: string,
  fromDeg?: number,
): string {
  const stops: string[] = [];
  let acc = 0;
  for (const s of slices) {
    const end = acc + s.percent;
    stops.push(`${s.color} ${acc}% ${end}%`);
    acc = end;
  }
  const rest = Math.max(0, 100 - acc);
  if (rest > 0) stops.push(`${restColor} ${acc}% 100%`);

  const from = fromDeg ?? restAnchoredStartAngle(rest);
  return `conic-gradient(from ${Math.round(from * 100) / 100}deg, ${stops.join(', ')})`;
}

// ─────────────────────────── Chi tiêu so với ngưỡng ───────────────────────────

/**
 * 'monthly'    — đã có lịch sử: cột theo tháng, so với ngưỡng từng tháng.
 * 'cumulative' — người mới chưa có tháng nào trước: cộng dồn theo NGÀY trong
 *                tháng này, để họ vẫn thấy mình đang tiến tới ngưỡng ra sao.
 */
export type SpendingChartMode = 'monthly' | 'cumulative';

export interface SpendingPoint {
  key: string;
  label: string;
  sub: string;
  /** Chi của riêng mốc này. Ở chế độ cộng dồn vẫn là chi trong NGÀY đó. */
  amount: number;
  /** Cộng dồn từ đầu kỳ tới hết mốc này. Bằng `amount` ở chế độ theo tháng. */
  cumulative: number;
  isCurrent: boolean;
  /** Đã vượt ngưỡng tại mốc này chưa (từ đây trở đi tô đỏ). */
  isOver: boolean;
  /** Vượt bao nhiêu (0 nếu chưa vượt). */
  overBy: number;
  /** Còn dư bao nhiêu dưới ngưỡng (0 nếu đã vượt). */
  savedBy: number;
  /** Mốc này có số liệu thật không — tháng tương lai/chưa tới thì false. */
  hasData: boolean;
}

export interface SpendingSeries {
  mode: SpendingChartMode;
  points: SpendingPoint[];
  threshold: number;
  /** Số mốc CÓ SỐ LIỆU đã vượt ngưỡng. */
  monthsOver: number;
  /** Tổng tiền vượt ngưỡng cộng lại. */
  totalOver: number;
  /** Tổng tiền tiết kiệm được ở các mốc dưới ngưỡng. */
  totalSaved: number;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Có ít nhất 1 khoản chi ở tháng TRƯỚC tháng đang xem không. */
export function hasPriorMonthData(transactions: Transaction[], now: Date = new Date()): boolean {
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return transactions.some((t) => t.type === 'expense' && new Date(t.date) < firstOfThisMonth);
}

/**
 * Dải cột chi tiêu kèm đường ngưỡng.
 * Tự chọn chế độ: chưa có tháng nào trước → cộng dồn theo ngày.
 * `threshold <= 0` (chưa đặt ngưỡng) vẫn vẽ được, chỉ là không mốc nào "vượt".
 */
export function buildSpendingSeries(
  transactions: Transaction[],
  threshold: number,
  now: Date = new Date(),
): SpendingSeries {
  const mode: SpendingChartMode = hasPriorMonthData(transactions, now) ? 'monthly' : 'cumulative';
  const expenses = transactions.filter((t) => t.type === 'expense');
  const points: SpendingPoint[] = [];

  if (mode === 'monthly') {
    const slots = buildPeriodSlots('month', now);
    const totals = new Map<string, number>();
    for (const txn of expenses) {
      const d = new Date(txn.date);
      const slot = slots.find((s) => d >= s.from && d < s.to);
      if (slot) totals.set(slot.key, (totals.get(slot.key) ?? 0) + txn.amount);
    }
    for (const slot of slots) {
      const amount = totals.get(slot.key) ?? 0;
      // Tháng chưa tới thì không phải "tiết kiệm được cả ngưỡng" — phải loại ra,
      // nếu không con số tiết kiệm sẽ phồng lên một cách vô nghĩa.
      const hasData = amount > 0 || slot.from <= now;
      points.push(makePoint(slot, amount, amount, threshold, hasData && slot.from <= now));
    }
  } else {
    const today = startOfDay(now);
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const perDay = new Map<string, number>();
    for (const txn of expenses) {
      const d = startOfDay(new Date(txn.date));
      if (d < firstOfMonth || d > today) continue;
      const k = d.toDateString();
      perDay.set(k, (perDay.get(k) ?? 0) + txn.amount);
    }
    let running = 0;
    for (let day = new Date(firstOfMonth); day <= today; day.setDate(day.getDate() + 1)) {
      const k = day.toDateString();
      const amount = perDay.get(k) ?? 0;
      running += amount;
      points.push(
        makePoint(
          {
            key: `d-${k}`,
            label: `${day.getDate()}`,
            sub: '',
            isCurrent: day.getTime() === today.getTime(),
          },
          amount,
          running,
          threshold,
          true,
        ),
      );
    }
  }

  const withData = points.filter((p) => p.hasData);
  return {
    mode,
    points,
    threshold,
    monthsOver: withData.filter((p) => p.isOver).length,
    totalOver: withData.reduce((s, p) => s + p.overBy, 0),
    totalSaved: withData.reduce((s, p) => s + p.savedBy, 0),
  };
}

function makePoint(
  slot: { key: string; label: string; sub: string; isCurrent: boolean },
  amount: number,
  cumulative: number,
  threshold: number,
  hasData: boolean,
): SpendingPoint {
  const over = threshold > 0 && cumulative > threshold;
  return {
    key: slot.key,
    label: slot.label,
    sub: slot.sub,
    amount,
    cumulative,
    isCurrent: slot.isCurrent,
    isOver: over,
    overBy: over ? cumulative - threshold : 0,
    // Chỉ tính "tiết kiệm" ở mốc CÓ chi tiêu thật; tháng trống không phải thành tích.
    savedBy: !over && threshold > 0 && hasData && cumulative > 0 ? threshold - cumulative : 0,
    hasData,
  };
}

// ─────────────────────────── Hóa đơn: so tháng với tháng ───────────────────────────

export interface BillMonthTotal {
  month: string;
  label: string;
  amount: number;
  /** % chênh so với tháng GẦN NHẤT CÓ ĐÓNG trước đó. null nếu chưa có mốc so. */
  changePercent: number | null;
  isCurrent: boolean;
}

/**
 * Tổng tiền hóa đơn ĐÃ ĐÓNG từng tháng trong năm — gộp mọi hóa đơn.
 * Khác `buildBillYearSeries` (một hóa đơn): dùng cho câu hỏi "tháng này bill cao
 * hơn tháng trước bao nhiêu", rồi user tự vào Sổ sách xem điện/nước hơn chỗ nào.
 */
export function buildBillMonthTotals(
  payments: BillPayment[],
  year: number,
  now: Date = new Date(),
): BillMonthTotal[] {
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (!p.month.startsWith(String(year))) continue;
    byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);
  }

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const out: BillMonthTotal[] = [];
  let lastPaid: number | null = null;

  for (let m = 0; m < 12; m++) {
    const month = `${year}-${String(m + 1).padStart(2, '0')}`;
    const amount = byMonth.get(month) ?? 0;
    const changePercent =
      amount > 0 && lastPaid !== null && lastPaid > 0
        ? Math.round(((amount - lastPaid) / lastPaid) * 1000) / 10
        : null;
    out.push({ month, label: `T${m + 1}`, amount, changePercent, isCurrent: month === currentMonthKey });
    if (amount > 0) lastPaid = amount;
  }

  return out;
}

// ─────────────────────────── Ngân sách tháng vs thu nhập ───────────────────────────

export interface BudgetComposition {
  income: number;
  /** Ngưỡng chi tiêu đã đặt (tổng hạn mức các danh mục). */
  spendingLimit: number;
  fixedBills: number;
  /** Ngân sách tháng = ngưỡng chi tiêu + hóa đơn cố định. */
  budget: number;
  /** Ngân sách chiếm bao nhiêu % thu nhập. */
  budgetPercentOfIncome: number;
  spendingPercentOfIncome: number;
  billPercentOfIncome: number;
  /** Phần thu nhập chưa bị ngân sách chiếm (âm = ngân sách vượt thu nhập). */
  leftover: number;
  leftoverPercent: number;
  /** Ngân sách đã ngốn hết hoặc vượt thu nhập — cần cảnh báo. */
  isOverIncome: boolean;
}

/**
 * Ngân sách tháng chiếm bao nhiêu phần thu nhập, tách rõ chi tiêu vs hóa đơn.
 * Thu nhập ≤ 0 → null để giao diện nói "chưa có thu nhập" thay vì chia cho 0.
 */
export function getBudgetComposition(
  income: number,
  spendingLimit: number,
  fixedBills: number,
): BudgetComposition | null {
  if (income <= 0) return null;
  const budget = spendingLimit + fixedBills;
  const pct = (n: number) => Math.round((n / income) * 1000) / 10;
  const leftover = income - budget;
  return {
    income,
    spendingLimit,
    fixedBills,
    budget,
    budgetPercentOfIncome: pct(budget),
    spendingPercentOfIncome: pct(spendingLimit),
    billPercentOfIncome: pct(fixedBills),
    leftover,
    leftoverPercent: pct(leftover),
    isOverIncome: budget >= income,
  };
}

// ─────────────────────────── Chuyển khoản vs tiền mặt ───────────────────────────

export interface MethodSplit {
  cash: number;
  bank: number;
  total: number;
  cashPercent: number;
  bankPercent: number;
}

/** Tách tiền mặt / chuyển khoản cho một loại giao dịch trong kỳ đang xem. */
export function getMethodSplit(
  transactions: Transaction[],
  type: 'income' | 'expense',
  period: ExpensePeriod,
  now: Date = new Date(),
): MethodSplit {
  const slots = buildPeriodSlots(period, now);
  const from = slots.find((s) => s.isCurrent)?.from;
  const to = slots.find((s) => s.isCurrent)?.to;

  let cash = 0;
  let bank = 0;
  for (const txn of transactions) {
    if (txn.type !== type) continue;
    const d = new Date(txn.date);
    if (from && to && (d < from || d >= to)) continue;
    if (isCash(txn)) cash += txn.amount;
    else bank += txn.amount;
  }

  const total = cash + bank;
  return {
    cash,
    bank,
    total,
    cashPercent: total > 0 ? Math.round((cash / total) * 1000) / 10 : 0,
    bankPercent: total > 0 ? Math.round((bank / total) * 1000) / 10 : 0,
  };
}

// ─────────────────────────── Đà thu nhập so với tháng trước ───────────────────────────

export interface IncomeMomentum {
  current: number;
  previous: number;
  /** Phần trăm chênh so với tháng trước, làm tròn 1 chữ số. `null` = không so được. */
  deltaPercent: number | null;
  direction: 'up' | 'down' | 'flat';
}

/**
 * Thu tháng này so với tháng liền trước — dữ liệu cho mũi tên tăng trưởng.
 *
 * ⚠️ KHÔNG dùng `buildIncomeSeries(..., 'month')` để lấy tháng trước: chuỗi đó chỉ
 * trải 12 tháng của NĂM HIỆN TẠI, nên vào tháng 1 thì "tháng trước" (tháng 12 năm
 * ngoái) không có ô nào và sẽ đọc ra 0 — tức báo tăng vô lý ngay đầu năm. Ở đây
 * tính mốc bằng `new Date(y, m - 1, 1)`, JS tự lùi sang tháng 12 năm trước.
 *
 * `deltaPercent` là `null` khi tháng trước bằng 0: chia cho 0 không ra số nào có
 * nghĩa, và "tăng ∞%" thì vô nghĩa với người đọc — giao diện phải ẩn mũi tên,
 * đừng bịa 100%.
 */
export function buildIncomeMomentum(
  transactions: Transaction[],
  now: Date = new Date(),
): IncomeMomentum {
  const curFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextFrom = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let current = 0;
  let previous = 0;
  for (const txn of transactions) {
    if (txn.type !== 'income') continue;
    const d = new Date(txn.date);
    if (d >= curFrom && d < nextFrom) current += txn.amount;
    else if (d >= prevFrom && d < curFrom) previous += txn.amount;
  }

  if (previous === 0) {
    return { current, previous, deltaPercent: null, direction: 'flat' };
  }

  const raw = ((current - previous) / previous) * 100;
  const deltaPercent = Math.round(raw * 10) / 10;
  return {
    current,
    previous,
    deltaPercent,
    direction: deltaPercent > 0 ? 'up' : deltaPercent < 0 ? 'down' : 'flat',
  };
}

// ─────────────────────────── Gộp nguồn thu nhỏ thành "Khác" ───────────────────────────

/**
 * Giữ tối đa `max` dòng chú thích: quá thì lấy `max - 1` nguồn lớn nhất, phần còn
 * lại gộp thành một dòng "Khác".
 *
 * Chỉ gộp khi THỰC SỰ thừa. Đúng `max` nguồn thì hiện đủ cả `max` — gộp lúc đó là
 * đổi 2 dòng thật lấy 1 dòng "Khác", vừa mất thông tin vừa chẳng tiết kiệm chỗ.
 *
 * Đầu vào phải đã sắp giảm dần (`buildIncomeBreakdown` trả về như vậy).
 * `percent` của dòng gộp cộng thẳng từ các lát bị gộp nên tổng vẫn khớp vành khuyên.
 */
export function capIncomeSlices(slices: IncomeSlice[], max = 4): IncomeSlice[] {
  if (max < 2 || slices.length <= max) return slices;

  const kept = slices.slice(0, max - 1);
  const rest = slices.slice(max - 1);

  return [
    ...kept,
    {
      categoryId: '__other__',
      name: 'Khác',
      icon: '💵',
      color: 'var(--clay-ink-2)',
      amount: rest.reduce((s, r) => s + r.amount, 0),
      percent: Math.round(rest.reduce((s, r) => s + r.percent, 0) * 10) / 10,
    },
  ];
}
