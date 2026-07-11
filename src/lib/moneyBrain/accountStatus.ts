/* ═══ Money Brain — Trạng thái tài khoản (4 mức) ═══
 * PURE + deterministic. Gộp các tín hiệu sẵn có thành 1 trạng thái dễ hiểu cho
 * màn Tổng quan, thay cbadge "An toàn/Cẩn thận/Nguy hiểm" cũ (chỉ dựa số dư).
 *
 * 4 mức (xấu → tốt), quyết định theo cây ưu tiên:
 *   canhbao   — số dư khả dụng < 0 (thu < chi). Tệ nhất.
 *   trungbinh — chưa có nguồn thu tăng thêm HOẶC chi vượt ngưỡng.
 *   tot       — thu tốt + trong ngưỡng, nhưng còn bill chưa đóng.
 *   xuatsac   — có thu tăng thêm, đóng đủ bill, chi trong ngưỡng, số dư dương.
 *
 * Ghi chú: app CHƯA có mô hình "nợ" riêng — "trả nợ đúng hạn" hiện suy gián tiếp
 * từ số dư âm (canhbao). Khi thêm data model nợ, bổ sung tín hiệu hasOverdueDebt.
 */

import type { MoneySnapshotV1 } from './types';
import { getSafeToSpendBreakdown } from './safeToSpend';
import { getOverBudgetCategories } from './budgetMetrics';
import { getExpectedIncomePipeline, getActualTaskIncomeForPeriod } from './taskMetrics';

export type AccountStatusLevel = 'xuatsac' | 'tot' | 'trungbinh' | 'canhbao';

export interface AccountStatusAction {
  label: string;
  kind: 'pay-bills' | 'earn-more' | 'cut-spending' | 'balance-income';
  /** Deep-link route khi bấm (nếu có). */
  target?: string;
}

export interface AccountStatusSignals {
  safeToSpend: number;
  /** Thu tăng thêm = thu thực tế từ nhiệm vụ (mục Money) + pipeline đang chờ. */
  extraIncome: number;
  hasExtraIncome: boolean;
  withinLimits: boolean;
  overBudgetCount: number;
  /** Tổng số tiền vượt ngưỡng (spent − limit) của các nhóm quá hạn mức. */
  overBudgetAmount: number;
  billsAllPaid: boolean;
  unpaidBillsCount: number;
  unpaidBillsAmount: number;
}

export interface AccountStatusResult {
  level: AccountStatusLevel;
  label: string;
  emoji: string;
  tone: 'excellent' | 'good' | 'average' | 'danger';
  /** 1 dòng tóm tắt để hiện dưới badge. */
  headline: string;
  /** Vì sao ở mức này (đã điền số cụ thể). */
  reasons: string[];
  /** Gợi ý hành động (nút). */
  actions: AccountStatusAction[];
  signals: AccountStatusSignals;
}

/** Deep-link: "Sổ sách" → bill cố định · "Money" → nhiệm vụ kiếm tiền. */
export const BILLS_ROUTE = '/ledger?tab=bills';
export const MONEY_ROUTE = '/money';

const META: Record<AccountStatusLevel, { label: string; emoji: string; tone: AccountStatusResult['tone']; headline: string }> = {
  xuatsac: { label: 'Xuất sắc', emoji: '🌟', tone: 'excellent', headline: 'Tài chính của bạn đang rất khoẻ mạnh.' },
  tot: { label: 'Tốt', emoji: '✅', tone: 'good', headline: 'Mọi thứ ổn — chỉ còn vài khoản bill cần đóng.' },
  trungbinh: { label: 'Trung bình', emoji: '⚠️', tone: 'average', headline: 'Cần siết lại một chút để vững hơn.' },
  canhbao: { label: 'Cảnh báo', emoji: '🔴', tone: 'danger', headline: 'Bạn đang chi nhiều hơn thu — cần cân đối ngay.' },
};

