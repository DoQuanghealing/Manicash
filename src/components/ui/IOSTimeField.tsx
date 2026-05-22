/* ═══ IOSTimeField — Trường giờ + Sheet picker ═══
 * Pattern y hệt IOSDateField nhưng cho HH:mm.
 */
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import IOSTimePicker from './IOSTimePicker';
import './IOSField.css';

interface Props {
  value: string;     // HH:mm
  onChange: (newTime: string) => void;
  placeholder?: string;
  label?: string;
  /** Nút clear hiện nếu allowClear */
  allowClear?: boolean;
}

export default function IOSTimeField({
  value,
  onChange,
  placeholder = 'Chọn giờ',
  label = 'Giờ sinh',
  allowClear = true,
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
    setDraft(value || '00:00');
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const display = value;

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="iosf-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
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
              <button
                type="button"
                className="iosf-action iosf-action--cancel"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <span className="iosf-title">{label}</span>
              <button
                type="button"
                className="iosf-action iosf-action--done"
                onClick={handleConfirm}
              >
                Xong
              </button>
            </header>
            <div className="iosf-body">
              <IOSTimePicker value={draft} onChange={setDraft} />
              {allowClear && value && (
                <button
                  type="button"
                  className="iosf-clear-btn"
                  onClick={handleClear}
                >
                  Bỏ chọn (không khai báo)
                </button>
              )}
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
        <Clock size={15} className="iosf-field-icon" />
        <span className="iosf-field-value">{display || placeholder}</span>
      </button>
      {portalEl && createPortal(sheet, portalEl)}
    </>
  );
}
