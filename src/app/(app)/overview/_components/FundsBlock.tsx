/* ═══ FundsBlock — Block 3: 3-column Dự phòng + Mục tiêu + Đầu tư ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Target, TrendingUp, X } from 'lucide-react';
import { useDashboardStore, type DashboardAccounts, type SavingsPeriod } from '@/stores/useDashboardStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './FundsBlock.css';

type FundType = 'reserve' | 'goals' | 'investment';

/** Build last-7-months chart data from real monthly contributions.
 *  Each point = total contribution for that month (per-month, not cumulative).
 *  Returns array of { date: 'Tx', val: number } for 7 most-recent months,
 *  oldest first. */
function buildMonthlyChartData(
  contributions: { month: string; amount: number }[],
): { date: string; val: number }[] {
  const today = new Date();
  const months: { date: string; val: number; key: string }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getUTCFullYear(), today.getUTCMonth() - i, 1);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    months.push({
      date: `T${d.getUTCMonth() + 1}`,
      val: 0,
      key,
    });
  }

  // Aggregate per-month totals
  for (const c of contributions) {
    const slot = months.find((m) => m.key === c.month);
    if (slot) slot.val += c.amount;
  }

  return months.map(({ date, val }) => ({ date, val }));
}

function formatContribDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export default function FundsBlock() {
  const [activeModal, setActiveModal] = useState<FundType | null>(null);
  const [period, setPeriod] = useState<SavingsPeriod>('month');
  const accounts = useDashboardStore((s) => s.accounts);
  const getFundTotalByPeriod = useDashboardStore((s) => s.getFundTotalByPeriod);
  const getTotalSavingsByPeriod = useDashboardStore((s) => s.getTotalSavingsByPeriod);
  
  const { reserve } = accounts;

  const reservePeriodTotal = getFundTotalByPeriod('reserve', period);
  const goalsPeriodTotal = getFundTotalByPeriod('goals', period);
  const investPeriodTotal = getFundTotalByPeriod('investment', period);

  const savingsTotal = getTotalSavingsByPeriod(period);
  const periodText = period === 'week' ? 'tuần này' : period === 'year' ? 'năm nay' : 'tháng này';
  const savingsSuggestion =
    savingsTotal <= 0
      ? `Chưa có khoản tiết kiệm nào trong ${periodText}.`
      : savingsTotal < 1_000_000
        ? `Tiết kiệm ${periodText} còn mỏng, nên chia thêm khi có thu nhập.`
        : `Đang có nhịp tiết kiệm tốt trong ${periodText}, tiếp tục duy trì.`;

  return (
    <>
      {/* ═══ Savings Header — aggregate total ═══ */}
      <div className="fb-savings-wrap">
        <div className="fb-savings-header">
          <div className="fb-savings-left">
            <div className="fb-savings-title-row">
              <span className="fb-savings-icon">💎</span>
              <span className="fb-savings-label">TIẾT KIỆM</span>
              <span className="fb-savings-period">{periodText}</span>
            </div>
            <span className="fb-savings-total">{formatCurrencyShort(savingsTotal)}</span>
          </div>
          <div className="fb-savings-right">
            <div className="fb-period-tabs">
              {(['week', 'month', 'year'] as SavingsPeriod[]).map((item) => (
                <button
                  key={item}
                  className={`fb-period-tab ${period === item ? 'fb-period-tab--active' : ''}`}
                  onClick={() => setPeriod(item)}
                  type="button"
                >
                  {item === 'week' ? 'Tuần' : item === 'month' ? 'Tháng' : 'Năm'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="fb-savings-advice">{savingsSuggestion}</p>

        <div className="fb-grid">
        {/* ═══ Card: Dự phòng ═══ */}
        <motion.button 
          className="fb-card fb-card--reserve"
          onClick={() => setActiveModal('reserve')}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="fb-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1' }}>
            <Lock size={16} />
            {reserve.is_locked && <span className="fb-locked-badge">🔒</span>}
          </div>
          <p className="fb-card-label">Dự phòng</p>
          <p className="fb-card-amount">{formatCurrencyShort(reservePeriodTotal)}</p>
          <p className="fb-card-sub">{periodText}</p>
        </motion.button>

        {/* ═══ Card: Mục tiêu ═══ */}
        <motion.button 
          className="fb-card fb-card--goals"
          onClick={() => setActiveModal('goals')}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="fb-card-icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#EC4899' }}>
            <Target size={16} />
          </div>
          <p className="fb-card-label">Mục tiêu</p>
          <p className="fb-card-amount">{formatCurrencyShort(goalsPeriodTotal)}</p>
          <p className="fb-card-sub">{periodText}</p>
        </motion.button>

        {/* ═══ Card: Đầu tư ═══ */}
        <motion.button 
          className="fb-card fb-card--invest"
          onClick={() => setActiveModal('investment')}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="fb-card-icon" style={{ background: 'rgba(20, 184, 166, 0.12)', color: '#14B8A6' }}>
            <TrendingUp size={16} />
          </div>
          <p className="fb-card-label">Đầu tư</p>
          <p className="fb-card-amount">{formatCurrencyShort(investPeriodTotal)}</p>
          <p className="fb-card-sub">{periodText}</p>
        </motion.button>
      </div>
      </div> {/* close fb-savings-wrap */}

      {/* ═══ Fund Detail Modal ═══ */}
      <AnimatePresence>
        {activeModal && (
          <FundDetailModal 
            type={activeModal} 
            accounts={accounts} 
            onClose={() => setActiveModal(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══ Fund Detail Modal — Tháng / Năm toggle ═══ */
function FundDetailModal({ type, accounts, onClose }: { type: FundType, accounts: DashboardAccounts, onClose: () => void }) {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const getMonthlyFundTotal = useDashboardStore((s) => s.getMonthlyFundTotal);
  const getYearlyFundTotal = useDashboardStore((s) => s.getYearlyFundTotal);
  const getYearlyBreakdown = useDashboardStore((s) => s.getYearlyFundBreakdown);
  // Quỹ Mục tiêu = pool chia tự động (dashboard, từ chia quỹ) + tiền nạp riêng
  // từng mục tiêu (useGoalsStore). Cả hai đều là "nạp quỹ" → tổng cộng cả hai.
  const goalsSaved = useGoalsStore((s) => s.getTotalSaved());
  const goalsTargetSum = useGoalsStore((s) => s.goals.reduce((sum, g) => sum + g.targetAmount, 0));

  let headerTitle = '';
  let icon = null;
  let accentColor = '';
  let gradientId = '';
  
  if (type === 'reserve') {
    headerTitle = 'Quỹ Dự phòng';
    icon = <Lock size={20} color="#6366F1" />;
    accentColor = '#6366F1';
    gradientId = 'reserveGrad';
  } else if (type === 'goals') {
    headerTitle = 'Tiết kiệm Mục tiêu';
    icon = <Target size={20} color="#EC4899" />;
    accentColor = '#EC4899';
    gradientId = 'goalsGrad';
  } else {
    headerTitle = 'Quỹ Đầu tư';
    icon = <TrendingUp size={20} color="#14B8A6" />;
    accentColor = '#14B8A6';
    gradientId = 'investGrad';
  }

  const monthlyTotal = getMonthlyFundTotal(type);
  const yearlyTotal = getYearlyFundTotal(type);
  const yearlyBreakdown = getYearlyBreakdown(type);
  const allContributions = useDashboardStore((s) => s.monthlyContributions[type] ?? []);
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthKey = `${new Date().getFullYear()}-${String(currentMonth).padStart(2, '0')}`;

  // Lịch sử tích lũy trong tháng hiện tại — newest first
  const monthContributions = allContributions
    .filter((c) => c.month === currentMonthKey)
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  // Chart 7 tháng gần nhất — real per-month totals
  const monthHistory = buildMonthlyChartData(allContributions);
  const maxMonthVal = Math.max(...monthHistory.map((p) => p.val), 1);

  const sourceLabel = type === 'reserve'
    ? 'Nạp vào Dự phòng'
    : type === 'goals'
      ? 'Nạp vào Mục tiêu'
      : 'Nạp vào Đầu tư';

  // Yearly bar chart data
  const maxMonthly = Math.max(...yearlyBreakdown.map(m => m.amount), 1);

  // Chart dims
  const chartW = 320;
  const chartH = 120;
  const pd = 10;
  const w = chartW - pd * 2;
  const h = chartH - pd * 2;

  // Monthly chart
  const points = monthHistory.map((d, i) => ({
    x: pd + (i / (monthHistory.length - 1)) * w,
    y: pd + h - (d.val / (maxMonthVal * 1.1)) * h,
  }));

  let pathStr = `M ${points[0].x} ${points[0].y}`;
  for(let i=1; i<points.length; i++) {
    pathStr += ` L ${points[i].x} ${points[i].y}`;
  }
  const areaStr = `${pathStr} L ${points[points.length-1].x} ${pd + h} L ${points[0].x} ${pd + h} Z`;

  return (
    <>
      <motion.div
        className="fb-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fb-modal"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="fb-modal-handle"><div className="fb-modal-handle-bar" /></div>

        <div className="fb-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="fb-modal-icon" style={{ background: `${accentColor}1A` }}>
              {icon}
            </div>
            <h3 className="fb-modal-title">{headerTitle}</h3>
          </div>
          <button className="fb-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* ═══ Toggle Tháng / Năm ═══ */}
        <div className="fb-toggle-wrap">
          <button
            className={`fb-toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
            style={viewMode === 'month' ? { background: accentColor, color: 'white' } : {}}
          >
            Tháng
          </button>
          <button
            className={`fb-toggle-btn ${viewMode === 'year' ? 'active' : ''}`}
            onClick={() => setViewMode('year')}
            style={viewMode === 'year' ? { background: accentColor, color: 'white' } : {}}
          >
            Năm
          </button>
        </div>

        {/* ═══ Big Balance ═══ */}
        <div className="fb-modal-balance-wrap">
          <p className="fb-modal-balance" style={{ color: accentColor }}>
            {formatCurrency(viewMode === 'month' ? monthlyTotal : yearlyTotal)}
          </p>
          <p className="fb-modal-progress">
            {viewMode === 'month' 
              ? `Tích lũy tháng ${currentMonth}` 
              : `Tổng tích lũy năm ${new Date().getFullYear()}`}
          </p>
          {type === 'goals' && (
            <p className="fb-modal-progress" style={{ marginTop: 4 }}>
              Tổng quỹ: {formatCurrencyShort(accounts.goals.balance + goalsSaved)} / {formatCurrencyShort(accounts.goals.target + goalsTargetSum)}
            </p>
          )}
          {type === 'investment' && (
            <p className="fb-modal-progress" style={{ color: '#10B981', marginTop: 4 }}>
              Tăng trưởng: {accounts.investment.growth}
            </p>
          )}
        </div>

        {/* ═══ Chart ═══ */}
        <div className="fb-modal-chart">
          <p className="fb-modal-chart-title">
            {viewMode === 'month' ? 'Biểu đồ tích lũy tháng' : 'Tích lũy theo tháng'}
          </p>

          {viewMode === 'month' ? (
            /* Monthly: Line/Area chart */
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="fb-svg">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaStr} fill={`url(#${gradientId})`} />
              <path d={pathStr} fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {monthHistory.map((d, i) => (
                <text key={i} x={points[i].x} y={chartH - 2} textAnchor="middle" className="fb-chart-label" style={{ fontSize: '8px', fill: 'var(--c-text-muted)' }}>
                  {d.date}
                </text>
              ))}
            </svg>
          ) : (
            /* Yearly: Bar chart */
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="fb-svg">
              {yearlyBreakdown.map((m, i) => {
                const barW = (w / 12) * 0.6;
                const barH = maxMonthly > 0 ? (m.amount / maxMonthly) * (h - 14) : 0;
                const barX = pd + (i / 12) * w + (w / 12) * 0.2;
                const barY = pd + h - 14 - barH;
                const monthNum = parseInt(m.month.split('-')[1]);

                return (
                  <g key={m.month}>
                    <rect
                      x={barX}
                      y={barY}
                      width={barW}
                      height={Math.max(barH, 1)}
                      rx="3"
                      fill={monthNum === currentMonth ? accentColor : `${accentColor}40`}
                    />
                    <text
                      x={barX + barW / 2}
                      y={chartH - 2}
                      textAnchor="middle"
                      style={{ fontSize: '7px', fill: monthNum === currentMonth ? accentColor : 'var(--c-text-muted)' }}
                    >
                      T{monthNum}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* ═══ History ═══ */}
        <div className="fb-history">
          <p className="fb-history-title">
            {viewMode === 'month' ? 'Lịch sử tích lũy' : `Tóm tắt ${new Date().getFullYear()}`}
          </p>
          <div className="fb-history-list">
            {viewMode === 'month' ? (
              // Monthly: real contributions in current month, newest first
              monthContributions.length === 0 ? (
                <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textAlign: 'center', padding: '12px' }}>
                  Chưa có lần nạp nào trong tháng này
                </p>
              ) : (
                monthContributions.map((c, i) => (
                  <div key={`${c.createdAt ?? c.month}-${i}`} className="fb-history-item">
                    <div className="fb-history-left">
                      <span className="fb-history-date">{formatContribDate(c.createdAt)}</span>
                      <span className="fb-history-source">{sourceLabel}</span>
                    </div>
                    <span className="fb-history-amt" style={{ color: accentColor }}>
                      +{formatCurrencyShort(c.amount)}
                    </span>
                  </div>
                ))
              )
            ) : (
              // Yearly: show monthly summaries
              yearlyBreakdown
                .filter(m => m.amount > 0)
                .map(m => {
                  const monthNum = parseInt(m.month.split('-')[1]);
                  return (
                    <div key={m.month} className="fb-history-item">
                      <div className="fb-history-left">
                        <span className="fb-history-date">Tháng {monthNum}</span>
                        <span className="fb-history-source">Tổng tích lũy</span>
                      </div>
                      <span className="fb-history-amt" style={{ color: accentColor }}>
                        +{formatCurrencyShort(m.amount)}
                      </span>
                    </div>
                  );
                })
            )}
            {viewMode === 'year' && yearlyBreakdown.every(m => m.amount === 0) && (
              <p style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', textAlign: 'center', padding: '12px' }}>
                Chưa có dữ liệu tích lũy trong năm nay
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
