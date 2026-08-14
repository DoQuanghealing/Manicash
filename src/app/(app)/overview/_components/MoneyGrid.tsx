/* ═══ MoneyGrid — Lưới 2×2 "Tiền tháng này" (entry-tile) ═══
 *
 * Thay cho việc luôn hiện đầy đủ IncomeBlock/ExpenseBillBlock/FundsBlock trên
 * trang Tổng quan — mỗi ô chỉ tóm tắt 1 con số, tap mở route chi tiết riêng
 * (giữ nguyên toàn bộ logic/biểu đồ ở trang con, không mất chức năng).
 */
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './MoneyGrid.css';

export default function MoneyGrid() {
  const router = useRouter();
  const monthlyIncome = useFinanceStore((s) => s.getMonthlyIncome());
  const monthlyExpense = useFinanceStore((s) => s.getMonthlyExpense());
  const totalFixedBills = useFinanceStore((s) => s.getTotalFixedBillsAmount());
  const accounts = useDashboardStore((s) => s.accounts);

  const spentPercent = totalFixedBills > 0 ? Math.min(100, Math.round((monthlyExpense / Math.max(monthlyIncome, 1)) * 100)) : 0;
  // Thẻ "Hóa đơn" đã bỏ khỏi lưới: nó mở đúng trang /overview/expenses như ô Chi
  // tiêu nên chỉ tổ chiếm chỗ. Chi tiết hóa đơn nằm trong trang Chi tiêu.
  const fundsTotal = accounts.reserve.balance + accounts.goals.balance + accounts.investment.balance;

  const month = new Date().getMonth() + 1;

  return (
    <div className="mg-wrap">
      <div className="mg-header">
        <span className="mg-header-label">TIỀN THÁNG NÀY</span>
        <span className="mg-header-month">Tháng {month}</span>
      </div>
      <div className="mg-grid">
        <motion.button
          type="button"
          className="mg-tile"
          onClick={() => router.push('/overview/income')}
          whileTap={{ scale: 0.97 }}
        >
          <span className="mg-icon mg-icon--income"><TrendingUp size={17} /></span>
          <span className="mg-label">Thu nhập</span>
          <span className="mg-value">{formatCurrencyShort(monthlyIncome)}</span>
        </motion.button>

        <motion.button
          type="button"
          className="mg-tile"
          onClick={() => router.push('/overview/expenses')}
          whileTap={{ scale: 0.97 }}
        >
          <div className="mg-tile-top">
            <span className="mg-icon mg-icon--expense"><TrendingDown size={17} /></span>
            {spentPercent > 0 && <span className="mg-pct">{spentPercent}%</span>}
          </div>
          <span className="mg-label">Chi tiêu</span>
          <span className="mg-value">{formatCurrencyShort(monthlyExpense)}</span>
          {spentPercent > 0 && (
            <div className="mg-bar"><div className="mg-bar-fill" style={{ width: `${spentPercent}%` }} /></div>
          )}
        </motion.button>

        <motion.button
          type="button"
          className="mg-tile mg-tile--wide"
          onClick={() => router.push('/overview/funds')}
          whileTap={{ scale: 0.97 }}
        >
          <span className="mg-icon mg-icon--funds"><PiggyBank size={17} /></span>
          <span className="mg-label">3 quỹ tiết kiệm</span>
          <span className="mg-value">{formatCurrencyShort(fundsTotal)}</span>
        </motion.button>
      </div>
    </div>
  );
}
