/* Expense funding chart modal - mobile-first bottom sheet */
'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/data/categories';
import { useCategoryStore } from '@/stores/useCategoryStore';
import type {
  ExpenseFundingOverview,
  ExpenseFundingMonth,
  OverviewSubAccount,
} from '@/stores/useAccountOverviewStore';
import { formatCurrencyShort } from '@/utils/formatCurrency';

type ChartMode = 'all' | 'daily' | 'fixed';

const DAILY_COLORS = ['#F97316', '#FB923C', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981'];
const FIXED_COLORS = ['#8B5CF6', '#A78BFA', '#6366F1', '#22C55E', '#14B8A6', '#F97316'];

interface Props {
  funding: ExpenseFundingOverview;
  onClose: () => void;
}

export default function ExpenseFundingChartModal({ funding, onClose }: Props) {
  const [mode, setMode] = useState<ChartMode>('all');
  const expenseCategories = useCategoryStore((state) => state.expenseCategories);
  const categoryMap = useMemo(() => {
    return new Map([...EXPENSE_CATEGORIES, ...expenseCategories].map((category) => [category.id, category]));
  }, [expenseCategories]);

  const labelFor = (item: OverviewSubAccount) => categoryMap.get(item.id)?.name || item.label;
  const colorFor = (item: OverviewSubAccount, index: number, palette: string[]) =>
    item.color || categoryMap.get(item.id)?.color || palette[index % palette.length];

  return (
    <>
      <motion.div
        className="efc-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="efc-modal"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="efc-handle"><div className="efc-handle-bar" /></div>

        <div className="efc-header">
          <div>
            <p className="efc-kicker">Ngân sách chi tiêu tháng</p>
            <h3 className="efc-title">{formatCurrencyShort(funding.target)} cần nạp</h3>
          </div>
          <button className="efc-close" onClick={onClose} aria-label="Đóng biểu đồ">
            <X size={18} />
          </button>
        </div>

        <div className="efc-summary">
          <div>
            <span>Chi tiêu hằng ngày</span>
            <strong>{formatCurrencyShort(funding.dailyLimit)}</strong>
          </div>
          <div>
            <span>Hóa đơn cố định</span>
            <strong>{formatCurrencyShort(funding.fixedBillsTotal)}</strong>
          </div>
        </div>

        <div className="efc-tabs" role="tablist" aria-label="Chế độ biểu đồ">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'daily', label: 'Hằng ngày' },
            { key: 'fixed', label: 'Cố định' },
          ].map((item) => (
            <button
              key={item.key}
              className={`efc-tab ${mode === item.key ? 'efc-tab--active' : ''}`}
              onClick={() => setMode(item.key as ChartMode)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="efc-chart-card">
          <MonthlyStackedBarChart
            months={funding.months}
            mode={mode}
            dailyLimit={funding.dailyLimit}
            fixedLimit={funding.fixedBillsTotal}
            labelFor={labelFor}
            colorFor={colorFor}
          />
        </div>

        <InsightPanel funding={funding} labelFor={labelFor} mode={mode} />
      </motion.div>
    </>
  );
}

function MonthlyStackedBarChart({
  months,
  mode,
  dailyLimit,
  fixedLimit,
  labelFor,
  colorFor,
}: {
  months: ExpenseFundingMonth[];
  mode: ChartMode;
  dailyLimit: number;
  fixedLimit: number;
  labelFor: (item: OverviewSubAccount) => string;
  colorFor: (item: OverviewSubAccount, index: number, palette: string[]) => string;
}) {
  const max = Math.max(
    mode === 'daily' || mode === 'all' ? dailyLimit : 0,
    mode === 'fixed' || mode === 'all' ? fixedLimit : 0,
    ...months.map((month) => {
      if (mode === 'daily') return month.dailyTotal;
      if (mode === 'fixed') return month.fixedTotal;
      return Math.max(month.dailyTotal, month.fixedTotal);
    }),
    1,
  );

  return (
    <div className="efc-monthly">
      {months.map((month) => (
        <div key={month.month} className="efc-month">
          <div className="efc-month-bars-wrapper">
            {(mode === 'daily' || mode === 'all') && (
              <StackedColumn
                month={month}
                type="daily"
                max={max}
                palette={DAILY_COLORS}
                labelFor={labelFor}
                colorFor={colorFor}
              />
            )}
            {(mode === 'fixed' || mode === 'all') && (
              <StackedColumn
                month={month}
                type="fixed"
                max={max}
                palette={FIXED_COLORS}
                labelFor={labelFor}
                colorFor={colorFor}
              />
            )}
          </div>
          <span className="efc-month-label">{month.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function StackedColumn({
  month,
  type,
  max,
  palette,
  labelFor,
  colorFor,
}: {
  month: ExpenseFundingMonth;
  type: 'daily' | 'fixed';
  max: number;
  palette: string[];
  labelFor: (item: OverviewSubAccount) => string;
  colorFor: (item: OverviewSubAccount, index: number, palette: string[]) => string;
}) {
  const items = type === 'daily' ? month.dailyItems : month.fixedItems;
  const total = type === 'daily' ? month.dailyTotal : month.fixedTotal;
  const usedHeight = Math.min(100, (total / max) * 100);
  const segments = items.reduce<Array<{ item: OverviewSubAccount; index: number; bottom: number; height: number }>>(
    (acc, item, index) => {
      const height = Math.max(2, (item.amount / Math.max(total, 1)) * 100);
      const bottom = acc.reduce((sum, segment) => sum + segment.height, 0);
      return [...acc, { item, index, bottom, height }];
    },
    [],
  );

  return (
    <div className={`efc-month-bar ${type === 'fixed' && !month.hasFixedSnapshot ? 'efc-month-bar--missing' : ''}`}>
      {type === 'fixed' && !month.hasFixedSnapshot ? (
        <div
          className="efc-month-missing-snapshot"
          title={`Chưa có dữ liệu lịch sử (bắt đầu từ T${month.month.slice(5).replace('-', '/')})`}
        />
      ) : (
        <div className="efc-month-fill" style={{ height: `${usedHeight}%` }}>
          {segments.map(({ item, index, bottom, height }) => (
            <span
              key={item.id}
              className="efc-stack-seg"
              style={{
                bottom: `${bottom}%`,
                height: `${height}%`,
                background: colorFor(item, index, palette),
              }}
              title={`${labelFor(item)} ${formatCurrencyShort(item.amount)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightPanel({
  funding,
  labelFor,
  mode,
}: {
  funding: ExpenseFundingOverview;
  labelFor: (item: OverviewSubAccount) => string;
  mode: ChartMode;
}) {
  const { comparison } = funding;
  const showDaily = mode !== 'fixed';
  const showFixed = mode !== 'daily';

  return (
    <div className="efc-insights">
      {showDaily && comparison.topDaily && (
        <p>
          Chi tiêu nhiều nhất hiện là <strong>{labelFor(comparison.topDaily)}</strong> với{' '}
          <strong>{formatCurrencyShort(comparison.topDaily.amount)}</strong>.
        </p>
      )}
      {showFixed && comparison.topFixed && (
        <p>
          Khoản cố định lớn nhất là <strong>{comparison.topFixed.label}</strong>:{' '}
          <strong>{formatCurrencyShort(comparison.topFixed.amount)}</strong>.
        </p>
      )}
      {showDaily && comparison.increased.length > 0 && (
        <p>
          Tăng so với tháng trước: {comparison.increased.map((item) =>
            `${labelFor(item)} +${formatCurrencyShort(item.amount)}`
          ).join(', ')}.
        </p>
      )}
      {showDaily && comparison.decreased.length > 0 && (
        <p className="efc-good">
          Giảm tốt: {comparison.decreased.map((item) =>
            `${labelFor(item)} -${formatCurrencyShort(item.amount)}`
          ).join(', ')}.
        </p>
      )}
    </div>
  );
}
