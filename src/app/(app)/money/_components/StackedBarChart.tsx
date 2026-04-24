/* ═══ StackedBarChart — SVG bar chart Thu/Chi ═══ */
'use client';

import { motion } from 'framer-motion';
import type { WeekBarData } from '@/hooks/useChartData';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './StackedBarChart.css';

interface StackedBarChartProps {
  data: WeekBarData[];
}

export default function StackedBarChart({ data }: StackedBarChartProps) {
  const maxVal = Math.max(...data.map((d) => d.income + d.expense), 1);
  const barWidth = 28;
  const gap = 20;
  const chartH = 140;
  const totalW = data.length * (barWidth * 2 + gap) + gap;

  return (
    <div className="sbc-container">
      <div className="sbc-header">
        <h3 className="sbc-title">Thu — Chi theo tuần</h3>
        <div className="sbc-legend">
          <span className="sbc-legend-item"><span className="sbc-dot sbc-dot--income" /> Thu</span>
          <span className="sbc-legend-item"><span className="sbc-dot sbc-dot--expense" /> Chi</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${totalW} ${chartH + 30}`} className="sbc-svg">
        {data.map((d, i) => {
          const x = gap + i * (barWidth * 2 + gap);
          const incomeH = (d.income / maxVal) * chartH;
          const expenseH = (d.expense / maxVal) * chartH;

          return (
            <g key={d.label}>
              {/* Income bar */}
              <motion.rect
                x={x}
                y={chartH - incomeH}
                width={barWidth}
                height={incomeH}
                rx={4}
                fill="url(#incomeGrad)"
                initial={{ height: 0, y: chartH }}
                animate={{ height: incomeH, y: chartH - incomeH }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
              {/* Expense bar */}
              <motion.rect
                x={x + barWidth + 4}
                y={chartH - expenseH}
                width={barWidth}
                height={expenseH}
                rx={4}
                fill="url(#expenseGrad)"
                initial={{ height: 0, y: chartH }}
                animate={{ height: expenseH, y: chartH - expenseH }}
                transition={{ duration: 0.8, delay: i * 0.1 + 0.05 }}
              />
              {/* Label */}
              <text x={x + barWidth} y={chartH + 18} textAnchor="middle" className="sbc-label">
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Gradients */}
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
      </svg>

      {/* Values */}
      <div className="sbc-values">
        {data.map((d) => (
          <div key={d.label} className="sbc-value-col">
            <span className="sbc-val sbc-val--income">{formatCurrencyShort(d.income)}</span>
            <span className="sbc-val sbc-val--expense">{formatCurrencyShort(d.expense)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
