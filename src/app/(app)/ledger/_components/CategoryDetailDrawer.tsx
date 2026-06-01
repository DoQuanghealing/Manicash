/* ═══ CategoryDetailDrawer ═══════════════════════════════════════
 * Bottom sheet hiện khi user bấm vào 1 category trong tab "Danh mục".
 *
 * Cấu trúc:
 *   1. Header: icon + tên + đã chi/ngưỡng + progress bar
 *   2. Threshold input — đặt/sửa ngưỡng tháng (live update)
 *   3. Anomaly banner — nếu có ≥3 giao dịch ≥ 1.5× trung bình → đề xuất flag hàng loạt
 *   4. Top 5 giao dịch lớn nhất — mỗi item có nút ⚑
 *   5. Tất cả giao dịch (collapsible) — list đầy đủ trong tháng
 *   6. Savings preview — nếu cắt 30% các txn đã flag → tiết kiệm Xđ/tháng + Yđ/tuần
 *
 * Mobile-first: bottom sheet trượt từ dưới lên, swipe-down close, max-height 92dvh.
 * Desktop: căn giữa modal (≥640px).
 * ─────────────────────────────────────────────────────────────────── */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flag, ChevronDown } from 'lucide-react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import { computeCategoryStats } from '@/lib/categoryStats';
import './CategoryDetailDrawer.css';

