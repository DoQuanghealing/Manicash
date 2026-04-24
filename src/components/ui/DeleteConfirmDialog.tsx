/* ═══ DeleteConfirmDialog — Reusable confirmation ═══ */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import './DeleteConfirmDialog.css';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="dcd-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
          <motion.div
            className="dcd-dialog"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <p className="dcd-icon">⚠️</p>
            <h3 className="dcd-title">{title}</h3>
            <p className="dcd-message">{message}</p>
            <div className="dcd-actions">
              <button className="dcd-btn-cancel" onClick={onCancel}>Hủy</button>
              <button className="dcd-btn-confirm" onClick={onConfirm}>Xóa</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
