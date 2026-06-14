/* ═══ Money Brain — Cash Runway (Phase 6C / roadmap v1.1) ═══
 * PURE functions. Hai loại runway theo NGÀY (roadmap docs/MONEY_BRAIN_ROADMAP.md):
 *
 *   liquidBalance       = mainBalance + emergencyBalance        (KHÔNG gồm billFund)
 *   monthlySurvivalBurn = totalFixedBills + essentialAvgLast3M
 *   survivalRunwayDays  = liquidBalance / monthlySurvivalBurn * 30
 *   lifestyleRunwayDays = liquidBalance / monthlyAvgExpense    * 30
 *
 * "Thiết yếu" (essential): ăn uống, đi chợ, di chuyển, hoá đơn (điện/nước/net),
 * thuê nhà, sức khoẻ. KHÔNG gồm cà phê / mua sắm / giải trí.
 *
 * Edge cases (đồng bộ phong cách getEmergencyRunwayMonths):
 *  - liquid <= 0                 → 0 ngày.
 *  - burn  <= 0 nhưng liquid > 0 → RUNWAY_INFINITE_DAYS (sentinel, tránh Infinity).
 *
 * KHÔNG Date.now(): "3 tháng gần nhất" = 3 monthKey CÓ DỮ LIỆU gần nhất, không bịa
 * tháng trống.
 */
import type { MoneySnapshotV1, MoneyTransactionSnapshot } from './types';
import { normalizeCategoryId } from './normalize';
import { getTotalFixedBills } from './billMetrics';
import { getAvailableMonthKeys } from './historyMetrics';

/** categoryId được coi là chi tiêu thiết yếu (sinh tồn). */
export const ESSENTIAL_CATEGORY_IDS: ReadonlySet<string> = new Set([
  'food',       // ăn uống
  'groceries',  // đi chợ / siêu thị (nhu yếu phẩm)
  'transport',  // di chuyển
  'bills',      // hoá đơn: điện / nước / internet
  'rent',       // thuê nhà
  'health',     // sức khoẻ
]);

/** Runway "rất dài" khi burn ~ 0 nhưng còn tiền. Sentinel để tránh Infinity/NaN. */
export const RUNWAY_INFINITE_DAYS = 9999;
const DAYS_PER_MONTH = 30;
const RUNWAY_MONTHS_WINDOW = 3;

export function isEssentialCategory(categoryId?: string): boolean {
  const id = normalizeCategoryId(categoryId);
  return id ? ESSENTIAL_CATEGORY_IDS.has(id) : false;
}

/** Số dư thanh khoản dùng để sống = main + emergency (KHÔNG gồm billFund đã giữ cho bill). */
export function getLiquidBalance(snapshot: MoneySnapshotV1): number {
  return snapshot.wallets.main + snapshot.wallets.emergency;
}

function monthKeyOf(t: MoneyTransactionSnapshot): string {
  return t.monthKey || (t.dateKey ? t.dateKey.slice(0, 7) : t.date.slice(0, 7));
}

/** N monthKey có dữ liệu GẦN NHẤT (tăng dần). */
function lastMonthKeys(snapshot: MoneySnapshotV1, n: number): string[] {
  const all = getAvailableMonthKeys(snapshot); // asc
  return all.slice(Math.max(0, all.length - n));
}

/**
 * Trung bình chi tiêu hàng tháng trong N tháng gần nhất có dữ liệu.
 * `essentialOnly` → chỉ tính danh mục thiết yếu. Chia cho SỐ THÁNG có dữ liệu
 * (không bịa tháng trống). Trả 0 nếu chưa có tháng nào.
 */
function avgMonthlyExpense(
  snapshot: MoneySnapshotV1,
  months: number,
  essentialOnly: boolean,
): { avg: number; monthsCounted: number } {
  const keys = new Set(lastMonthKeys(snapshot, months));
  if (keys.size === 0) return { avg: 0, monthsCounted: 0 };

  let total = 0;
  for (const t of snapshot.transactions) {
    if (t.type !== 'expense') continue;
    if (!keys.has(monthKeyOf(t))) continue;
    if (essentialOnly && !isEssentialCategory(t.categoryId)) continue;
    total += t.amount;
  }
  return { avg: total / keys.size, monthsCounted: keys.size };
}

/** Trung bình chi thiết yếu / tháng trong 3 tháng gần nhất có dữ liệu. */
export function getEssentialCategoryAvgLast3Months(snapshot: MoneySnapshotV1): number {
  return avgMonthlyExpense(snapshot, RUNWAY_MONTHS_WINDOW, true).avg;
}

/** Trung bình TỔNG chi / tháng trong N tháng gần nhất có dữ liệu (mặc định 3). */
export function getMonthlyAvgExpense(
  snapshot: MoneySnapshotV1,
  months: number = RUNWAY_MONTHS_WINDOW,
): number {
  return avgMonthlyExpense(snapshot, months, false).avg;
}

/** Chi sinh tồn hàng tháng = tổng bill cố định + trung bình chi thiết yếu 3 tháng. */
export function getMonthlySurvivalBurn(snapshot: MoneySnapshotV1): number {
  return getTotalFixedBills(snapshot) + getEssentialCategoryAvgLast3Months(snapshot);
}

function runwayDays(liquid: number, monthlyBurn: number): number {
  if (liquid <= 0) return 0;
  if (monthlyBurn <= 0) return RUNWAY_INFINITE_DAYS;
  return (liquid / monthlyBurn) * DAYS_PER_MONTH;
}

/** Số ngày trụ được nếu chỉ chi sinh tồn (bill + thiết yếu). */
export function getSurvivalRunwayDays(snapshot: MoneySnapshotV1): number {
  return runwayDays(getLiquidBalance(snapshot), getMonthlySurvivalBurn(snapshot));
}

/** Số ngày trụ được theo mức chi hiện tại (toàn bộ chi tiêu trung bình). */
export function getLifestyleRunwayDays(snapshot: MoneySnapshotV1): number {
  return runwayDays(getLiquidBalance(snapshot), getMonthlyAvgExpense(snapshot));
}

export interface CashRunwayResult {
  liquidBalance: number;
  totalFixedBills: number;
  essentialAvgLast3Months: number;
  monthlyAvgExpense: number;
  monthlySurvivalBurn: number;
  survivalRunwayDays: number;
  lifestyleRunwayDays: number;
  /** Số tháng dữ liệu thực sự dùng để tính trung bình (0..3). */
  monthsOfDataUsed: number;
}

/** Gói đầy đủ cả hai loại runway + thành phần — cho UI/CFO debug. */
export function getCashRunway(snapshot: MoneySnapshotV1): CashRunwayResult {
  const liquidBalance = getLiquidBalance(snapshot);
  const totalFixedBills = getTotalFixedBills(snapshot);
  const essential = avgMonthlyExpense(snapshot, RUNWAY_MONTHS_WINDOW, true);
  const lifestyle = avgMonthlyExpense(snapshot, RUNWAY_MONTHS_WINDOW, false);
  const monthlySurvivalBurn = totalFixedBills + essential.avg;

  return {
    liquidBalance,
    totalFixedBills,
    essentialAvgLast3Months: essential.avg,
    monthlyAvgExpense: lifestyle.avg,
    monthlySurvivalBurn,
    survivalRunwayDays: runwayDays(liquidBalance, monthlySurvivalBurn),
    lifestyleRunwayDays: runwayDays(liquidBalance, lifestyle.avg),
    monthsOfDataUsed: lifestyle.monthsCounted,
  };
}
