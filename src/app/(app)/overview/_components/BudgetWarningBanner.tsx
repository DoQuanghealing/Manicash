/* ═══ BudgetWarningBanner — Category overspend alerts ═══ */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetAlert } from '@/hooks/useBudgetAlert';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './BudgetWarningBanner.css';

export default function BudgetWarningBanner() {
  const { alerts, count } = useBudgetAlert();

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="bwb-container"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
      >
        <div className="bwb-header">
          <span className="bwb-header-icon">⚠️</span>
          <span className="bwb-header-text">
            {count} danh mục cần chú ý
          </span>
        </div>

        <div className="bwb-list">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.categoryId}
              className={`bwb-item ${alert.level === 'danger' ? 'bwb-item--danger' : 'bwb-item--warning'}`}
            >
              <span className="bwb-item-icon">{alert.icon}</span>
              <div className="bwb-item-info">
                <span className="bwb-item-name">{alert.categoryName}</span>
                <div className="bwb-item-bar">
                  <div
                    className="bwb-item-bar-fill"
                    style={{
                      width: `${Math.min(alert.percent, 100)}%`,
                      background: alert.level === 'danger' ? '#EF4444' : '#F59E0B',
                    }}
                  />
                </div>
              </div>
              <span className={`bwb-item-pct ${alert.level === 'danger' ? 'bwb-item-pct--danger' : ''}`}>
                {alert.percent}%
              </span>
              <span className="bwb-item-amounts">
                {formatCurrencyShort(alert.spent)}/{formatCurrencyShort(alert.limit)}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
