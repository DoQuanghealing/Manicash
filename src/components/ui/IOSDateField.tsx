/* ═══ IOSDateField — Trường ngày + Sheet picker ═══
 *
 * UX iOS chuẩn:
 *   1. Trường hiển thị value đã chọn (hoặc placeholder)
 *   2. Tap → sheet slide từ dưới lên với IOSDatePicker bên trong
 *   3. Header sheet có 2 nút: "Hủy" (left) | "Xong" (right primary)
 *   4. "Xong" → commit value + đóng sheet
 *   5. "Hủy" → discard pick, giữ value cũ
 *
 * Draft state nội bộ — chỉ commit khi bấm Xong.
 */
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import IOSDatePicker from './IOSDatePicker';
import './IOSField.css';

interface Props {
  value: string;       // YYYY-MM-DD
  onChange: (newDate: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  label?: string;      // hiển thị trong sheet header
}

function formatDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

export default function IOSDateField({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  minDate,
  maxDate,
  label = 'Ngày sinh',
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.querySelector('.mobile-shell') as HTMLElement | null;
    queueMicrotask(() => setPortalEl(el || document.body));
  }, []);

  const handleOpen = () => {
    setDraft(value || maxDate || new Date().toISOString().slice(0, 10));
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const display = formatDisplay(value);

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="iosf-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
        >
          <motion.div
            className="iosf-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="iosf-header">
              <button type="button" className="iosf-action iosf-action--cancel" onClick={handleCancel}>
                Hủy
              </button>
              <span className="iosf-title">{label}</span>
              <button type="button" className="iosf-action iosf-action--done" onClick={handleConfirm}>
                Xong
              </button>
            </header>
            <div className="iosf-body">
              <IOSDatePicker
                value={draft}
                onChange={setDraft}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        className={`iosf-field ${display ? 'iosf-field--filled' : ''}`}
        onClick={handleOpen}
      >
        <Calendar size={15} className="iosf-field-icon" />
        <span className="iosf-field-value">
          {display || placeholder}
        </span>
      </button>
      {portalEl && createPortal(sheet, portalEl)}
    </>
  );
}
