/* ═══ FixedBillsSummary — Mini card for upcoming bills ═══ */
'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './FixedBillsSummary.css';

export default function FixedBillsSummary() {
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);

  const { totalBills, unpaidBills, nextBill, shortage } = useMemo(() => {
    const total = fixedBills.reduce((s, b) => s + b.amount, 0);
    const unpaid = fixedBills.filter((b) => !b.isPaid);
    const unpaidTotal = unpaid.reduce((s, b) => s + b.amount, 0);
    const next = unpaid.sort((a, b) => a.dueDay - b.dueDay)[0] || null;
    const short = Math.max(0, unpaidTotal - billFundBalance);
    return { totalBills: total, unpaidBills: unpaid, nextBill: next, shortage: short };
  }, [fixedBills, billFundBalance]);

  const today = new Date().getDate();

  return (
    <motion.div
      className="fbs-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="fbs-header">
        <div className="fbs-header-left">
          <span className="fbs-icon">📋</span>
          <span className="fbs-title">Chi phí cố định</span>
        </div>
        <span className="fbs-badge">
          {unpaidBills.length} chưa trả
        </span>
      </div>

      {/* Fund status */}
      <div className="fbs-fund-row">
        <div className="fbs-fund-item">
          <span className="fbs-fund-label">Quỹ bill</span>
          <span className="fbs-fund-value">{formatCurrencyShort(billFundBalance)}</span>
        </div>
        <div className="fbs-fund-divider" />
        <div className="fbs-fund-item">
          <span className="fbs-fund-label">Tổng bill</span>
          <span className="fbs-fund-value">{formatCurrencyShort(totalBills)}</span>
        </div>
        {shortage > 0 && (
          <>
            <div className="fbs-fund-divider" />
            <div className="fbs-fund-item">
              <span className="fbs-fund-label">Thiếu</span>
              <span className="fbs-fund-value fbs-fund-danger">-{formatCurrencyShort(shortage)}</span>
            </div>
          </>
        )}
      </div>

      {/* Next bill reminder */}
      {nextBill && (
        <div className={`fbs-next ${nextBill.dueDay <= today ? 'fbs-next--urgent' : ''}`}>
          <span className="fbs-next-icon">{nextBill.icon}</span>
          <div className="fbs-next-info">
            <span className="fbs-next-name">{nextBill.name}</span>
            <span className="fbs-next-due">
              {nextBill.dueDay <= today ? '⏰ Đã đến hạn!' : `Ngày ${nextBill.dueDay} tháng này`}
            </span>
          </div>
          <span className="fbs-next-amount">{formatCurrency(nextBill.amount)}</span>
        </div>
      )}
    </motion.div>
  );
}