function money(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`;
}

export function computeAccountStatus(snapshot: MoneySnapshotV1): AccountStatusResult {
  const breakdown = getSafeToSpendBreakdown(snapshot);
  const over = getOverBudgetCategories(snapshot);
  const overBudgetAmount = over.reduce((s, c) => s + Math.max(0, c.spent - c.monthlyLimit), 0);

  const pipeline = getExpectedIncomePipeline(snapshot);
  const realizedExtra = getActualTaskIncomeForPeriod(snapshot, 'this_month');
  const extraIncome = realizedExtra + pipeline;

  const unpaidBills = snapshot.bills.filter((b) => !b.isPaid);
  const unpaidBillsAmount = unpaidBills.reduce((s, b) => s + b.amount, 0);

  const signals: AccountStatusSignals = {
    safeToSpend: breakdown.safeToSpend,
    extraIncome,
    hasExtraIncome: extraIncome > 0,
    withinLimits: over.length === 0,
    overBudgetCount: over.length,
    overBudgetAmount,
    billsAllPaid: unpaidBills.length === 0,
    unpaidBillsCount: unpaidBills.length,
    unpaidBillsAmount,
  };

  // ── Cây quyết định (xấu → tốt) ──
  let level: AccountStatusLevel;
  if (signals.safeToSpend < 0) level = 'canhbao';
  else if (!signals.withinLimits || !signals.hasExtraIncome) level = 'trungbinh';
  else if (!signals.billsAllPaid) level = 'tot';
  else level = 'xuatsac';

  const reasons: string[] = [];
  const actions: AccountStatusAction[] = [];

  switch (level) {
    case 'xuatsac':
      reasons.push('Có nguồn thu tăng thêm ngoài thu nhập cố định');
      reasons.push('Đã đóng đủ tất cả bill');
      reasons.push('Chi tiêu nằm trong ngưỡng đã đặt');
      reasons.push(`Số dư khả dụng dương: ${money(signals.safeToSpend)}`);
      actions.push({ label: 'Nhận thêm nhiệm vụ kiếm tiền', kind: 'earn-more', target: MONEY_ROUTE });
      break;

    case 'tot':
      reasons.push('Thu nhập tốt — có nguồn thu tăng thêm');
      reasons.push('Chi tiêu trong ngưỡng đã đặt');
      reasons.push(`Còn ${signals.unpaidBillsCount} bill chưa đóng (${money(signals.unpaidBillsAmount)})`);
      actions.push({ label: 'Thanh toán bill ngay', kind: 'pay-bills', target: BILLS_ROUTE });
      break;

    case 'trungbinh':
      if (!signals.hasExtraIncome) {
        reasons.push('Chưa có nguồn thu tăng thêm — hãy thử nhiệm vụ kiếm tiền ở mục Money');
        actions.push({ label: 'Tạo nguồn thu thêm', kind: 'earn-more', target: MONEY_ROUTE });
      }
      if (!signals.withinLimits) {
        reasons.push(`Chi tiêu vượt ngưỡng ${money(signals.overBudgetAmount)} ở ${signals.overBudgetCount} nhóm`);
        actions.push({ label: 'Xem khoản đang vượt', kind: 'cut-spending', target: BILLS_ROUTE });
      }
      if (!signals.billsAllPaid) {
        reasons.push(`Còn ${signals.unpaidBillsCount} bill chưa đóng (${money(signals.unpaidBillsAmount)})`);
        actions.push({ label: 'Thanh toán bill', kind: 'pay-bills', target: BILLS_ROUTE });
      }
      break;

    case 'canhbao':
      reasons.push(`Số dư khả dụng đang âm: ${money(signals.safeToSpend)}`);
      reasons.push('Chi tiêu đang nhiều hơn thu nhập');
      if (!signals.withinLimits) {
        reasons.push(`Vượt ngưỡng ${money(signals.overBudgetAmount)} ở ${signals.overBudgetCount} nhóm`);
      }
      if (!signals.billsAllPaid) {
        reasons.push(`${signals.unpaidBillsCount} bill chưa đóng (${money(signals.unpaidBillsAmount)})`);
      }
      actions.push({ label: 'Lên kế hoạch kiếm thêm', kind: 'earn-more', target: MONEY_ROUTE });
      actions.push({ label: 'Xem khoản đang vượt', kind: 'cut-spending', target: BILLS_ROUTE });
      break;
  }

  return { level, ...META[level], reasons, actions, signals };
}
