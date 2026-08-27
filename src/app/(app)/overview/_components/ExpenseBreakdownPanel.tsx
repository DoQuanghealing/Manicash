/* ═══ ExpenseBreakdownPanel — thân cửa sổ "Chi tiêu" ═══
 *
 * Bốn mốc so sánh (Ngày · Tuần · Tháng · Năm): mỗi mốc vừa cho con số của kỳ
 * hiện tại, vừa cho dải cột các kỳ liền trước để thấy đang tăng hay giảm.
 * Dưới là biểu đồ vành khuyên phân bổ theo danh mục — mỗi khoản một màu.
 *
 * Phần tính toán nằm hết ở `@/lib/expenseBreakdown` (thuần + có test);
 * ở đây chỉ vẽ.
 */
'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import type { Transaction } from '@/stores/useFinanceStore';
import {
  EXPENSE_PERIODS,
  PERIOD_CHART_TITLE,
  PERIOD_TOTAL_LABEL,
  buildCategoryBreakdown,
  buildDonutSegments,
  buildExpenseBuckets,
  filterExpensesForPeriod,
  type ExpensePeriod,
} from '@/lib/expenseBreakdown';
import './ExpenseBreakdownPanel.css';

/** Bán kính vòng tròn trong hệ toạ độ SVG 100×100. */
const R = 38;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface Props {
  transactions: Transaction[];
  /** Số giao dịch hiện trong danh sách. */
  limit?: number;
}

export default function ExpenseBreakdownPanel({ transactions, limit = 12 }: Props) {
  const [period, setPeriod] = useState<ExpensePeriod>('month');

  const buckets = useMemo(() => buildExpenseBuckets(transactions, period), [transactions, period]);
  const slices = useMemo(() => buildCategoryBreakdown(transactions, period), [transactions, period]);
  const periodTxns = useMemo(
    () => filterExpensesForPeriod(transactions, period).slice(0, limit),
    [transactions, period, limit],
  );

  const total = periodTxns.length > 0 || slices.length > 0
    ? filterExpensesForPeriod(transactions, period).reduce((s, t) => s + t.amount, 0)
    : 0;
  const maxBucket = Math.max(...buckets.map((b) => b.amount), 1);
  const segments = useMemo(() => buildDonutSegments(slices, CIRCUMFERENCE), [slices]);

  return (
    <div className="exb">
      {/* Chọn mốc so sánh */}
      <div className="exb-tabs" role="tablist" aria-label="Mốc thời gian">
        {EXPENSE_PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={`exb-tab${period === p.id ? ' exb-tab--on' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="exb-total">
        <span className="exb-total-label">{PERIOD_TOTAL_LABEL[period]}</span>
        <span className="exb-total-val">{formatCurrency(total)}</span>
      </div>

      {/* Dải cột so sánh các kỳ liền trước */}
      <div className="exb-chart">
        <p className="exb-chart-title">{PERIOD_CHART_TITLE[period]}</p>
        <div className="exb-bars">
          {buckets.map((b) => {
            const heightPct = (b.amount / maxBucket) * 100;
            return (
              <div key={b.key} className="exb-bar-col">
                <span className="exb-bar-amt">{b.amount > 0 ? formatCurrencyShort(b.amount) : ''}</span>
                <div className="exb-bar-track">
                  <div
                    className={`exb-bar-fill${b.isCurrent ? ' exb-bar-fill--now' : ''}`}
                    style={{ height: `${Math.max(heightPct, b.amount > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className={`exb-bar-label${b.isCurrent ? ' exb-bar-label--now' : ''}`}>{b.label}</span>
                {b.sub && <span className="exb-bar-sub">{b.sub}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phân bổ theo danh mục */}
      <div className="exb-split">
        <p className="exb-chart-title">Tiền đi vào đâu</p>
        {slices.length === 0 ? (
          <p className="exb-empty">Kỳ này chưa có khoản chi nào.</p>
        ) : (
          <div className="exb-split-body">
            <svg className="exb-donut" viewBox="0 0 100 100" role="img" aria-label="Phân bổ chi tiêu theo danh mục">
              <g transform="rotate(-90 50 50)">
                <circle className="exb-donut-track" cx="50" cy="50" r={R} />
                {segments.map((seg, i) => (
                  <circle
                    key={slices[i].categoryId}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="15"
                    strokeDasharray={seg.dash}
                    strokeDashoffset={seg.offset}
                  />
                ))}
              </g>
              <text className="exb-donut-center" x="50" y="47" textAnchor="middle">
                {slices.length}
              </text>
              <text className="exb-donut-sub" x="50" y="58" textAnchor="middle">
                khoản
              </text>
            </svg>

            <ul className="exb-legend">
              {slices.map((s) => (
                <li key={s.categoryId} className="exb-legend-row">
                  <span className="exb-legend-dot" style={{ background: s.color }} aria-hidden />
                  <span className="exb-legend-name">
                    <span aria-hidden>{s.icon}</span> {s.name}
                  </span>
                  <span className="exb-legend-pct">{s.percent}%</span>
                  <span className="exb-legend-amt">{formatCurrencyShort(s.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Giao dịch trong kỳ */}
      <div className="exb-list">
        {periodTxns.length === 0 ? (
          <p className="exb-empty">Kỳ này chưa có chi tiêu</p>
        ) : (
          periodTxns.map((txn) => (
            <div key={txn.id} className="exb-txn">
              <div className="exb-txn-left">
                <span className="exb-txn-note">{txn.note}</span>
                <span className="exb-txn-time">{txn.dateLabel} • {txn.time}</span>
              </div>
              <span className="exb-txn-amt">-{formatCurrencyShort(txn.amount)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
