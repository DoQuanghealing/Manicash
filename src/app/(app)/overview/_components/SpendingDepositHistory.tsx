/* ═══ SpendingDepositHistory — Modal showing income → spending transfers ═══
 *
 * Lists past `split` transactions where user moved money from Thu nhập into
 * Tài khoản chi tiêu (legacy: from main wallet into bill fund + savings).
 * Newest first, with breakdown per allocation.
 */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowDownToLine } from 'lucide-react';
import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatCurrency } from '@/utils/formatCurrency';
import './SpendingDepositHistory.css';

interface SpendingDepositHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpendingDepositHistory({ isOpen, onClose }: SpendingDepositHistoryProps) {
  const transactions = useFinanceStore((s) => s.transactions);

  const splits = useMemo(() => {
    return transactions
      .filter((t) => t.kind === 'split' && t.splitBreakdown)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);
  }, [transactions]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="sdh-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="sdh-modal"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sdh-header">
              <div className="sdh-header-title">
                <ArrowDownToLine size={18} />
                <h2>Lịch sử nạp Tài khoản chi tiêu</h2>
              </div>
              <button
                className="sdh-close"
                type="button"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </header>

            <div className="sdh-body">
              {splits.length === 0 ? (
                <div className="sdh-empty">
                  <p>Chưa có giao dịch nạp nào.</p>
                  <p className="sdh-empty-hint">
                    Khi bạn chia tiền từ thu nhập, lần chuyển sang Tài khoản chi tiêu sẽ xuất hiện ở đây.
                  </p>
                </div>
              ) : (
                <ul className="sdh-list">
                  {splits.map((txn) => {
                    const bd = txn.splitBreakdown;
                    if (!bd) return null;
                    const spendingPortion = bd.billFund;
                    const savingPortion = bd.reserve + bd.goals + bd.investment;
                    return (
                      <li key={txn.id} className="sdh-item">
                        <div className="sdh-item-row1">
                          <span className="sdh-item-date">
                            {txn.dateLabel} · {txn.time}
                          </span>
                          <span className="sdh-item-amount">
                            +{formatCurrency(spendingPortion)}
                          </span>
                        </div>
                        <div className="sdh-item-row2">
                          <span className="sdh-item-note">
                            Vào Tài khoản chi tiêu
                          </span>
                          {savingPortion > 0 && (
                            <span className="sdh-item-side">
                              · và {formatCurrency(savingPortion)} sang Tiết kiệm
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
