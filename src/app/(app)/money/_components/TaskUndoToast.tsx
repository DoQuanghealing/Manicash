/* ═══ TaskUndoToast — "Đã ghi +350.000đ vào ví chính · Hoàn tác" ═══
 * Tự ẩn sau UNDO_MS. Hoàn tác do MoneyContent làm (biết snapshot), toast chỉ gọi onUndo.
 */
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/hooks/useIsClient';
import { motion, AnimatePresence } from 'framer-motion';
import './TaskUndoToast.css';

export const UNDO_MS = 6000;

export interface UndoToastData {
  id: number;
  message: string;
  note?: string;
  onUndo?: () => void;
}

interface Props {
  toast: UndoToastData | null;
  onDismiss: () => void;
}

export default function TaskUndoToast({ toast, onDismiss }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useIsClient();

  useEffect(() => {
    clearTimeout(timer.current);
    if (toast) timer.current = setTimeout(onDismiss, UNDO_MS);
    return () => clearTimeout(timer.current);
  }, [toast, onDismiss]);

  if (!mounted) return null;
  return createPortal(
    <div className="tut-wrap" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="tut-toast"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            <div className="tut-text">
              <p className="tut-msg">{toast.message}</p>
              {toast.note && <p className="tut-note">{toast.note}</p>}
            </div>
            {toast.onUndo && (
              <button
                type="button"
                className="tut-undo"
                onClick={() => { toast.onUndo?.(); onDismiss(); }}
              >
                Hoàn tác
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
