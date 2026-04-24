/* ═══ ExpenseBillBlock — Block 2: 2-column Chi tiêu + Hóa đơn ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, CreditCard, X, AlertTriangle } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './ExpenseBillBlock.css';

export default function ExpenseBillBlock() {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  // Chi tiêu tháng hiện tại (đồng bộ với Sổ sách)
  const totalExpense = useFinanceStore((s) => s.getMonthlyExpense());
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const getAccumulatedBillTarget = useFinanceStore((s) => s.getAccumulatedBillTarget);

  // Ngưỡng chi tiêu từ budgetStore (đồng bộ với Sổ sách → Ngưỡng)
  const spendingLimit = useBudgetStore((s) => s.getTotalCategoryLimits());

  const remainingToSpend = Math.max(0, spendingLimit - totalExpense);
  const spendingPercent = spendingLimit > 0 ? Math.min(100, (totalExpense / spendingLimit) * 100) : 0;
  const isOverBudget = totalExpense > spendingLimit;

  const billData = getAccumulatedBillTarget();
  const unpaidBills = fixedBills.filter((b) => !b.isPaid);
  const today = new Date().getDate();
  const urgentBills = unpaidBills.filter((b) => b.dueDay <= today + 3);

  const paidBills = fixedBills.filter((b) => b.isPaid);
  const upcomingBills = unpaidBills.filter((b) => {
    const daysUntilDue = b.dueDay - today;
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });

  // Recent expenses
  const recentExpenses = transactions
    .filter((t) => t.type === 'expense')
    .slice(0, 10);

  return (
    <>
      <div className="ebb-grid">
        {/* ═══ Card 1: Chi tiêu ═══ */}
        <motion.button
          className="ebb-card ebb-card--expense"
          onClick={() => setShowExpenseModal(true)}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Row 1: Icon + Label ngang */}
          <div className="ebb-card-row1">
            <div className="ebb-card-icon-sm" style={{ background: 'rgba(249, 115, 22, 0.12)' }}>
              <ShoppingBag size={14} color="#F97316" />
            </div>
            <p className="ebb-card-label" style={{ color: '#F97316' }}>Chi tiêu</p>
          </div>

          {/* Row 2: Số tiền */}
          <p className={`ebb-card-amount ${isOverBudget ? 'ebb-card-amount--danger' : ''}`}>
            {formatCurrencyShort(totalExpense)}
          </p>

          {/* Row 3: Thanh tiến trình chi tiêu */}
          <div className="ebb-progress">
            <div
              className={`ebb-progress-fill ${isOverBudget ? 'ebb-progress-fill--danger' : ''}`}
              style={{ width: `${spendingPercent}%` }}
            />
          </div>

          {/* Row 4: Còn bao nhiêu */}
          <p className="ebb-card-remaining">
            💡 Còn <span className="ebb-remaining-value">{formatCurrencyShort(remainingToSpend)}</span> có thể chi
          </p>
        </motion.button>

        {/* ═══ Card 2: Hóa đơn ═══ */}
        <motion.button
          className="ebb-card ebb-card--bills"
          onClick={() => setShowBillModal(true)}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Row 1: Icon + Label ngang */}
          <div className="ebb-card-row1">
            <div className="ebb-card-icon-sm" style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
              <CreditCard size={14} color="#8B5CF6" />
            </div>
            <p className="ebb-card-label" style={{ color: '#8B5CF6' }}>Hóa đơn</p>
          </div>

          {/* Row 2: Số tiền */}
          <p className="ebb-card-amount">{formatCurrencyShort(billFundBalance)}</p>

          {/* Row 3: Bill đã đóng */}
          <div className="ebb-bill-stat ebb-bill-stat--paid">
            <span className="ebb-bill-stat-icon">🪙</span>
            <span>{paidBills.length} bill đã đóng</span>
          </div>

          {/* Row 4: Bill sắp hạn */}
          {upcomingBills.length > 0 ? (
            <div className="ebb-bill-stat ebb-bill-stat--urgent">
              <AlertTriangle size={10} />
              <span>{upcomingBills.length} sắp đến hạn</span>
            </div>
          ) : (
            <div className="ebb-bill-stat ebb-bill-stat--safe">
              <span>✅</span>
              <span>Không có bill gấp</span>
            </div>
          )}
        </motion.button>
      </div>

      {/* ═══ Expense Detail Modal ═══ */}
      <AnimatePresence>
        {showExpenseModal && (
          <>
            <motion.div
              className="ebb-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExpenseModal(false)}
            />
            <motion.div
              className="ebb-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="ebb-modal-handle"><div className="ebb-modal-handle-bar" /></div>

              <div className="ebb-modal-header">
                <h3 className="ebb-modal-title">💸 Chi tiêu chi tiết</h3>
                <button className="ebb-modal-close" onClick={() => setShowExpenseModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Safe to spend highlight */}
              <div className="ebb-modal-safe">
                <span className="ebb-modal-safe-label">Số dư còn lại có thể chi</span>
                <span className={`ebb-modal-safe-val ${isOverBudget ? 'ebb-modal-safe-val--danger' : ''}`}>
                  {formatCurrency(remainingToSpend)}
                </span>
              </div>

              {/* Transaction list */}
              <div className="ebb-modal-list">
                {recentExpenses.map((txn) => (
                  <div key={txn.id} className="ebb-txn-item">
                    <div className="ebb-txn-left">
                      <span className="ebb-txn-note">{txn.note}</span>
                      <span className="ebb-txn-time">{txn.dateLabel} • {txn.time}</span>
                    </div>
                    <span className="ebb-txn-amount">-{formatCurrencyShort(txn.amount)}</span>
                  </div>
                ))}
                {recentExpenses.length === 0 && (
                  <p className="ebb-modal-empty">Chưa có giao dịch chi tiêu</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ Bill Detail Modal ═══ */}
      <AnimatePresence>
        {showBillModal && (
          <>
            <motion.div
              className="ebb-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBillModal(false)}
            />
            <motion.div
              className="ebb-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="ebb-modal-handle"><div className="ebb-modal-handle-bar" /></div>

              <div className="ebb-modal-header">
                <h3 className="ebb-modal-title">🧾 Hóa đơn cố định</h3>
                <button className="ebb-modal-close" onClick={() => setShowBillModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Fund balance */}
              <div className="ebb-modal-safe">
                <span className="ebb-modal-safe-label">Quỹ Bill đã tích lũy</span>
                <span className="ebb-modal-safe-val ebb-modal-safe-val--purple">
                  {formatCurrency(billFundBalance)}
                </span>
              </div>

              {/* Bill list */}
              <div className="ebb-modal-list">
                {billData.bills.map((bill) => {
                  const isUrgent = !bill.isPaid && bill.dueDay <= today;
                  const isSoon = !bill.isPaid && bill.dueDay > today && bill.dueDay <= today + 3;

                  return (
                    <div key={bill.id} className={`ebb-bill-item ${isUrgent ? 'ebb-bill-item--urgent' : isSoon ? 'ebb-bill-item--soon' : ''}`}>
                      <div className="ebb-bill-left">
                        <span className="ebb-bill-icon">{bill.icon}</span>
                        <div>
                          <span className="ebb-bill-name">{bill.name}</span>
                          <span className="ebb-bill-due">
                            {bill.isPaid ? '✅ Đã đóng' : `Hạn: ngày ${bill.dueDay}`}
                            {isUrgent && ' 🔴 Quá hạn!'}
                            {isSoon && ' 🟡 Sắp hạn'}
                          </span>
                        </div>
                      </div>
                      <span className={`ebb-bill-amount ${bill.isPaid ? 'ebb-bill-amount--paid' : ''}`}>
                        {formatCurrencyShort(bill.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Shortage warning */}
              {billData.accumulated < billData.total && (
                <div className="ebb-bill-shortage">
                  ⚠️ Còn thiếu {formatCurrency(billData.total - billData.accumulated)} cho tất cả bills
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
