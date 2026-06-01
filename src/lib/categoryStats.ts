/* ═══ categoryStats — Per-category transaction analytics ═══
 *
 * Pure helpers tính median/average/anomaly cho 1 category trong tháng.
 * Dùng cho CategoryDetailDrawer (drill-down) và CFO payload.
 *
 * Anomaly threshold: 1.5× average của category đó. Tự co giãn theo từng
 * danh mục — Ăn uống avg cao thì ngưỡng cao, Cà phê avg thấp thì ngưỡng thấp.
 * Confirmed với user trong /loop session.
 * ─────────────────────────────────────────────────────────────────── */

import type { Transaction } from '@/stores/useFinanceStore';

/** Hệ số nhân lên average để gọi là "cao bất thường". */
export const ANOMALY_MULTIPLIER = 1.5;

export interface CategoryStats {
  /** Tất cả transactions trong category + tháng hiện tại. */
  txns: Transaction[];
  /** Tổng đã chi tháng. */
  total: number;
  /** Số lần chi. */
  count: number;
  /** Trung bình mỗi giao dịch (làm tròn). 0 nếu count = 0. */
  avgPerTxn: number;
  /** Median per-txn (làm tròn). 0 nếu count = 0. */
  medianPerTxn: number;
  /** Ngưỡng "cao bất thường" = avgPerTxn × ANOMALY_MULTIPLIER. */
  anomalyThreshold: number;
  /** Top 5 giao dịch lớn nhất, sort desc by amount. */
  topTxns: Transaction[];
  /** Tất cả txn có amount ≥ anomalyThreshold, sort desc. */
  anomalies: Transaction[];
  /** Tổng các anomalies — để hiện "8 lần ≥ 500k tổng 4.2tr". */
  anomalyTotal: number;
}

/**
 * Tính stats từ danh sách transaction.
 *
 * @param allTxns Toàn bộ transactions (sẽ tự filter theo cat + month).
 * @param categoryId Category cần phân tích.
 * @param monthKey 'YYYY-MM' — tháng cần xem.
 */
export function computeCategoryStats(
  allTxns: Transaction[],
  categoryId: string,
  monthKey: string,
): CategoryStats {
  // Filter theo category + tháng + chỉ expense.
  const txns = allTxns.filter((t) => {
    if (t.type !== 'expense') return false;
    if (t.categoryId !== categoryId) return false;
    const d = new Date(t.date);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return m === monthKey;
  });

  const count = txns.length;
  const total = txns.reduce((s, t) => s + t.amount, 0);
  const avgPerTxn = count > 0 ? Math.round(total / count) : 0;

  // Median
  const sortedByAmount = [...txns].sort((a, b) => a.amount - b.amount);
  let medianPerTxn = 0;
  if (count > 0) {
    const mid = Math.floor(count / 2);
    medianPerTxn = count % 2 === 0
      ? Math.round((sortedByAmount[mid - 1].amount + sortedByAmount[mid].amount) / 2)
      : sortedByAmount[mid].amount;
  }

  const anomalyThreshold = Math.round(avgPerTxn * ANOMALY_MULTIPLIER);

  // Top 5 sort desc.
  const topTxns = [...txns].sort((a, b) => b.amount - a.amount).slice(0, 5);

  // Anomalies — txn ≥ threshold (only meaningful nếu count ≥ 3, tránh 1 txn auto trigger).
  const anomalies = count >= 3
    ? txns.filter((t) => t.amount >= anomalyThreshold).sort((a, b) => b.amount - a.amount)
    : [];
  const anomalyTotal = anomalies.reduce((s, t) => s + t.amount, 0);

  return {
    txns,
    total,
    count,
    avgPerTxn,
    medianPerTxn,
    anomalyThreshold,
    topTxns,
    anomalies,
    anomalyTotal,
  };
}

/**
 * Days-ago tiện ích cho prompt CFO. Negative nếu txn ở tương lai (shouldn't happen).
 */
export function daysAgo(dateIso: string, ref: Date = new Date()): number {
  const d = new Date(dateIso);
  const diffMs = ref.getTime() - d.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}
