/* ═══ useSafeBalance — Computed safe-to-spend from 3 stores ═══ */
'use client';

import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useDashboardStore } from '@/stores/useDashboardStore';

/**
 * Công thức:
 * Số dư an toàn = Thu nhập tháng + Dư tháng trước
 *               − Ngưỡng chi tiêu − Bill cố định − Tiết kiệm tháng
 *
 * CHO PHÉP ÂM (khi chi > thu)
 */
export function useSafeBalance() {
  // 1. Thu nhập tháng (từ ngày 1 → nay)
  const monthlyIncome = useFinanceStore((s) => s.getMonthlyIncome());

  // 2. Dư tháng trước
  const carryOver = useBudgetStore((s) => s.carryOver);

  // 3. Tổng ngưỡng chi tiêu (tất cả danh mục đã thiết lập)
  const totalCategoryLimits = useBudgetStore((s) => s.getTotalCategoryLimits());

  // 4. Tổng bill cố định hàng tháng
  const totalBills = useFinanceStore((s) => s.getTotalFixedBillsAmount());

  // 5. Tổng tiết kiệm tháng (dự phòng + mục tiêu + đầu tư)
  const totalSavings = useDashboardStore((s) => s.getTotalMonthlySavings());

  // === Tính số dư an toàn (cho phép ÂM) ===
  const safeToSpend = (monthlyIncome + carryOver) - totalCategoryLimits - totalBills - totalSavings;

  // Tổng đã chi (từ transactions thực trong tháng, giống cách Sổ sách tính)
  const totalSpent = useFinanceStore((s) => s.getMonthlyExpense());

  // % chi tiêu so với ngưỡng
  const spendingBase = totalCategoryLimits > 0 ? totalCategoryLimits : 1;
  const spentPercent = Math.min(100, Math.round((totalSpent / spendingBase) * 100));

  // Trạng thái cảnh báo
  const isNegative = safeToSpend <= 0;
  const isLow = safeToSpend > 0 && safeToSpend <= 1_000_000;
  const isHealthy = safeToSpend > 1_000_000;

  const warningType: 'safe' | 'low' | 'danger' = isNegative ? 'danger' : isLow ? 'low' : 'safe';

  return {
    safeToSpend,
    monthlyIncome,
    carryOver,
    totalCategoryLimits,
    totalBills,
    totalSavings,
    totalSpent,
    spentPercent,
    isHealthy,
    isLow,
    isNegative,
    warningType,
  };
}
