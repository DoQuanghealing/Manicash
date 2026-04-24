/* ═══ HealthScoreGauge — Circular SVG gauge ═══ */
'use client';

import { motion } from 'framer-motion';
import './HealthScoreGauge.css';

interface HealthScoreGaugeProps {
  score: number; // 0-100
}

export default function HealthScoreGauge({ score }: HealthScoreGaugeProps) {
  const r = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
  const label = score >= 70 ? 'Tốt' : score >= 40 ? 'Trung bình' : 'Yếu';

  return (
    <div className="hsg-container">
      <div className="hsg-header">
        <h3 className="hsg-title">Sức khỏe tài chính</h3>
      </div>

      <div className="hsg-gauge-wrap">
        <svg width="130" height="130" viewBox="0 0 120 120">
          {/* Background ring */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />

          {/* Score ring */}
          <motion.circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            transform="rotate(-90, 60, 60)"
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
          />
        </svg>

        <div className="hsg-center">
          <span className="hsg-score" style={{ color }}>{score}</span>
          <span className="hsg-label">{label}</span>
        </div>
      </div>

      <p className="hsg-desc">
        Dựa trên tỷ lệ tiết kiệm và khả năng chi tiêu an toàn
      </p>
    </div>
  );
}
