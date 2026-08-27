/* ═══ Nội dung tấm trượt Thu nhập ═══
 *
 * Nửa trên là phần MỚI (chọn kỳ + biểu đồ hai đường tiền mặt/tài khoản).
 * Nửa dưới tái dùng nguyên `IncomeDetailPanel` — nó đã có sẵn đúng 3 mục PO cần:
 * tài khoản nhận thu nhập, tiền đang nằm ở đâu, lịch sử thu nhập. Viết lại là
 * tự tạo bản sao thứ hai của cùng một sự thật.
 */
'use client';

import { useMemo, useState } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { EXPENSE_PERIODS, type ExpensePeriod } from '@/lib/expenseBreakdown';
import { BANK_COLOR, CASH_COLOR, buildIncomeSeries, getMethodSplit } from '@/lib/moneyBlocks';
import { formatCurrency } from '@/utils/formatCurrency';
import IncomeDetailPanel from '../IncomeDetailPanel';
import { TwoLineChart } from './SheetCharts';
import './SheetContent.css';

const PERIOD_TITLE: Record<ExpensePeriod, string> = {
  day: 'Thu hôm nay',
  week: 'Thu tuần này',
  month: 'Thu tháng này',
  year: 'Thu năm nay',
};

export default function IncomeSheetContent() {
  const [period, setPeriod] = useState<ExpensePeriod>('month');
  const transactions = useFinanceStore((s) => s.transactions);
  const now = useMemo(() => new Date(), []);

  const series = useMemo(
    () => buildIncomeSeries(transactions, period, now),
    [transactions, period, now],
  );
  const split = useMemo(
    () => getMethodSplit(transactions, 'income', period, now),
    [transactions, period, now],
  );

  return (
    <>
      <section className="sh-card">
        <div className="sh-periods" role="tablist" aria-label="Chọn mốc thời gian">
          {EXPENSE_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={`sh-period${period === p.id ? ' is-active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="sh-label">{PERIOD_TITLE[period]}</p>
        <p className="sh-total">{formatCurrency(split.total)}</p>

        <div className="sh-split">
          <div className="sh-split-item">
            <span className="sh-dot" style={{ background: CASH_COLOR }} aria-hidden />
            <span className="sh-split-name">Tiền mặt</span>
            <span className="sh-split-val">{formatCurrency(split.cash)}</span>
            <span className="sh-split-pct">{split.cashPercent}%</span>
          </div>
          <div className="sh-split-item">
            <span className="sh-dot" style={{ background: BANK_COLOR }} aria-hidden />
            <span className="sh-split-name">Trong tài khoản</span>
            <span className="sh-split-val">{formatCurrency(split.bank)}</span>
            <span className="sh-split-pct">{split.bankPercent}%</span>
          </div>
        </div>

        <TwoLineChart points={series} />
      </section>

      {/* Số tài khoản · hai túi tiền · lịch sử — đã dựng sẵn, dùng lại nguyên khối. */}
      <IncomeDetailPanel />
    </>
  );
}
