/* ═══ SavingsLineChart — SVG line chart for savings growth ═══ */
'use client';

import { motion } from 'framer-motion';
import type { SavingsPoint } from '@/hooks/useChartData';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './SavingsLineChart.css';

interface SavingsLineChartProps {
  data: SavingsPoint[];
}

export default function SavingsLineChart({ data }: SavingsLineChartProps) {
  if (data.length < 2) return null;

  const chartW = 280;
  const chartH = 120;
  const padX = 10;
  const padY = 10;

  const max = Math.max(...data.map((d) => d.amount));
  const min = Math.min(...data.map((d) => d.amount));
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (chartW - padX * 2),
    y: padY + (1 - (d.amount - min) / range) * (chartH - padY * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${chartH} L${points[0].x},${chartH} Z`;

  return (
    <div className="slc-container">
      <div className="slc-header">
        <h3 className="slc-title">Tăng trưởng tiết kiệm</h3>
        <span className="slc-total">{formatCurrencyShort(data[data.length - 1].amount)}</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 24}`} className="slc-svg">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.path
          d={areaD}
          fill="url(#areaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />

        {/* Line */}
        <motion.path
          d={pathD}
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={data[i].label}>
            <motion.circle
              cx={p.x} cy={p.y} r="3"
              fill="#7C3AED" stroke="#1C1930" strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            />
            <text x={p.x} y={chartH + 16} textAnchor="middle" className="slc-label">
              {data[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
