/* ═══ PRISM — Thẻ khảo sát năng lực (P6a) ═══
 * Chọn kỹ năng (multi) + thời gian rảnh -> lưu để La Bàn Năng Lực chính xác hơn.
 * Tự quản state chọn; gọi onSave khi bấm Lưu. Offline.
 */
'use client';

import { useState } from 'react';
import {
  SKILL_OPTIONS,
  FREE_TIME_OPTIONS,
  type CapacitySurveyAnswers,
} from '@/lib/aiMoneyChat/prism/capacity/capacitySurvey';
import './capacity-survey.css';

interface Props {
  initial: CapacitySurveyAnswers;
  onSave: (input: { skills: string[]; freeTimeHoursPerWeek: number }) => void;
}

export default function CapacitySurveyCard({ initial, onSave }: Props) {
  const [skills, setSkills] = useState<string[]>(initial.skills ?? []);
  const [freeTime, setFreeTime] = useState<number>(initial.freeTimeHoursPerWeek ?? -1);
  const [saved, setSaved] = useState(false);

  const toggleSkill = (id: string) => {
    setSkills((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  };

  const canSave = skills.length > 0 || freeTime >= 0;

  const handleSave = () => {
    if (!canSave || saved) return;
    setSaved(true);
    onSave({ skills, freeTimeHoursPerWeek: freeTime });
  };

  return (
    <div className="surv-card">
      <div className="surv-block">
        <span className="surv-label">Thế mạnh của ngài? (chọn nhiều)</span>
        <div className="surv-chips">
          {SKILL_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`surv-chip${skills.includes(s.id) ? ' surv-chip--on' : ''}`}
              onClick={() => toggleSkill(s.id)}
              disabled={saved}
              aria-pressed={skills.includes(s.id)}
            >
              <span aria-hidden>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="surv-block">
        <span className="surv-label">Quỹ thời gian rảnh mỗi tuần?</span>
        <div className="surv-chips">
          {FREE_TIME_OPTIONS.map((o) => (
            <button
              key={o.hours}
              type="button"
              className={`surv-chip${freeTime === o.hours ? ' surv-chip--on' : ''}`}
              onClick={() => setFreeTime(o.hours)}
              disabled={saved}
              aria-pressed={freeTime === o.hours}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="surv-save" onClick={handleSave} disabled={!canSave || saved}>
        {saved ? '✓ Đã lưu — đang đo lại…' : '💾 Lưu & đo lại năng lực'}
      </button>
    </div>
  );
}
