/* ═══ ExpenseBillBlock — Block 2: 2-column Chi tiêu + Hóa đơn ═══ */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, CreditCard, X, BarChart3, ArrowDownToLine, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useAccountOverviewSnapshot } from '@/stores/useAccountOverviewStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import { getDateKey } from '@/lib/dateHelpers';
import ExpenseFundingChartModal from './ExpenseFundingChartModal';
import SpendingDepositHistory from './SpendingDepositHistory';
import './ExpenseBillBlock.css';

const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

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
  const getAccumulatedBillTarget = useFinanceStore((s) => s.getAccumulatedBillTarget);

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

  const billData = getAccumulatedBillTarget();
  const unpaidBills = fixedBills.filter((b) => !b.isPaid);
  const today = new Date().getDate();

  const paidBills = fixedBills.filter((b) => b.isPaid);
  const upcomingBills = unpaidBills.filter((b) => {
    const daysUntilDue = b.dueDay - today;
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });

  // ── Bill aggregates (paid vs unpaid sums) ──
  const paidBillsTotal = paidBills.reduce((s, b) => s + b.amount, 0);
  const unpaidBillsTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);
  const totalBillsAmount = fixedBills.reduce((s, b) => s + b.amount, 0);
  const allBillsPaidThisMonth = fixedBills.length > 0 && unpaidBills.length === 0;

  // ── Last 7 days expense breakdown (for week bar chart) ──
  const weeklyExpenses = useMemo(() => {
    const days: { dateKey: string; label: string; weekday: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = getDateKey(d);
      days.push({
        dateKey,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        weekday: VIETNAMESE_WEEKDAYS[d.getDay()],
        amount: 0,
      });
    }
    for (const txn of transactions) {
      if (txn.type !== 'expense') continue;
      const slot = days.find((day) => day.dateKey === txn.dateKey);
      if (slot) slot.amount += txn.amount;
    }
    return days;
  }, [transactions]);

  const weeklyTotalExpense = weeklyExpenses.reduce((s, d) => s + d.amount, 0);
  const weeklyMaxAmount = Math.max(...weeklyExpenses.map((d) => d.amount), 1);

  // This week's transactions (newest first, only expenses)
  const weeklyExpenseTxns = useMemo(() => {
    const allowedKeys = new Set(weeklyExpenses.map((d) => d.dateKey));
    return transactions
      .filter((t) => t.type === 'expense' && allowedKeys.has(t.dateKey))
      .slice(0, 12);
  }, [transactions, weeklyExpenses]);

  // Bill modal categorization
  const billsSortedByDueDay = useMemo(
    () => [...fixedBills].sort((a, b) => a.dueDay - b.dueDay),
    [fixedBills],
  );
  const paidBillsSorted = billsSortedByDueDay.filter((b) => b.isPaid);
  const upcomingBillsSorted = billsSortedByDueDay.filter((b) => !b.isPaid);

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
                <h3 className="ebb-modal-title">💸 Chi tiêu tuần này</h3>
                <button className="ebb-modal-close" onClick={() => setShowExpenseModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Tổng tuần + còn lại */}
              <div className="ebb-modal-safe">
                <span className="ebb-modal-safe-label">Tổng chi tiêu 7 ngày qua</span>
                <span className="ebb-modal-safe-val">
                  {formatCurrency(weeklyTotalExpense)}
                </span>
              </div>

              {/* Bar chart 7 ngày */}
              <div className="ebb-week-chart">
                <p className="ebb-week-chart-title">Theo từng ngày</p>
                <div className="ebb-week-bars">
                  {weeklyExpenses.map((day) => {
                    const heightPct = (day.amount / weeklyMaxAmount) * 100;
                    return (
                      <div key={day.dateKey} className="ebb-week-bar-col">
                        <span className="ebb-week-bar-amt">
                          {day.amount > 0 ? formatCurrencyShort(day.amount) : ''}
                        </span>
                        <div className="ebb-week-bar-track">
                          <div
                            className="ebb-week-bar-fill"
                            style={{ height: `${Math.max(heightPct, day.amount > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="ebb-week-bar-day">{day.weekday}</span>
                        <span className="ebb-week-bar-date">{day.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions in week */}
              <div className="ebb-modal-list">
                {weeklyExpenseTxns.length === 0 ? (
                  <p className="ebb-modal-empty">Tuần này chưa có chi tiêu</p>
                ) : (
                  weeklyExpenseTxns.map((txn) => (
                    <div key={txn.id} className="ebb-txn-item">
                      <div className="ebb-txn-left">
                        <span className="ebb-txn-note">{txn.note}</span>
                        <span className="ebb-txn-time">{txn.dateLabel} • {txn.time}</span>
                      </div>
                      <span className="ebb-txn-amount">-{formatCurrencyShort(txn.amount)}</span>
                    </div>
                  ))
                )}
              </div>

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

              {/* Summary header */}
              <div className="ebb-modal-safe">
                <span className="ebb-modal-safe-label">Tổng hóa đơn tháng này</span>
                <span className="ebb-modal-safe-val ebb-modal-safe-val--purple">
                  {formatCurrency(totalBillsAmount)}
                </span>
              </div>

              {allBillsPaidThisMonth && (
                <div className="ebb-bill-complete-banner">
                  <span style={{ fontSize: '20px' }}>🎉</span>
                  <span>Đã thanh toán hết hóa đơn tháng này — gắn huy chương!</span>
                </div>
              )}

              {/* PAID section */}
              {paidBillsSorted.length > 0 && (
                <div className="ebb-bill-section">
                  <p className="ebb-bill-section-title">
                    <CheckCircle2 size={13} /> Đã đóng — {formatCurrencyShort(paidBillsTotal)}
                  </p>
                  <div className="ebb-modal-list">
                    {paidBillsSorted.map((bill) => (
                      <div key={bill.id} className="ebb-bill-item ebb-bill-item--paid">
                        <div className="ebb-bill-left">
                          <span className="ebb-bill-icon">{bill.icon}</span>
                          <div>
                            <span className="ebb-bill-name">{bill.name}</span>
                            <span className="ebb-bill-due">✅ Đã đóng — Ngày {bill.dueDay}</span>
                          </div>
                        </div>
                        <span className="ebb-bill-amount ebb-bill-amount--paid">
                          {formatCurrencyShort(bill.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UPCOMING section */}
              {upcomingBillsSorted.length > 0 && (
                <div className="ebb-bill-section">
                  <p className="ebb-bill-section-title">
                    <Clock size={13} /> Sắp đến hạn / chưa đóng — {formatCurrencyShort(unpaidBillsTotal)}
                  </p>
                  <div className="ebb-modal-list">
                    {upcomingBillsSorted.map((bill) => {
                      const isOverdue = bill.dueDay < today;
                      const isSoon = bill.dueDay >= today && bill.dueDay <= today + 3;
                      return (
                        <div
                          key={bill.id}
                          className={`ebb-bill-item ${isOverdue ? 'ebb-bill-item--urgent' : isSoon ? 'ebb-bill-item--soon' : ''}`}
                        >
                          <div className="ebb-bill-left">
                            <span className="ebb-bill-icon">{bill.icon}</span>
                            <div>
                              <span className="ebb-bill-name">{bill.name}</span>
                              <span className="ebb-bill-due">
                                {isOverdue
                                  ? `🔴 Quá hạn — ngày ${bill.dueDay}`
                                  : isSoon
                                    ? `🟡 Sắp hạn — ngày ${bill.dueDay}`
                                    : `Hạn: ngày ${bill.dueDay}`}
                              </span>
                            </div>
                          </div>
                          <span className="ebb-bill-amount">{formatCurrencyShort(bill.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
