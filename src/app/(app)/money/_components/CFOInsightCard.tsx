/* ═══ CFOInsightCard — AI Financial Analysis Card ═══ */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCFOReport } from '@/hooks/useCFOReport';
import './CFOInsightCard.css';

export default function CFOInsightCard() {
  const { insight, isLoading, fetchInsight } = useCFOReport();
  const [expanded, setExpanded] = useState(false);

  // Auto-fetch on mount
  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  return (
    <div className="cfo-card-v2">
      <div className="cfo-card-header">
        <div className="cfo-card-avatar">🧠</div>
        <div>
          <p className="cfo-card-name">AI CFO</p>
          <p className="cfo-card-role">Powered by Llama 70B</p>
        </div>
      </div>

      {isLoading ? (
        <div className="cfo-card-loading">
          <span className="cfo-shimmer" />
          <span className="cfo-shimmer cfo-shimmer--short" />
        </div>
      ) : insight ? (
        <>
          <p className="cfo-card-summary">
            &ldquo;{expanded ? insight.summary : insight.summary.slice(0, 120)}
            {!expanded && insight.summary.length > 120 ? '...' : ''}&rdquo;
          </p>

          {!expanded && insight.summary.length > 120 && (
            <button className="cfo-card-more" onClick={() => setExpanded(true)}>
              Xem thêm →
            </button>
          )}

          <AnimatePresence>
            {expanded && insight.suggestions.length > 0 && (
              <motion.div
                className="cfo-card-suggestions"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <p className="cfo-card-sug-label">💡 Gợi ý hành động:</p>
                {insight.suggestions.map((s, i) => (
                  <div key={i} className="cfo-card-sug-item">
                    <span className="cfo-card-sug-num">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <p className="cfo-card-empty">Bấm để tải phân tích AI</p>
      )}

      <button className="cfo-card-btn" onClick={() => fetchInsight()} disabled={isLoading}>
        🧠 {isLoading ? 'Đang phân tích...' : 'Phân tích lại'}
      </button>
    </div>
  );
}
