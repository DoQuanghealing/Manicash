/* ═══ EarningIdeasSheet — Thư viện ý tưởng kiếm tiền (mẫu D "Thẻ màu một tiêu điểm") ═══
 * Spec: docs/SPEC_DOT_1_THU_VIEN_MAU.md §3.1. Cả đầu sheet đổi màu theo chủ đề đang chọn,
 * mẫu đầu tiên là thẻ tiêu điểm lớn. Bấm mẫu → `onPick` (MoneyContent mở form điền sẵn).
 * Chủ đề xếp theo La bàn năng lực; chưa làm khảo sát thì mời làm ngay trong sheet (không chặn).
 */
'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/hooks/useIsClient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Compass } from 'lucide-react';
import {
  rankThemesBySkills, templatesForTheme, formatPriceRange,
  type EarningTemplate, type EarningThemeId,
} from '@/data/earningTemplates';
import { useCapacitySurveyStore } from '@/stores/useCapacitySurveyStore';
import CapacitySurveyCard from '@/app/(app)/chat/_components/CapacitySurveyCard';
import './earningTheme.css';
import './EarningIdeasSheet.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPick: (tpl: EarningTemplate) => void;
  /** Mở thẳng chủ đề này (vd. bấm chủ đề ở trạng thái rỗng). Mặc định: chủ đề hợp nhất. */
  initialThemeId?: EarningThemeId;
}

export default function EarningIdeasSheet({ isOpen, onClose, onPick, initialThemeId }: Props) {
  const mounted = useIsClient();
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>{isOpen && <SheetBody onClose={onClose} onPick={onPick} initialThemeId={initialThemeId} />}</AnimatePresence>,
    document.body,
  );
}

function SheetBody({ onClose, onPick, initialThemeId }: Omit<Props, 'isOpen'>) {
  const answers = useCapacitySurveyStore((s) => s.answers);
  const saveSurvey = useCapacitySurveyStore((s) => s.save);
  const skills = answers.skills;
  const { themes, matched } = useMemo(() => rankThemesBySkills(skills), [skills]);
  const [themeId, setThemeId] = useState<EarningThemeId>(initialThemeId ?? themes[0].id);
  const [showSurvey, setShowSurvey] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const templates = useMemo(() => templatesForTheme(themeId, skills), [themeId, skills]);

  // Escape đóng sheet + đưa focus vào sheet khi mở (bàn phím / trình đọc màn hình).
  useEffect(() => {
    // Nhớ nút đã mở sheet để đóng xong trả focus về đó (bàn phím / trình đọc màn hình).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [onClose]);

  const pickTheme = (id: EarningThemeId) => {
    setThemeId(id);
    listRef.current?.scrollTo({ top: 0 });
  };

  const handleSurveySaved = (input: { skills: string[]; freeTimeHoursPerWeek: number }) => {
    saveSurvey(input);
    setShowSurvey(false);
    setThemeId(rankThemesBySkills(input.skills).themes[0].id);
  };

  const onTabKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = themes[(idx + (e.key === 'ArrowRight' ? 1 : themes.length - 1)) % themes.length];
    pickTheme(next.id);
    document.getElementById(`eis-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <motion.div
        className="eis-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        className="eis-sheet"
        data-tid={themeId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <div className="eis-top">
          <span className="eis-grab" aria-hidden="true" />
          <div className="eis-head">
            <h2 id={titleId} className="eis-title">Hôm nay kiếm thêm bằng gì?</h2>
            <button type="button" className="eis-x" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>

          <div className="eis-chips" role="tablist" aria-label="Chủ đề kiếm tiền">
            {themes.map((t, i) => {
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  id={`eis-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="eis-panel"
                  tabIndex={active ? 0 : -1}
                  data-tid={t.id}
                  className={`eis-chip${active ? ' is-active' : ''}`}
                  onClick={() => pickTheme(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {matched.has(t.id) && <em className="eis-fit">Hợp với bạn</em>}
                  <span className="eis-chip-ico" aria-hidden="true">{t.emoji}</span>
                  <span className="eis-chip-label">{t.name}</span>
                </button>
              );
            })}
          </div>

          <div className="eis-wave" aria-hidden="true">
            <svg viewBox="0 0 390 30" preserveAspectRatio="none">
              <path className="w1" d="M0,12 C70,28 140,2 220,12 C300,22 350,6 390,14 L390,30 L0,30 Z" />
              <path className="w2" d="M0,20 C90,30 160,8 250,18 C320,26 360,14 390,20 L390,30 L0,30 Z" />
            </svg>
          </div>
        </div>

        <div className="eis-body" ref={listRef}>
          <p className="eis-blurb">{themes.find((t) => t.id === themeId)?.blurb}</p>

          <ul id="eis-panel" role="tabpanel" aria-labelledby={`eis-tab-${themeId}`} className="eis-list">
            {templates.map((tpl, i) => (
              <li key={tpl.id} className={i === 0 ? 'eis-item eis-item--hero' : 'eis-item'}>
                <button
                  type="button"
                  className="eis-item-btn"
                  onClick={() => onPick(tpl)}
                  aria-label={`Thêm việc: ${tpl.name}, ${formatPriceRange(tpl.priceRange)}, khoảng ${tpl.typicalDays} ngày`}
                >
                  <span className="eis-emo" aria-hidden="true">{tpl.emoji}</span>
                  <span className="eis-txt">
                    <b>{tpl.name}</b>
                    <small><i>{formatPriceRange(tpl.priceRange)}</i> · ~{tpl.typicalDays} ngày</small>
                  </span>
                  <span className="eis-add" aria-hidden="true"><Plus size={i === 0 ? 22 : 18} strokeWidth={2.6} /></span>
                </button>
              </li>
            ))}
          </ul>

          <p className="eis-note">Giá tham khảo, tuỳ khu vực và tay nghề</p>

          {skills.length === 0 && (
            <div className="eis-survey">
              {!showSurvey ? (
                <button type="button" className="eis-survey-cta" onClick={() => setShowSurvey(true)}>
                  <Compass size={16} aria-hidden="true" />
                  <span>Làm khảo sát 1 phút để gợi ý đúng hơn</span>
                </button>
              ) : (
                <CapacitySurveyCard initial={answers} onSave={handleSurveySaved} />
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
