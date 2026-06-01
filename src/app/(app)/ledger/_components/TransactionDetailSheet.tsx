/* ═══ TransactionDetailSheet ═════════════════════════════════════
 * Bottom sheet nhỏ hiện khi user bấm vào 1 giao dịch ở tab "Chi tiêu" của
 * Sổ sách. Mục đích chính: cho phép Gắn cờ ⚑ giao dịch đó → AI CFO biết cụ thể.
 *
 * Hiển thị: icon + tên category + note + ngày giờ + amount + nút Gắn cờ.
 * Split transaction không cần sheet này (đã có inline expand).
 * ─────────────────────────────────────────────────────────────────── */
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, X } from 'lucide-react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import type { Transaction } from '@/stores/useFinanceStore';
import type { CategoryItem } from '@/data/categories';
import { formatCurrency } from '@/utils/formatCurrency';
import './TransactionDetailSheet.css';

interface Props {
  transaction: Transaction | null;
  category: CategoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TransactionDetailSheet({
  transaction,
  category,
  isOpen,
  onClose,
}: Props) {
  const isFlagged = useBudgetStore((s) =>
    transaction ? s.flaggedTransactionIds.includes(transaction.id) : false,
  );
  const toggleTransactionFlag = useBudgetStore((s) => s.toggleTransactionFlag);

  // Portal vào body để thoát mọi parent có transform → tránh sheet vượt khung phone.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const node = (
    <AnimatePresence>
      {isOpen && transaction && (
        <motion.div
          className="tds-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="tds-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
          >
            <div className="tds-handle" />

            <button className="tds-close" onClick={onClose}>
              <X size={18} />
            </button>

            <div className="tds-content">
              <div className="tds-icon-row">
                <div
                  className="tds-icon"
                  style={{
                    background:
                      category?.color
                        ? `${category.color}22`
                        : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {category?.icon || '📦'}
                </div>
              </div>

              <p className="tds-category">{category?.name || 'Khác'}</p>
              <h3 className="tds-amount" style={{ color: transaction.type === 'income' ? 'var(--c-success)' : 'var(--c-orange)' }}>
                {transaction.type === 'income' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </h3>
              {transaction.note && <p className="tds-note">&ldquo;{transaction.note}&rdquo;</p>}

              <div className="tds-meta">
                <div>
                  <span className="tds-meta-label">Ngày</span>
                  <span className="tds-meta-value">{transaction.dateLabel}</span>
                </div>
                <div className="tds-meta-divider" />
                <div>
                  <span className="tds-meta-label">Giờ</span>
                  <span className="tds-meta-value">{transaction.time}</span>
                </div>
              </div>

              {/* Flag action — chỉ hiện cho expense, income không cần */}
              {transaction.type === 'expense' && (
                <>
                  <button
                    className={`tds-flag-btn ${isFlagged ? 'on' : ''}`}
                    onClick={() => toggleTransactionFlag(transaction.id)}
                  >
                    <Flag size={14} />
                    <span>
                      {isFlagged
                        ? 'Bỏ cảnh báo cho giao dịch này'
                        : 'Gắn cảnh báo — AI CFO sẽ nhắc nhở'}
                    </span>
                  </button>
                  {isFlagged && (
                    <p className="tds-flag-hint">
                      ✓ Đã gắn cờ. AI CFO sẽ ưu tiên đề xuất giảm khoản chi tương tự
                      trong báo cáo tháng tới.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="tds-bottom-spacer" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(node, document.body);
}
