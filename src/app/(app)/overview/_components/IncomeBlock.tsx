/* ═══ IncomeBlock — Block 1: Full-width Income Card + SVG Line Chart ═══ */
'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useWalletBankStore } from '@/stores/useWalletBankStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import WalletBankModal from './WalletBankModal';
import './IncomeBlock.css';

type Period = 'day' | 'week' | 'month' | 'year';

interface ChartPoint {
  label: string;
  value: number;
}

export default function IncomeBlock() {
  const [period, setPeriod] = useState<Period>('month');
  const [showBankModal, setShowBankModal] = useState(false);
  const transactions = useFinanceStore((s) => s.transactions);
  const wallets = useWalletBankStore((s) => s.wallets);
  const incomeWallet = wallets.find((w) => w.id === 'income');

  // ═══ Compute income data by period ═══
  const { totalIncome, chartData } = useMemo(() => {
    const now = new Date();
    const incomeTxns = transactions.filter((t) => t.type === 'income');

    if (period === 'day') {
      // Today, group by hour
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayIncome = incomeTxns.filter((t) => t.dateKey === todayKey);
      const total = todayIncome.reduce((s, t) => s + t.amount, 0);

      const hourMap = new Map<number, number>();
      todayIncome.forEach((t) => {
        const hour = parseInt(t.time.split(':')[0], 10);
        hourMap.set(hour, (hourMap.get(hour) || 0) + t.amount);
      });

      const points: ChartPoint[] = [];
      for (let h = 0; h <= 23; h++) {
        if (hourMap.has(h) || h % 6 === 0) {
          points.push({ label: `${h}h`, value: hourMap.get(h) || 0 });
        }
      }
      // Always have at least 2 points
      if (points.length < 2) {
        return { totalIncome: total, chartData: [{ label: '0h', value: 0 }, { label: '24h', value: total }] };
      }
      return { totalIncome: total, chartData: points };
    }

    if (period === 'week') {
      // Current week (Mon-Sun)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
      weekStart.setHours(0, 0, 0, 0);

      const weekIncome = incomeTxns.filter((t) => new Date(t.date) >= weekStart);
      const total = weekIncome.reduce((s, t) => s + t.amount, 0);

      const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const dayMap = new Map<number, number>();
      weekIncome.forEach((t) => {
        const d = new Date(t.date).getDay();
        const idx = d === 0 ? 6 : d - 1;
        dayMap.set(idx, (dayMap.get(idx) || 0) + t.amount);
      });

      const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const points: ChartPoint[] = [];
      let cumulative = 0;
      for (let i = 0; i <= todayIdx; i++) {
        cumulative += dayMap.get(i) || 0;
        points.push({ label: dayLabels[i], value: cumulative });
      }
      if (points.length < 2) {
        return { totalIncome: total, chartData: [{ label: 'T2', value: 0 }, { label: dayLabels[todayIdx], value: total }] };
      }
      return { totalIncome: total, chartData: points };
    }

    if (period === 'month') {
      // Current month, group by day
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthIncome = incomeTxns.filter((t) => new Date(t.date) >= monthStart);
      const total = monthIncome.reduce((s, t) => s + t.amount, 0);

      const dayMap = new Map<number, number>();
      monthIncome.forEach((t) => {
        const day = new Date(t.date).getDate();
        dayMap.set(day, (dayMap.get(day) || 0) + t.amount);
      });

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const points: ChartPoint[] = [];
      let cumulative = 0;
      for (let d = 1; d <= Math.min(now.getDate(), daysInMonth); d++) {
        cumulative += dayMap.get(d) || 0;
        if (d === 1 || d === now.getDate() || dayMap.has(d) || d % 5 === 0) {
          points.push({ label: `${d}`, value: cumulative });
        }
      }
      if (points.length < 2) {
        return { totalIncome: total, chartData: [{ label: '1', value: 0 }, { label: `${now.getDate()}`, value: total }] };
      }
      return { totalIncome: total, chartData: points };
    }

    // Year view — monthly totals
    const yearIncome = incomeTxns.filter((t) => new Date(t.date).getFullYear() === now.getFullYear());
    const total = yearIncome.reduce((s, t) => s + t.amount, 0);

    const monthLabels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const monthMap = new Map<number, number>();
    yearIncome.forEach((t) => {
      const m = new Date(t.date).getMonth();
      monthMap.set(m, (monthMap.get(m) || 0) + t.amount);
    });

    // Demo: fill past months with realistic data
    const points: ChartPoint[] = monthLabels.map((label, i) => ({
      label,
      value: monthMap.get(i) || (i < now.getMonth() ? 8_000_000 + (i * 1_500_000) % 7_000_000 : 0),
    }));

    return { totalIncome: total || points.reduce((s, p) => s + p.value, 0), chartData: points };
  }, [transactions, period]);

  // ═══ SVG Chart dimensions ═══
  const chartW = 320;
  const chartH = 100;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  const innerW = chartW - padding.left - padding.right;
  const innerH = chartH - padding.top - padding.bottom;

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);

  // Build SVG path (monotone-style smooth curve)
  const points = chartData.map((d, i) => ({
    x: padding.left + (i / Math.max(chartData.length - 1, 1)) * innerW,
    y: padding.top + innerH - (d.value / maxVal) * innerH,
  }));

  // Catmull-Rom to Bezier for smooth line
  function getControlPoints(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) {
    const tension = 0.3;
    return {
      cp1x: p1.x + (p2.x - p0.x) * tension,
      cp1y: p1.y + (p2.y - p0.y) * tension,
      cp2x: p2.x - (p2.x - p0.x) * tension,
      cp2y: p2.y - (p2.y - p0.y) * tension,
    };
  }

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = points[i];
    if (i === 1) {
      linePath += ` Q ${(p1.x + p2.x) / 2} ${p1.y} ${p2.x} ${p2.y}`;
    } else {
      const cp = getControlPoints(p0, p1, p2);
      linePath += ` C ${cp.cp1x} ${cp.cp1y} ${cp.cp2x} ${cp.cp2y} ${p2.x} ${p2.y}`;
    }
  }

  // Area fill — close path to bottom
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  return (
    <motion.div
      className="ib-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header: Title + Toggle */}
      <div className="ib-header">
        <div>
          <p className="ib-label">💰 Tổng Thu Nhập</p>
          <p className="ib-amount">{formatCurrency(totalIncome)}</p>
          <div className="ib-subtitle-row">
            <p className="ib-subtitle">
              {period === 'day' && 'Hôm nay'}
              {period === 'week' && 'Tuần này'}
              {period === 'month' && `Tháng ${new Date().getMonth() + 1}`}
              {period === 'year' && `Năm ${new Date().getFullYear()}`}
            </p>
            <button
              className="ib-bank-btn"
              onClick={() => setShowBankModal(true)}
              id="ib-bank-btn"
            >
              🏦 {incomeWallet?.bankName || 'Ngân hàng'}
            </button>
          </div>
        </div>

        {/* Period Toggle */}
        <div className="ib-toggle-group">
          {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              className={`ib-toggle ${period === p ? 'ib-toggle--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Line Chart */}
      <div className="ib-chart-wrap">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          preserveAspectRatio="xMidYMid meet"
          className="ib-chart-svg"
        >
          <defs>
            <linearGradient id="incAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="incLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <motion.path
            d={areaPath}
            fill="url(#incAreaGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />

          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#incLineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          {/* Data points */}
          {points.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="#10B981"
              stroke="var(--c-bg, #0D0B14)"
              strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8 + i * 0.05 }}
            />
          ))}

          {/* X-axis labels */}
          {chartData.map((d, i) => {
            // Show limited labels to avoid overlap
            const showLabel = chartData.length <= 7 || i === 0 || i === chartData.length - 1 || i % Math.ceil(chartData.length / 6) === 0;
            if (!showLabel) return null;
            return (
              <text
                key={i}
                x={points[i].x}
                y={chartH - 2}
                textAnchor="middle"
                className="ib-chart-label"
              >
                {d.label}
              </text>
            );
          })}

          {/* Tooltip values on data points */}
          {chartData.map((d, i) => {
            if (d.value === 0) return null;
            const showVal = chartData.length <= 5 || i === chartData.length - 1;
            if (!showVal) return null;
            return (
              <text
                key={`v-${i}`}
                x={points[i].x}
                y={points[i].y - 8}
                textAnchor="middle"
                className="ib-chart-value"
              >
                {formatCurrencyShort(d.value)}
              </text>
            );
          })}
        </svg>
      </div>
      {/* Wallet Bank Modal */}
      <WalletBankModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
      />
    </motion.div>
  );
}
