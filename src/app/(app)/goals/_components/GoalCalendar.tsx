/* ═══ GoalCalendar — Heatmap nạp tiền 90 ngày gần đây ═══
 *
 * Mỗi ô = 1 ngày. Tô đậm theo tổng amount nạp ngày đó.
 * Hover hiển thị tooltip với số tiền + ngày.
 *
 * Grid: 13 tuần × 7 ngày (90 days), giống GitHub contribution graph.
 */
'use client';

import { useMemo } from 'react';
import type { GoalDeposit } from '@/types/budget';
import { formatCurrencyShort } from '@/utils/formatCurrency';
import './GoalCalendar.css';

interface Props {
  deposits: GoalDeposit[];
  color: string;
}

interface DayCell {
  dateKey: string;
  amount: number;
  isToday: boolean;
}

function getDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GoalCalendar({ deposits, color }: Props) {
  const { weeks, max } = useMemo(() => {
    const today = new Date();
    const todayKey = getDateKey(today);

    // Build 91 days (13 weeks × 7), today ở góc dưới phải
    const days: DayCell[] = [];
    for (let i = 90; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = getDateKey(d);
      days.push({ dateKey: key, amount: 0, isToday: key === todayKey });
    }

    // Sum deposits theo ngày
    const dayMap: Record<string, number> = {};
    for (const dep of deposits) {
      const d = new Date(dep.createdAt);
      const key = getDateKey(d);
      dayMap[key] = (dayMap[key] || 0) + dep.amount;
    }

    // Apply amounts
    const maxAmount = Math.max(1, ...Object.values(dayMap));
    for (const day of days) {
      day.amount = dayMap[day.dateKey] || 0;
    }

    // Group thành tuần (7 ngày/tuần, cột)
    const weeksArr: DayCell[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7));
    }

    return { weeks: weeksArr, max: maxAmount };
  }, [deposits]);

  // Compute intensity 0..4 cho color levels
  const getLevel = (amount: number): number => {
    if (amount === 0) return 0;
    const ratio = amount / max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  return (
    <div className="goal-cal" style={{ '--gcal-color': color } as React.CSSProperties}>
      <div className="goal-cal-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="goal-cal-week">
            {week.map((day) => {
              const level = getLevel(day.amount);
              const tooltip = day.amount > 0
                ? `${day.dateKey} · +${formatCurrencyShort(day.amount)}`
                : `${day.dateKey} · không nạp`;
              return (
                <div
                  key={day.dateKey}
                  className={`goal-cal-cell goal-cal-cell--lv${level} ${day.isToday ? 'goal-cal-cell--today' : ''}`}
                  title={tooltip}
                  aria-label={tooltip}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="goal-cal-legend">
        <span>Ít</span>
        <div className="goal-cal-legend-cells">
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={`goal-cal-cell goal-cal-cell--lv${l}`} />
          ))}
        </div>
        <span>Nhiều</span>
      </div>
    </div>
  );
}
