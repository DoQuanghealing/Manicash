/* ═══ HallOfFame — Rank dashboard with XP bar + forecast ═══ */
'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RANKS, getRankProgress } from '@/data/rankDefinitions';
import { useTaskStore } from '@/stores/useTaskStore';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './HallOfFame.css';

interface HallOfFameProps {
  currentXP: number;
}

export default function HallOfFame({ currentXP }: HallOfFameProps) {
  const { current, next, progress } = getRankProgress(currentXP);
  const totalEarned = useTaskStore((s) => s.getTotalEarned());
  const xpMultiplier = useTaskStore((s) => s.getActiveXPMultiplier());

  // Forecast: estimate time to a big goal based on earning rate
  const forecast = useMemo(() => {
    if (totalEarned <= 0) return null;
    // Assume monthly earning rate ~ totalEarned (simplified)
    const monthlyRate = totalEarned;
    const goalAmount = 6_000_000_000; // Mua nhà
    const months = Math.ceil(goalAmount / monthlyRate);
    const years = Math.floor(months / 12);
    const remainMonths = months % 12;
    return { years, months: remainMonths, goalName: 'Mua nhà 🏠' };
  }, [totalEarned]);

  return (
    <div className="hof-container">
      {/* Current rank hero */}
      <div className="hof-hero">
        <motion.div
          className="hof-badge"
          style={{
            background: `linear-gradient(135deg, ${current.gradientFrom}, ${current.gradientTo})`,
            boxShadow: `0 0 24px ${current.gradientFrom}40`,
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="hof-badge-icon">{current.icon}</span>
        </motion.div>
        <h2 className="hof-rank-name">{current.name}</h2>
        <p className="hof-xp">{currentXP.toLocaleString()} XP</p>
      </div>

      {/* XP Progress to next rank */}
      {next && (
        <div className="hof-progress-section">
          <div className="hof-progress-header">
            <span className="hof-progress-label">Tiến tới {next.name} {next.icon}</span>
            <span className="hof-progress-pct">{progress}%</span>
          </div>
          <div className="hof-progress-bar">
            <motion.div
              className="hof-progress-fill"
              style={{
                background: `linear-gradient(90deg, ${current.gradientFrom}, ${next.gradientFrom})`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="hof-progress-labels">
            <span>{currentXP.toLocaleString()}</span>
            <span>{next.xpRequired.toLocaleString()} XP</span>
          </div>
        </div>
      )}

      {/* XP Multiplier penalty warning */}
      {xpMultiplier < 1 && (
        <div className="hof-penalty">
          ⚡ XP giảm {Math.round((1 - xpMultiplier) * 100)}% do trễ hạn
        </div>
      )}

      {/* Goal forecast */}
      {forecast && (
        <div className="hof-forecast">
          <span className="hof-forecast-label">📊 Dự báo: {forecast.goalName}</span>
          <span className="hof-forecast-value">
            ~{forecast.years > 0 ? `${forecast.years} năm ` : ''}{forecast.months} tháng
          </span>
          <span className="hof-forecast-sub">Dựa trên thu nhập hiện tại: {formatCurrencyShort(totalEarned)}/tháng</span>
        </div>
      )}

      {/* Rank roadmap mini */}
      <div className="hof-roadmap">
        {RANKS.map((r) => {
          const isActive = r.id === current.id;
          const isPast = r.xpRequired <= currentXP;
          return (
            <div key={r.id} className={`hof-roadmap-item ${isActive ? 'hof-roadmap-item--active' : ''} ${isPast ? 'hof-roadmap-item--past' : ''}`}>
              <span className="hof-roadmap-icon">{r.icon}</span>
              <span className="hof-roadmap-name">{r.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
