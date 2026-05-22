/* ═══ UpcomingHolidayHint — Banner nhỏ báo holiday sắp tới ═══
 *
 * Show 30 ngày trước holiday gần nhất (Tết, Vu Lan, Trung Thu...).
 * Ẩn nếu có active seasonal event (event banner đã đủ thông tin).
 */
'use client';

import { useMemo } from 'react';
import { Sparkles, CalendarDays } from 'lucide-react';
import { getUpcomingLunarHoliday, daysUntilHoliday, HOLIDAY_TO_EVENT } from '@/data/lunarCalendar';
import { useQuestStore } from '@/stores/useQuestStore';
import './UpcomingHolidayHint.css';

export default function UpcomingHolidayHint() {
  const activeEvent = useQuestStore((s) => s.getCurrentSeasonal());

  const holiday = useMemo(() => getUpcomingLunarHoliday(), []);
  if (!holiday) return null;

  // Nếu có seasonal event active liên quan đến holiday này → ẩn (event banner đã show)
  if (activeEvent && HOLIDAY_TO_EVENT[holiday.id] === activeEvent.id) return null;

  const days = daysUntilHoliday(holiday);
  if (days < 0 || days > 30) return null;

  const dayLabel =
    days === 0 ? 'Hôm nay'
    : days === 1 ? 'Ngày mai'
    : `Còn ${days} ngày`;

  return (
    <div className="uhh-card">
      <span className="uhh-icon">{holiday.icon}</span>
      <div className="uhh-body">
        <div className="uhh-meta">
          <CalendarDays size={10} />
          <span>{dayLabel}</span>
        </div>
        <p className="uhh-name">{holiday.name}</p>
        <p className="uhh-lunar">{holiday.lunarLabel}</p>
      </div>
      <Sparkles size={14} className="uhh-spark" />
    </div>
  );
}
