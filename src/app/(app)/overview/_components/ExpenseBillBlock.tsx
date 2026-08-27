/* ═══ ExpenseBillBlock — Block 2: 2-column Chi tiêu + Hóa đơn ═══ */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, CreditCard, X, BarChart3, ArrowDownToLine, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useAccountOverviewSnapshot } from '@/stores/useAccountOverviewStore';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import ExpenseFundingChartModal from './ExpenseFundingChartModal';
import SpendingDepositHistory from './SpendingDepositHistory';
import ExpenseBreakdownPanel from './ExpenseBreakdownPanel';
import BillBreakdownPanel from './BillBreakdownPanel';
import './ExpenseBillBlock.css';

export default function ExpenseBillBlock() {
  const router = useRouter();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showFundingChart, setShowFundingChart] = useState(false);
  const [showDepositHistory, setShowDepositHistory] = useState(false);
  const { accounts } = useAccountOverviewSnapshot();
  const expenseFunding = accounts.expense.expenseFunding;

  // Chi tiêu tháng hiện tại (đồng bộ với Sổ sách)
  const totalExpense = useFinanceStore((s) => s.getExpenseForMonth(s.getCurrentMonthKey()));
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);

  // ── Tài khoản chi tiêu hiện có (legacy mapping: main + billFund) ──
  // Theo ADR 0001 3-account model, "Tài khoản chi tiêu" gộp main + billFund.
  // Khi Phase 1 read model merged + flag bật, đoạn này sẽ refactor sang
  // useThreeAccountSnapshot().spending.balance.
  const spendingAccountBalance = mainBalance + billFundBalance;
  const spendingTarget = expenseFunding?.target ?? 0;
  const spendingSurplus = spendingAccountBalance - spendingTarget;
  const spendingFundedPercent = spendingTarget > 0
    ? Math.min(100, (spendingAccountBalance / spendingTarget) * 100)
    : 100;

  // Ngưỡng chi tiêu từ budgetStore (đồng bộ với Sổ sách → Ngưỡng)
  const spendingLimit = useBudgetStore((s) => s.getTotalCategoryLimits());

  const remainingToSpend = Math.max(0, spendingLimit - totalExpense);
  const spendingPercent = spendingLimit > 0 ? Math.min(100, (totalExpense / spendingLimit) * 100) : 0;
  const isOverBudget = totalExpense > spendingLimit;

  const unpaidBills = fixedBills.filter((b) => !b.isPaid);
  const paidBills = fixedBills.filter((b) => b.isPaid);

  // ── Bill aggregates (paid vs unpaid sums) ──
  const paidBillsTotal = paidBills.reduce((s, b) => s + b.amount, 0);
  const unpaidBillsTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);
  const totalBillsAmount = fixedBills.reduce((s, b) => s + b.amount, 0);
  const allBillsPaidThisMonth = fixedBills.length > 0 && unpaidBills.length === 0;

  /** Dãy ô trạng thái ở thẻ thu gọn — xếp theo hạn đóng. */
  const billsSortedByDueDay = useMemo(
    () => [...fixedBills].sort((a, b) => a.dueDay - b.dueDay),
    [fixedBills],
  );

  return (
    <>
      <div className="ebb-funding-wrap">
        {/* ═══ Tài khoản chi tiêu hiện có ═══ */}
        <div className="ebb-spending-account">
          <div className="ebb-spending-row">
            <div className="ebb-spending-copy">
              <div className="ebb-spending-title-row">
                <span className="ebb-spending-icon">🏦</span>
                <p className="ebb-spending-label">TÀI KHOẢN CHI TIÊU HIỆN CÓ</p>
              </div>
              <p className="ebb-spending-amount">{formatCurrencyShort(spendingAccountBalance)}</p>
              {spendingTarget > 0 && (
                <p className="ebb-spending-meta">
                  Cần {formatCurrencyShort(spendingTarget)} cho tháng này
                </p>
              )}
            </div>
            <button
              className="ebb-spending-history-btn"
              type="button"
              onClick={() => setShowDepositHistory(true)}
              aria-label="Xem lịch sử nạp Tài khoản chi tiêu"
            >
              <ArrowDownToLine size={14} />
              <span>Lịch sử nạp</span>
            </button>
          </div>
          {spendingTarget > 0 && (
            <>
              <div className="ebb-spending-progress">
                <div
                  className={`ebb-spending-progress-fill ${
                    spendingSurplus < 0 ? 'ebb-spending-progress-fill--warn' : ''
                  }`}
                  style={{ width: `${spendingFundedPercent}%` }}
                />
              </div>
              {spendingSurplus >= 0 ? (
                <p className="ebb-spending-status ebb-spending-status--ok">
                  ✅ Đã nạp đủ {spendingSurplus > 0 && `+ dư ${formatCurrencyShort(spendingSurplus)}`}
                </p>
              ) : (
                <p className="ebb-spending-status ebb-spending-status--warn">
                  ⚠️ Thiếu {formatCurrencyShort(Math.abs(spendingSurplus))} — chuyển thêm từ Thu nhập
                </p>
              )}
            </>
          )}
        </div>

        {expenseFunding && (
          <div className="ebb-funding-header">
            <div className="ebb-funding-copy">
              <div className="ebb-funding-title-row">
                <span className="ebb-funding-icon">📋</span>
                <p className="ebb-funding-label">NGÂN SÁCH THÁNG</p>
              </div>
              <p className="ebb-funding-amount">{formatCurrencyShort(expenseFunding.target)}</p>
              <p className="ebb-funding-formula">
                Ngưỡng hằng ngày {formatCurrencyShort(expenseFunding.dailyLimit)} + Hóa đơn cố định {formatCurrencyShort(expenseFunding.fixedBillsTotal)}
              </p>
              {expenseFunding.fixedBillsOverfunded && expenseFunding.fixedBillsOverfunded > 0 ? (
                <p className="ebb-funding-status" style={{ color: '#10B981', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>
                  ✅ Tài khoản chi tiêu đã đủ + dư {formatCurrencyShort(expenseFunding.fixedBillsOverfunded)}
                </p>
              ) : expenseFunding.fixedBillsProgress !== undefined && expenseFunding.fixedBillsProgress < 1 ? (
                <p className="ebb-funding-status" style={{ color: '#F59E0B', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>
                  ⚠️ Tài khoản chi tiêu còn thiếu {formatCurrencyShort(expenseFunding.fixedBillsTotal - expenseFunding.billFundBalance)}
                </p>
              ) : null}
            </div>
            <button
              className="ebb-chart-btn"
              type="button"
              onClick={() => setShowFundingChart(true)}
              aria-label="Mở biểu đồ ngân sách chi tiêu"
            >
              <BarChart3 size={17} />
            </button>
          </div>
        )}

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
            {/* Row 1: Icon + Label */}
            <div className="ebb-card-row1">
              <div className="ebb-card-icon-sm" style={{ background: 'rgba(249, 115, 22, 0.12)' }}>
                <ShoppingBag size={14} color="#F97316" />
              </div>
              <p className="ebb-card-label" style={{ color: '#F97316' }}>Chi tiêu</p>
            </div>

            {/* Row 2: Đã chi */}
            <div className="ebb-spend-line">
              <span className="ebb-spend-line-label">Đã chi:</span>
              <span className={`ebb-spend-line-value ${isOverBudget ? 'ebb-spend-line-value--danger' : ''}`}>
                {formatCurrencyShort(totalExpense)}
              </span>
            </div>

            {/* Row 3: Còn lại */}
            <p className="ebb-spend-remaining">
              Còn lại <strong>{formatCurrencyShort(remainingToSpend)}</strong> có thể chi tiêu
            </p>

            {/* Row 4: Progress with bottom + top-end labels */}
            <div className="ebb-spend-progress-wrap">
              <span className="ebb-spend-progress-cap">{formatCurrencyShort(spendingLimit)}</span>
              <div className="ebb-progress">
                <div
                  className={`ebb-progress-fill ${isOverBudget ? 'ebb-progress-fill--danger' : ''}`}
                  style={{ width: `${spendingPercent}%` }}
                />
              </div>
              <span className="ebb-spend-progress-current">{formatCurrencyShort(totalExpense)}</span>
            </div>
          </motion.button>

          {/* ═══ Card 2: Hóa đơn ═══ */}
          <motion.button
            className={`ebb-card ebb-card--bills ${allBillsPaidThisMonth ? 'ebb-card--complete' : ''}`}
            onClick={() => setShowBillModal(true)}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {allBillsPaidThisMonth && (
              <span className="ebb-bill-medal" aria-label="Tháng này hoàn thành mọi hóa đơn">🏅</span>
            )}

            {/* Row 1: Icon + Label */}
            <div className="ebb-card-row1">
              <div className="ebb-card-icon-sm" style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
                <CreditCard size={14} color="#8B5CF6" />
              </div>
              <p className="ebb-card-label" style={{ color: '#8B5CF6' }}>Hóa đơn</p>
            </div>

            {/* Row 2: Tổng hóa đơn */}
            <p className="ebb-card-amount">{formatCurrencyShort(totalBillsAmount)}</p>

            {/* Row 3: Paid summary */}
            <div className="ebb-bill-summary ebb-bill-summary--paid">
              <CheckCircle2 size={11} />
              <span>
                Đã đóng {paidBills.length}: <strong>{formatCurrencyShort(paidBillsTotal)}</strong>
              </span>
            </div>

            {/* Row 4: Unpaid summary OR completed */}
            {allBillsPaidThisMonth ? (
              <div className="ebb-bill-summary ebb-bill-summary--complete">
                <span>✅</span>
                <span>Hoàn thành tháng này</span>
              </div>
            ) : (
              <div className="ebb-bill-summary ebb-bill-summary--pending">
                <Clock size={11} />
                <span>
                  Còn {unpaidBills.length}: <strong>{formatCurrencyShort(unpaidBillsTotal)}</strong>
                </span>
              </div>
            )}

            {/* Row 5: Box-per-bill status indicator */}
            {billsSortedByDueDay.length > 0 && (
              <div className="ebb-bill-boxes" aria-label="Trạng thái từng hóa đơn">
                {billsSortedByDueDay.map((bill, idx) => {
                  const isHighValue = bill.amount > 5_000_000;
                  const titleParts = [
                    bill.name,
                    formatCurrencyShort(bill.amount),
                    bill.isPaid ? 'đã đóng' : `hạn ngày ${bill.dueDay}`,
                  ];
                  if (isHighValue) titleParts.push('quan trọng');
                  return (
                    <div
                      key={bill.id}
                      className={`ebb-bill-box ${bill.isPaid ? 'ebb-bill-box--paid' : 'ebb-bill-box--unpaid'}`}
                      title={titleParts.join(' — ')}
                      style={!bill.isPaid ? { animationDelay: `${(idx % 4) * 0.12}s` } : undefined}
                    >
                      {isHighValue && (
                        <span className="ebb-bill-box-star" aria-hidden="true">★</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.button>
        </div>
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
                <h3 className="ebb-modal-title">💸 Chi tiêu</h3>
                <button className="ebb-modal-close" onClick={() => setShowExpenseModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Ngày/Tuần/Tháng/Năm + dải cột so sánh + vành khuyên phân bổ. */}
              <ExpenseBreakdownPanel transactions={transactions} />

              <button
                type="button"
                className="ebb-modal-cta"
                onClick={() => {
                  setShowExpenseModal(false);
                  router.push('/ledger');
                }}
              >
                <span>Xem đầy đủ ở Sổ sách</span>
                <ArrowRight size={14} />
              </button>
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
                <h3 className="ebb-modal-title">
                  🧾 Hóa đơn cố định
                  {allBillsPaidThisMonth && <span className="ebb-modal-medal">🏅</span>}
                </h3>
                <button className="ebb-modal-close" onClick={() => setShowBillModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {allBillsPaidThisMonth && (
                <div className="ebb-bill-complete-banner">
                  <span style={{ fontSize: '20px' }}>🎉</span>
                  <span>Đã thanh toán hết hóa đơn tháng này — gắn huy chương!</span>
                </div>
              )}

              {/* Hạn đóng có màu · biểu đồ cột theo năm từng hóa đơn · vành khuyên
                * cơ cấu + tỷ trọng trên thu nhập · nút sang Sổ sách để sửa số. */}
              <BillBreakdownPanel onNavigate={() => setShowBillModal(false)} />

            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFundingChart && expenseFunding && (
          <ExpenseFundingChartModal
            funding={expenseFunding}
            onClose={() => setShowFundingChart(false)}
          />
        )}
      </AnimatePresence>

      <SpendingDepositHistory
        isOpen={showDepositHistory}
        onClose={() => setShowDepositHistory(false)}
      />
    </>
  );
}
