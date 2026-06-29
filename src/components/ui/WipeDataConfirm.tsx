/* ═══ WipeDataConfirm — 2-step destructive confirmation ═══
 *
 * User must:
 *   1. See the danger summary
 *   2. Type "XÓA" to enable the apply button
 *
 * Calls wipeAllData() on confirm. Caller handles post-wipe UX (e.g.
 * close modals, refresh router, show toast).
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { wipeAllData } from '@/lib/wipeAllData';
import './WipeDataConfirm.css';

interface WipeDataConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired after wipe succeeds. Caller may refresh / navigate / toast. */
  onConfirmed?: () => void;
}

/** Từ xác nhận hiển thị. Dùng "delete" (ASCII) để bàn phím mobile không
 *  tự thêm dấu (gõ "XÓA" hay bị bỏ dấu sai chỗ thành "XOÁ" → không khớp). */
const TRIGGER_WORD = 'delete';
/** Vẫn chấp nhận biến thể tiếng Việt cũ để không phá thói quen người dùng. */
const ACCEPTED_WORDS = new Set(['delete', 'xoa', 'xóa', 'xoá']);

export default function WipeDataConfirm({ isOpen, onClose, onConfirmed }: WipeDataConfirmProps) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);

  const canApply = ACCEPTED_WORDS.has(typed.trim().toLowerCase()) && !working;

  const handleApply = () => {
    if (!canApply) return;
    setWorking(true);
    try {
      wipeAllData();
      onConfirmed?.();
      onClose();
    } finally {
      setWorking(false);
      setTyped('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="wdc-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="wdc-modal"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="wdc-header">
              <div className="wdc-header-icon">
                <AlertTriangle size={20} />
              </div>
              <h2>Xóa toàn bộ dữ liệu</h2>
              <button
                type="button"
                onClick={onClose}
                className="wdc-close"
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </header>

            <div className="wdc-body">
              <p className="wdc-lead">
                Thao tác này không thể hoàn tác. App sẽ trở về trạng thái khởi đầu:
              </p>
              <ul className="wdc-list">
                <li>Mọi số dư, giao dịch, hóa đơn, ngân sách → 0</li>
                <li>Mục tiêu, nhiệm vụ, wishlist, mission → xóa hết</li>
                <li>XP, streak, lần nhịn chi tiêu → 0 (giữ lại tên + email)</li>
                <li>Lịch sử nạp + đồng bộ ngân hàng → reset</li>
              </ul>
              <p className="wdc-keep">
                Giữ nguyên: tài khoản đăng nhập, ảnh đại diện, năm sinh.
              </p>

              <label className="wdc-prompt" htmlFor="wdc-input">
                Gõ <strong>{TRIGGER_WORD}</strong> để xác nhận:
              </label>
              <input
                id="wdc-input"
                type="text"
                className="wdc-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={TRIGGER_WORD}
                autoComplete="off"
              />
            </div>

            <footer className="wdc-footer">
              <button
                type="button"
                onClick={onClose}
                className="wdc-btn wdc-btn--ghost"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!canApply}
                className="wdc-btn wdc-btn--danger"
              >
                <Trash2 size={14} />
                <span>{working ? 'Đang xóa…' : 'Xóa toàn bộ'}</span>
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
