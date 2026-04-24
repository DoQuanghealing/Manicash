/* ═══ MainBalance — Safe Balance + Financial Temperature Ring ═══ */
'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { formatCurrency } from '@/utils/formatCurrency';
import './MainBalance.css';

function getTemperatureColor(health: number): { ring: string; glow: string; label: string; emoji: string } {
  if (health >= 60) return { ring: '#10B981', glow: 'rgba(16, 185, 129, 0.4)', label: 'Khỏe mạnh', emoji: '🟢' };
  if (health >= 35) return { ring: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)', label: 'Cẩn thận', emoji: '🟡' };
  return { ring: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)', label: 'Nguy hiểm', emoji: '🔴' };
}

export default function MainBalance() {
  const safeBalance = useDashboardStore((s) => s.getSafeBalance());
  const grossBalance = useDashboardStore((s) => s.getGrossBalance());
  const health = useDashboardStore((s) => s.getFinancialHealth());

  const [showGross, setShowGross] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const temp = getTemperatureColor(health);

  // SVG ring params
  const size = 220;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (health / 100) * circumference;

  const handlePointerDown = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setShowGross(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowGross(false);
  }, []);

  const displayBalance = showGross ? grossBalance : safeBalance;
  const displayLabel = showGross ? 'Tổng tài sản' : 'Số dư an toàn để chi tiêu';

  return (
    <motion.div
      className="main-balance-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Temperature Ring + Balance */}
      <div
        className="main-balance-ring-wrapper"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* SVG Ring */}
        <svg
          className="main-balance-ring"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={stroke}
          />
          {/* Health ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={temp.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.5s ease',
              filter: `drop-shadow(0 0 6px ${temp.glow})`,
            }}
          />
          {/* Glow dot at end of ring */}
          <circle
            cx={size / 2}
            cy={stroke / 2}
            r={stroke / 2 + 2}
            fill={temp.ring}
            style={{
              filter: `drop-shadow(0 0 8px ${temp.glow})`,
              transformOrigin: `${size / 2}px ${size / 2}px`,
              transform: `rotate(${(health / 100) * 360}deg)`,
              transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: health > 2 ? 1 : 0,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="main-balance-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={showGross ? 'gross' : 'safe'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="main-balance-content"
            >
              <p className="main-balance-label">{displayLabel}</p>
              <p className="main-balance-amount">{formatCurrency(displayBalance)}</p>
            </motion.div>
          </AnimatePresence>

          {/* Temperature indicator */}
          <div className="main-balance-temp">
            <span className="main-balance-temp-emoji">{temp.emoji}</span>
            <span className="main-balance-temp-label">{temp.label}</span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="main-balance-hint">
        {showGross ? '↑ Thả để xem số dư an toàn' : '↓ Nhấn giữ để xem tổng tài sản'}
      </p>
    </motion.div>
  );
}
