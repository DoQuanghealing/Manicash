/* ═══ MonthlyReportModal — Butler báo cáo cuối tháng ═══
 * Mount khi useBudgetStore.unviewedReportMonth !== null.
 * User click "Đã xem" → markReportViewed → modal đóng + không show lại tháng này.
 */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { formatCurrency } from '@/utils/formatCurrency';
import './MonthlyReportModal.css';

const TIER_LABEL: Record<'good' | 'fair' | 'poor', string> = {
  good: 'TỐT',
  fair: 'TRUNG BÌNH',
  poor: 'CẦN CẢI THIỆN',
};

const TIER_EMOJI: Record<'good' | 'fair' | 'poor', string> = {
  good: '🏆',
  fair: '💪',
  poor: '🤝',
};

export default function MonthlyReportModal() {
  const report = useBudgetStore((s) => s.getUnviewedReport());
  const markReportViewed = useBudgetStore((s) => s.markReportViewed);

  // No-op khi chưa có report mới.
  if (!report || !report.butlerReport) return null;

  const r = report.butlerReport;
  const tierEmoji = TIER_EMOJI[r.tier];
  const tierLabel = TIER_LABEL[r.tier];
  const billsRate = r.metrics.billsTotal > 0
    ? Math.round((r.metrics.billsPaidOnTime / r.metrics.billsTotal) * 100)
    : 100;
  const budgetRate = r.metrics.categoriesTotal > 0
    ? Math.round((r.metrics.categoriesOnTrack / r.metrics.categoriesTotal) * 100)
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="mrm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={markReportViewed}
      >
        <motion.div
          className={`mrm-card mrm-tier-${r.tier}`}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <div className="mrm-header">
            <span className="mrm-emoji">{tierEmoji}</span>
            <p className="mrm-title">Báo cáo tháng {report.month}</p>
            <p className="mrm-tier">Sức khỏe: {tierLabel}</p>
          </div>

          <p className="mrm-summary">🎩 {r.summary}</p>

          <div className="mrm-metrics">
            <div className="mrm-metric">
              <span className="mrm-metric-label">Giao dịch</span>
              <span className="mrm-metric-value">{r.metrics.transactionCount}</span>
            </div>
            <div className="mrm-metric">
              <span className="mrm-metric-label">Bill đúng hạn</span>
              <span className="mrm-metric-value">
                {r.metrics.billsPaidOnTime}/{r.metrics.billsTotal} ({billsRate}%)
              </span>
            </div>
            <div className="mrm-metric">
              <span className="mrm-metric-label">Ngân sách giữ vững</span>
              <span className="mrm-metric-value">
                {r.metrics.categoriesOnTrack}/{r.metrics.categoriesTotal} ({budgetRate}%)
              </span>
            </div>
            <div className="mrm-metric">
              <span className="mrm-metric-label">Dư ra</span>
              <span className="mrm-metric-value">
                {r.metrics.surplus > 0 ? formatCurrency(r.metrics.surplus) : '—'}
              </span>
            </div>
            {r.xpEarned > 0 && (
              <div className="mrm-metric mrm-xp">
                <span className="mrm-metric-label">⚡ XP tháng</span>
                <span className="mrm-metric-value">+{r.xpEarned}</span>
              </div>
            )}
          </div>

          <button className="mrm-close-btn" onClick={markReportViewed}>
            Đã xem 🎯
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
