/* ═══ SafeToSpendCard — Primary balance card with budget breakdown ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, Lightbulb, ChevronDown } from 'lucide-react';
import { useSafeBalance } from '@/hooks/useSafeBalance';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './SafeToSpendCard.css';

export default function SafeToSpendCard() {
  const [showInfo, setShowInfo] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const {
    safeToSpend, monthlyIncome, carryOver, totalCategoryLimits,
    totalBills, totalSavings,
    isLow, isNegative,
  } = useSafeBalance();

  const statusColor = isNegative ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';
  const statusLabel = isNegative ? 'Nguy hiểm' : isLow ? 'Cẩn thận' : 'An toàn';
  const statusEmoji = isNegative ? '🔴' : isLow ? '🟡' : '🟢';

  return (
    <motion.div
      className="sts-card"
      id="safe-to-spend-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Status badge */}
      <div className="sts-status" style={{ color: statusColor }}>
        <span>{statusEmoji}</span>
        <span>{statusLabel}</span>
      </div>

      {/* Main balance */}
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: '14px' }}>✨</span>
        <p className="sts-label" style={{ marginBottom: 0 }}>CÓ THỂ TIÊU THÊM</p>
        <button onClick={() => setShowInfo(true)} className="text-gray-400 hover:text-gray-300 transition-colors">
          <Info size={14} />
        </button>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--c-text-tertiary)', marginBottom: '12px', fontWeight: 500 }}>
        Sau khi đã trừ chi tiêu + bill + tiết kiệm
      </p>
      <p className={`sts-amount ${isNegative ? 'sts-amount--negative' : ''}`}>
        {isNegative ? '−' : ''}{formatCurrency(Math.abs(safeToSpend))}
      </p>


      {/* Nút bung breakdown — thay vì luôn hiện 5 dòng, giữ hero gọn theo thiết kế mới */}
      <button
        type="button"
        className="sts-breakdown-toggle"
        onClick={() => setShowBreakdown((v) => !v)}
      >
        <span>Cách tính số này</span>
        <ChevronDown size={15} className={showBreakdown ? 'sts-chevron--open' : ''} />
      </button>

      <AnimatePresence initial={false}>
        {showBreakdown && (
          <motion.div
            className="sts-breakdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="sts-breakdown-row">
              <span className="sts-breakdown-label">Tổng thu nhập tháng</span>
              <span className="sts-breakdown-value">{formatCurrencyShort(monthlyIncome)}</span>
            </div>
            {carryOver !== 0 && (
              <div className="sts-breakdown-row">
                <span className="sts-breakdown-label">+ Dư tháng trước</span>
                <span className="sts-breakdown-value sts-breakdown-positive">+{formatCurrencyShort(carryOver)}</span>
              </div>
            )}
            <div className="sts-breakdown-row">
              <span className="sts-breakdown-label">− Ngưỡng chi tiêu</span>
              <span className="sts-breakdown-value sts-breakdown-negative">-{formatCurrencyShort(totalCategoryLimits)}</span>
            </div>
            <div className="sts-breakdown-row">
              <span className="sts-breakdown-label">− Bill chưa đóng</span>
              <span className="sts-breakdown-value sts-breakdown-negative">-{formatCurrencyShort(totalBills)}</span>
            </div>
            <div className="sts-breakdown-row">
              <span className="sts-breakdown-label">− Mục tiêu tiết kiệm/tháng</span>
              <span className="sts-breakdown-value sts-breakdown-negative">-{formatCurrencyShort(totalSavings)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Warning Card: Số dư ≤ 0 ═══ */}
      {isNegative && (
        <motion.div
          className="sts-warning-card sts-warning-card--danger"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="sts-warning-header">
            <AlertTriangle size={16} color="#EF4444" />
            <span>Bạn đang xài nhiều hơn thu nhập!</span>
          </div>
          <p className="sts-warning-question">
            Bạn có khoản thu nhập nào đắp vào để cân đối chi tiêu không?
          </p>
          <div className="sts-warning-suggestions">
            <div className="sts-suggestion">💸 Đòi nợ cũ (nếu có ai nợ)</div>
            <div className="sts-suggestion">💼 Lên kế hoạch kiếm thêm tiền ngay</div>
            <div className="sts-suggestion">🏠 Xin hỗ trợ từ gia đình</div>
            <div className="sts-suggestion">🤝 Mượn ai đó (phải có kế hoạch trả)</div>
          </div>
        </motion.div>
      )}

      {/* ═══ Encouragement Card: 0 < số dư ≤ 1 triệu ═══ */}
      {isLow && (
        <motion.div
          className="sts-warning-card sts-warning-card--low"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="sts-warning-header">
            <Lightbulb size={16} color="#F59E0B" />
            <span>Số dư đang mỏng</span>
          </div>
          <p className="sts-warning-text">
            💪 Hãy lập kế hoạch kiếm thêm tiền để an tâm hơn! Số dư dưới 1 triệu rất dễ bị thiếu hụt bất ngờ.
          </p>
        </motion.div>
      )}

      {/* ═══ Modal giải thích ═══ */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="sts-info-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              className="sts-info-card"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="sts-info-title">
                Cách ManiCash tính Số dư an toàn
              </h3>

              <div className="sts-info-section">
                <h4 className="sts-info-subtitle">
                  <span className="sts-info-num">1</span>
                  Công thức
                </h4>
                <div className="sts-info-formula">
                  [Thu nhập tháng]<br />
                  <span className="sts-info-op sts-info-op--plus">+</span> [Dư tháng trước]<br />
                  <span className="sts-info-op sts-info-op--minus">−</span> [Ngưỡng chi tiêu]<br />
                  <span className="sts-info-op sts-info-op--minus">−</span> [Bill chưa đóng]<br />
                  <span className="sts-info-op sts-info-op--minus">−</span> [Mục tiêu tiết kiệm/tháng]<br />
                  <span className="sts-info-op sts-info-op--eq">=</span> Số dư an toàn
                </div>
              </div>

              <div className="sts-info-section">
                <h4 className="sts-info-subtitle">
                  <span className="sts-info-num">2</span>
                  Ý nghĩa
                </h4>
                <p className="sts-info-text">
                  Số này cho biết bạn còn bao nhiêu tiền <strong>thực sự</strong> có thể chi tiêu
                  sau khi đã trừ hết các khoản cứng (bill, tiết kiệm, ngưỡng hàng ngày).
                </p>
                <p className="sts-info-note">
                  * Nếu số dư &lt; 0, bạn đang chi nhiều hơn thu nhập — cần cân đối ngay.
                </p>
              </div>

              <button onClick={() => setShowInfo(false)} className="sts-info-btn">
                Đã hiểu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