interface Props {
  categoryId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/** % cắt giảm preview khi tính tiết kiệm từ flagged transactions. */
const PREVIEW_CUT = 0.3;

export default function CategoryDetailDrawer({ categoryId, isOpen, onClose }: Props) {
  // Portal vào document.body để thoát ly mọi parent có transform (vd motion.div của
  // tab switcher), nếu không position:fixed bị giam trong containing block của
  // parent → drawer to hơn khung điện thoại. SSR-safe nhờ mounted flag.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const node = (
    <AnimatePresence>
      {isOpen && categoryId && (
        <motion.div
          className="cdd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <DrawerBody key={categoryId} categoryId={categoryId} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(node, document.body);
}

interface BodyProps {
  categoryId: string;
  onClose: () => void;
}

function DrawerBody({ categoryId, onClose }: BodyProps) {
  const categories = useCategoryStore((s) => s.expenseCategories);
  const transactions = useFinanceStore((s) => s.transactions);
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentMonth = useBudgetStore((s) => s.currentMonth);
  const setCategoryBudget = useBudgetStore((s) => s.setCategoryBudget);
  const flaggedTransactionIds = useBudgetStore((s) => s.flaggedTransactionIds);
  const toggleTransactionFlag = useBudgetStore((s) => s.toggleTransactionFlag);
  const setTransactionFlags = useBudgetStore((s) => s.setTransactionFlags);
  const flaggedCategories = useBudgetStore((s) => s.flaggedCategories);
  const toggleCategoryFlag = useBudgetStore((s) => s.toggleCategoryFlag);

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId) || null,
    [categories, categoryId],
  );

  const budget = useMemo(
    () =>
      categoryBudgets.find(
        (b) => b.categoryId === categoryId && b.month === currentMonth,
      ),
    [categoryBudgets, categoryId, currentMonth],
  );

  const stats = useMemo(
    () => computeCategoryStats(transactions, categoryId, currentMonth),
    [transactions, categoryId, currentMonth],
  );

  // Init từ budget — nhờ key remount, state luôn fresh khi category đổi.
  const [showAll, setShowAll] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(() =>
    budget?.monthlyLimit ? String(budget.monthlyLimit) : '',
  );

  if (!category) return null;

  const limit = budget?.monthlyLimit || 0;
  const percent = limit > 0 ? Math.round((stats.total / limit) * 100) : 0;
  const isOver = limit > 0 && stats.total > limit;
  const isCategoryFlagged = flaggedCategories.includes(category.id);

  const flaggedInCat = stats.txns.filter((t) =>
    flaggedTransactionIds.includes(t.id),
  );
  const flaggedTotal = flaggedInCat.reduce((s, t) => s + t.amount, 0);
  const flaggedSavings = Math.round(flaggedTotal * PREVIEW_CUT);

  const anomalyIds = stats.anomalies.map((t) => t.id);
  const anomalyAllFlagged =
    anomalyIds.length > 0 &&
    anomalyIds.every((id) => flaggedTransactionIds.includes(id));

  const barColor =
    percent >= 100
      ? 'linear-gradient(90deg, #EF4444, #DC2626)'
      : percent >= 70
        ? 'linear-gradient(90deg, #F59E0B, #F97316)'
        : `linear-gradient(90deg, ${category.color}, ${category.color}CC)`;

  const handleThresholdSave = () => {
    const num = parseInt(thresholdInput.replace(/\D/g, ''), 10) || 0;
    setCategoryBudget(category.id, num);
  };

  const visibleTxns = showAll ? stats.txns : stats.topTxns;

  return (
    <motion.div
      className="cdd-sheet"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      onClick={(e) => e.stopPropagation()}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 600) onClose();
      }}
    >
            {/* Drag handle */}
            <div className="cdd-handle" />

            <button className="cdd-close" onClick={onClose}>
              <X size={18} />
            </button>

            {/* ═══ Header ═══ */}
            <div className="cdd-header">
              <div className="cdd-header-row">
                <div
                  className="cdd-header-icon"
                  style={{ background: `${category.color}22` }}
                >
                  {category.icon}
                </div>
                <div className="cdd-header-info">
                  <div className="cdd-header-name-row">
                    <h2 className="cdd-header-name">{category.name}</h2>
                    {isCategoryFlagged && (
                      <span className="cdd-header-flag-pill">⚑</span>
                    )}
                  </div>
                  <p className="cdd-header-spent">
                    {formatCurrency(stats.total)}
                    {limit > 0 && (
                      <span className="cdd-header-limit"> / {formatCurrency(limit)}</span>
                    )}
                    {' · '}
                    {stats.count} giao dịch
                  </p>
                </div>
                <button
                  className={`cdd-cat-flag-btn ${isCategoryFlagged ? 'on' : ''}`}
                  onClick={() => toggleCategoryFlag(category.id)}
                  title={isCategoryFlagged ? 'Bỏ theo dõi danh mục' : 'Theo dõi cả danh mục'}
                >
                  <Flag size={14} />
                </button>
              </div>

              {/* Progress bar */}
              {limit > 0 && (
                <div className="cdd-bar-track">
                  <motion.div
                    className="cdd-bar-fill"
                    initial={false}
                    animate={{ width: `${Math.min(100, percent)}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                    style={{ background: barColor }}
                  />
                </div>
              )}
              {limit > 0 && (
                <div className="cdd-bar-labels">
                  <span style={{ color: isOver ? 'var(--c-danger)' : 'var(--c-text-secondary)' }}>
                    {percent}% ngưỡng
                  </span>
                  {isOver ? (
                    <span style={{ color: 'var(--c-danger)' }}>
                      Vượt {formatCurrencyShort(stats.total - limit)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--c-success)' }}>
                      Còn {formatCurrencyShort(limit - stats.total)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ═══ Threshold setter ═══ */}
            <div className="cdd-section">
              <label className="cdd-section-label">⚙️ Ngưỡng tháng cho danh mục</label>
              <div className="cdd-threshold-row">
                <div className="cdd-threshold-input-wrap">
                  <input
                    className="cdd-threshold-input"
                    type="text"
                    inputMode="numeric"
                    value={thresholdInput ? Number(thresholdInput).toLocaleString('vi-VN') : ''}
                    onChange={(e) => setThresholdInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Vd: 4 000 000"
                  />
                  <span className="cdd-threshold-currency">đ</span>
                </div>
                <button
                  className="cdd-threshold-save"
                  onClick={handleThresholdSave}
                  disabled={(parseInt(thresholdInput.replace(/\D/g, ''), 10) || 0) === limit}
                >
                  Lưu
                </button>
              </div>
              {stats.count > 0 && (
                <p className="cdd-section-hint">
                  Trung bình/lần: <strong>{formatCurrencyShort(stats.avgPerTxn)}</strong>
                  {' · '}
                  Lớn nhất: <strong>{formatCurrencyShort(stats.topTxns[0]?.amount ?? 0)}</strong>
                </p>
              )}
            </div>

            {/* ═══ Pattern detection banner ═══ */}
            {stats.anomalies.length > 0 && (
              <div className="cdd-anomaly-banner">
                <div className="cdd-anomaly-icon">🚨</div>
                <div className="cdd-anomaly-body">
                  <p className="cdd-anomaly-title">
                    Phát hiện <strong>{stats.anomalies.length} giao dịch</strong> ≥{' '}
                    {formatCurrencyShort(stats.anomalyThreshold)}
                  </p>
                  <p className="cdd-anomaly-sub">
                    Tổng {formatCurrency(stats.anomalyTotal)} — chiếm{' '}
                    {Math.round((stats.anomalyTotal / stats.total) * 100)}% chi tiêu danh mục này.
                  </p>
                </div>
                <button
                  className={`cdd-anomaly-action ${anomalyAllFlagged ? 'undo' : ''}`}
                  onClick={() =>
                    setTransactionFlags(anomalyIds, !anomalyAllFlagged)
                  }
                >
                  {anomalyAllFlagged ? 'Bỏ cờ cả lô' : `⚑ Gắn cả ${anomalyIds.length}`}
                </button>
              </div>
            )}

            {/* ═══ Transactions list ═══ */}
            <div className="cdd-section">
              <div className="cdd-list-header">
                <label className="cdd-section-label">
                  {showAll ? `📋 Tất cả (${stats.count})` : `🔥 Top ${stats.topTxns.length} chi tiêu lớn nhất`}
                </label>
                {stats.count > stats.topTxns.length && (
                  <button
                    className="cdd-list-toggle"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? 'Thu gọn' : `Xem tất cả (${stats.count})`}
                    <ChevronDown size={12} className={showAll ? 'open' : ''} />
                  </button>
                )}
              </div>

              {stats.count === 0 ? (
                <p className="cdd-empty">Chưa có giao dịch tháng này</p>
              ) : (
                <div className="cdd-txn-list">
                  {visibleTxns.map((txn) => {
                    const isFlagged = flaggedTransactionIds.includes(txn.id);
                    const isAnomaly = txn.amount >= stats.anomalyThreshold && stats.anomalies.length > 0;
                    return (
                      <div
                        key={txn.id}
                        className={`cdd-txn-row ${isFlagged ? 'flagged' : ''}`}
                      >
                        <div className="cdd-txn-main">
                          <div className="cdd-txn-info">
                            <p className="cdd-txn-note">{txn.note || category.name}</p>
                            <p className="cdd-txn-date">
                              {txn.dateLabel} · {txn.time}
                              {isAnomaly && (
                                <span className="cdd-txn-anomaly-tag"> · Cao bất thường</span>
                              )}
                            </p>
                          </div>
                          <span className="cdd-txn-amount">
                            -{formatCurrencyShort(txn.amount)}
                          </span>
                        </div>
                        <button
                          className={`cdd-txn-flag-btn ${isFlagged ? 'on' : ''}`}
                          onClick={() => toggleTransactionFlag(txn.id)}
                          aria-label={isFlagged ? 'Bỏ gắn cờ' : 'Gắn cảnh báo'}
                        >
                          <Flag size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══ Savings preview ═══ */}
            {flaggedInCat.length > 0 && flaggedTotal > 0 && (
              <div className="cdd-savings">
                <p className="cdd-savings-label">
                  💰 Nếu cắt {Math.round(PREVIEW_CUT * 100)}% các khoản đã gắn cờ ({flaggedInCat.length})
                </p>
                <div className="cdd-savings-row">
                  <div>
                    <span className="cdd-savings-amount">{formatCurrency(flaggedSavings)}</span>
                    <span className="cdd-savings-period">/ tháng</span>
                  </div>
                  <div className="cdd-savings-divider" />
                  <div>
                    <span className="cdd-savings-amount">
                      {formatCurrency(Math.round(flaggedSavings / 4.33))}
                    </span>
                    <span className="cdd-savings-period">/ tuần</span>
                  </div>
                </div>
              </div>
            )}

      {/* Bottom safe padding */}
      <div className="cdd-bottom-spacer" />
    </motion.div>
  );
}
