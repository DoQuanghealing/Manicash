/* ═══ SafeToSpendCard — Primary balance card with budget breakdown ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { useSafeBalance } from '@/hooks/useSafeBalance';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './SafeToSpendCard.css';

export default function SafeToSpendCard() {
  const [showInfo, setShowInfo] = useState(false);
  const {
    safeToSpend, monthlyIncome, carryOver, totalCategoryLimits,
    totalBills, totalSavings, totalSpent, spentPercent,
    isHealthy, isLow, isNegative, warningType,
  } = useSafeBalance();

  const statusColor = isNegative ? '#EF4444' : isLow ? '#F59E0B' : '#10B981';
  const statusLabel = isNegative ? 'Nguy hiểm' : isLow ? 'Cẩn thận' : 'An toàn';
  const statusEmoji = isNegative ? '🔴' : isLow ? '🟡' : '🟢';

  return (
    <motion.div
      className="sts-card"
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
      <div className="flex items-center gap-2 mb-2">
        <p className="sts-label" style={{ marginBottom: 0 }}>SỐ DƯ AN TOÀN ĐỂ CHI TIÊU</p>
        <button onClick={() => setShowInfo(true)} className="text-gray-400 hover:text-gray-300 transition-colors">
          <Info size={14} />
        </button>
      </div>
      <p className={`sts-amount ${isNegative ? 'sts-amount--negative' : ''}`}>
        {isNegative ? '−' : ''}{formatCurrency(Math.abs(safeToSpend))}
      </p>


      {/* Formula breakdown — 5 dòng */}
      <div className="sts-breakdown">
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
          <span className="sts-breakdown-label">− Bill cố định</span>
          <span className="sts-breakdown-value sts-breakdown-negative">-{formatCurrencyShort(totalBills)}</span>
        </div>
        <div className="sts-breakdown-row">
          <span className="sts-breakdown-label">− Tiết kiệm (DP+MT+ĐT)</span>
          <span className="sts-breakdown-value sts-breakdown-negative">-{formatCurrencyShort(totalSavings)}</span>
        </div>
      </div>

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
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div 
              className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl shadow-xl"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-6 text-gray-900">
                Cách ManiCash tính Số dư an toàn
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">1</span>
                    Công thức
                  </h4>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 font-medium font-mono leading-relaxed">
                    [Thu nhập tháng]<br/>
                    <span className="text-green-500 font-bold px-1">+</span> [Dư tháng trước]<br/>
                    <span className="text-red-500 font-bold px-1">−</span> [Ngưỡng chi tiêu]<br/>
                    <span className="text-red-500 font-bold px-1">−</span> [Bill cố định]<br/>
                    <span className="text-red-500 font-bold px-1">−</span> [Tiết kiệm tháng]<br/>
                    <span className="text-indigo-500 font-bold px-1">=</span> Số dư an toàn
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">2</span>
                    Ý nghĩa
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Số này cho biết bạn còn bao nhiêu tiền <strong>thực sự</strong> có thể chi tiêu
                    sau khi đã trừ hết các khoản cứng (bill, tiết kiệm, ngưỡng hàng ngày).
                  </p>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    * Nếu số dư &lt; 0, bạn đang chi nhiều hơn thu nhập — cần cân đối ngay.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowInfo(false)}
                className="mt-8 w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-base transition-colors"
              >
                Đã hiểu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
