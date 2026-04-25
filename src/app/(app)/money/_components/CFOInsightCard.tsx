/* ═══ CFOInsightCard — AI Financial Analysis Card ═══
 * Stateless về data — insight + loading/error/refresh được lift lên MoneyContent
 * để share với HealthScoreGauge. Component này chỉ giữ UI state (showSuggestions).
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CFOInsight } from '@/lib/groqClient';
import './CFOInsightCard.css';

/** "Vừa xong" / "X phút trước" / "X giờ trước" — relative time tiếng Việt. */
function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - timestamp);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Cập nhật vừa xong';
  if (diffMin < 60) return `Cập nhật ${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  return `Cập nhật ${diffHour} giờ trước`;
}

export interface CFOInsightCardProps {
  insight: CFOInsight | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  onRefresh: () => void;
}

export default function CFOInsightCard({
  insight,
  isLoading,
  error,
  lastUpdated,
  onRefresh,
}: CFOInsightCardProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  // === Error + chưa từng load thành công → error UI riêng (không có insight cũ để show) ===
  if (error && !insight) {
    return (
      <div className="cfo-card-v2">
        <div className="cfo-card-header">
          <div className="cfo-card-avatar">🧠</div>
          <div>
            <p className="cfo-card-name">AI CFO</p>
            <p className="cfo-card-role">Powered by Llama 70B</p>
          </div>
        </div>
        <p className="cfo-card-error">
          Không kết nối được AI CFO. Thử lại sau nhé cậu chủ.
        </p>
        <button className="cfo-card-btn" onClick={onRefresh} disabled={isLoading}>
          🔄 {isLoading ? 'Đang thử lại...' : 'Thử lại'}
        </button>
      </div>
    );
  }

  // Badge chỉ hiện khi có insight + không loading + không error (tránh flicker).
  const showBadge = insight && !isLoading && !error;
  const hasSuggestions = insight && insight.suggestions.length > 0;

  return (
    <div className="cfo-card-v2">
      <div className="cfo-card-header">
        <div className="cfo-card-avatar">🧠</div>
        <div>
          <p className="cfo-card-name">AI CFO</p>
          <p className="cfo-card-role">Powered by Llama 70B</p>
        </div>
        {showBadge && (
          <span
            className={`cfo-card-badge ${
              insight.source === 'ai' ? 'cfo-card-badge--ai' : 'cfo-card-badge--quick'
            }`}
          >
            {insight.source === 'ai' ? '🧠 AI Analysis' : '⚡ Quick Analysis'}
          </span>
        )}
      </div>

      {/* Banner stale data — có insight cũ nhưng refresh fail */}
      {error && insight && (
        <div className="cfo-card-stale-banner">
          ⚠️ Chưa cập nhật được số mới nhất
        </div>
      )}

      {isLoading && !insight ? (
        <div className="cfo-card-loading">
          <span className="cfo-shimmer" />
          <span className="cfo-shimmer cfo-shimmer--short" />
        </div>
      ) : insight ? (
        <>
          <p className="cfo-card-summary">
            &ldquo;{insight.summary}&rdquo;
          </p>

          {hasSuggestions && (
            <button
              className="cfo-card-more"
              onClick={() => setShowSuggestions((v) => !v)}
            >
              {showSuggestions ? 'Ẩn gợi ý' : '💡 Xem gợi ý hành động →'}
            </button>
          )}

          <AnimatePresence>
            {showSuggestions && hasSuggestions && (
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

          {lastUpdated !== null && (
            <p className="cfo-card-updated">{formatRelativeTime(lastUpdated)}</p>
          )}
        </>
      ) : (
        <p className="cfo-card-empty">Đang tải phân tích AI...</p>
      )}

      <button
        className="cfo-card-btn"
        onClick={onRefresh}
        disabled={isLoading}
      >
        🧠 {isLoading ? 'Đang phân tích...' : 'Phân tích lại'}
      </button>
    </div>
  );
}
