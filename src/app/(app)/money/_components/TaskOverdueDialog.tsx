/* ═══ TaskOverdueDialog — Choose reason for overdue task ═══ */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { OVERDUE_REASON_LABELS, type OverdueReason } from '@/types/task';
import './TaskOverdueDialog.css';

interface TaskOverdueDialogProps {
  isOpen: boolean;
  taskName: string;
  onSelect: (reason: OverdueReason) => void;
  onCancel: () => void;
}

const REASONS: OverdueReason[] = ['not_relevant', 'postponed', 'plan_changed'];

export default function TaskOverdueDialog({ isOpen, taskName, onSelect, onCancel }: TaskOverdueDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="tod-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
          <motion.div
            className="tod-dialog"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <p className="tod-icon">⚠️</p>
            <h3 className="tod-title">Xử lý trễ hạn</h3>
            <p className="tod-task-name">&ldquo;{taskName}&rdquo;</p>
            <p className="tod-warning">⚡ Trễ hạn sẽ giảm 30% XP cho 3 nhiệm vụ tiếp theo</p>

            <p className="tod-label">Chọn lý do:</p>
            <div className="tod-reasons">
              {REASONS.map((reason) => (
                <button key={reason} className="tod-reason-btn" onClick={() => onSelect(reason)}>
                  {OVERDUE_REASON_LABELS[reason]}
                </button>
              ))}
            </div>

            <button className="tod-cancel" onClick={onCancel}>Quay lại</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
