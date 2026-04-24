/* ═══ CalendarModal — View income/expense by day ═══ */
'use client';

import { useState, useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatCurrency } from '@/utils/formatCurrency';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (dateKey: string) => void;
}

export default function CalendarModal({ isOpen, onClose, onSelectDate }: CalendarModalProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const transactions = useFinanceStore((s) => s.transactions);

  // Compute daily summary from transactions (stable — no new object per render)
  const dailySummary = useMemo(() => {
    const summary: Record<string, { income: number; expense: number }> = {};
    for (const t of transactions) {
      if (!summary[t.dateKey]) summary[t.dateKey] = { income: 0, expense: 0 };
      if (t.type === 'income') summary[t.dateKey].income += t.amount;
      if (t.type === 'expense') summary[t.dateKey].expense += t.amount;
    }
    return summary;
  }, [transactions]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    const days: { day: number; dateKey: string; income: number; expense: number; isToday: boolean; isCurrentMonth: boolean }[] = [];

    // Padding days from prev month
    for (let i = 0; i < startOffset; i++) {
      days.push({ day: 0, dateKey: '', income: 0, expense: 0, isToday: false, isCurrentMonth: false });
    }

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let d = 1; d <= totalDays; d++) {
      const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const summary = dailySummary[dk] || { income: 0, expense: 0 };
      days.push({
        day: d,
        dateKey: dk,
        income: summary.income,
        expense: summary.expense,
        isToday: dk === todayKey,
        isCurrentMonth: true,
      });
    }

    return days;
  }, [year, month, dailySummary]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  if (!isOpen) return null;

  return (
    <div className="cal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cal-header">
          <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
          <h3 className="cal-month-title">{monthName}</h3>
          <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
        </div>

        {/* Weekday headers */}
        <div className="cal-weekdays">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
            <span key={d} className="cal-weekday">{d}</span>
          ))}
        </div>

        {/* Day grid */}
        <div className="cal-grid">
          {calendarDays.map((cell, i) => (
            <button
              key={i}
              className={`cal-day ${cell.isToday ? 'today' : ''} ${!cell.isCurrentMonth ? 'empty' : ''} ${(cell.income > 0 || cell.expense > 0) ? 'has-data' : ''}`}
              onClick={() => cell.dateKey && onSelectDate(cell.dateKey)}
              disabled={!cell.isCurrentMonth}
            >
              {cell.isCurrentMonth && (
                <>
                  <span className="cal-day-num">{cell.day}</span>
                  {cell.income > 0 && (
                    <span className="cal-dot income" />
                  )}
                  {cell.expense > 0 && (
                    <span className="cal-dot expense" />
                  )}
                  {cell.income > 0 && (
                    <span className="cal-day-amount income">+{(cell.income / 1000000).toFixed(1)}tr</span>
                  )}
                  {cell.expense > 0 && (
                    <span className="cal-day-amount expense">-{(cell.expense / 1000000).toFixed(1)}tr</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="cal-legend">
          <span className="cal-legend-item"><span className="cal-dot income" /> Thu</span>
          <span className="cal-legend-item"><span className="cal-dot expense" /> Chi</span>
        </div>

        <button className="cal-close-btn" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
