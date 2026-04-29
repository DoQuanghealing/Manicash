/* ═══ SplitSuccessPopup — Confetti + breakdown after fund split ═══ */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SplitResult } from '@/stores/useDashboardStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import './SplitSuccessPopup.css';

const CONGRATS_MESSAGES = [
  'Tuyệt vời! Tiền đã được phân bổ an toàn!',
  'Cậu chủ giỏi lắm! Quản gia rất hài lòng!',
  'Kỷ luật tài chính +100! Cậu chủ thật đáng nể!',
  'Mỗi lần chia tiền = thêm 1 bước tới tự do tài chính!',
  'Lord Diamond tự hào vì cậu chủ!',
  'Chia tiền xong, ngủ ngon hơn! Quản gia bảo đảm!',
];

interface SplitSuccessPopupProps {
  isOpen: boolean;
  result: SplitResult | null;
  onClose: () => void;
}

// Generate confetti particles (CSS-only, no library)
const CONFETTI_COUNT = 24;
const confettiParticles = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  id: i,
  // Deterministic positions to avoid hydration mismatch
  left: `${(i * 17 + 5) % 100}%`,
  delay: `${(i * 0.12) % 1.8}s`,
  duration: `${1.8 + (i % 5) * 0.3}s`,
  color: ['#8B5CF6', '#EC4899', '#F97316', '#10B981', '#3B82F6', '#FBBF24'][(i * 3) % 6],
  size: 6 + (i % 4) * 2,
}));

export default function SplitSuccessPopup({ isOpen, result, onClose }: SplitSuccessPopupProps) {
  const butlerName = useSettingsStore((s) => s.butlerName);
  const message = useMemo(() => {
    const raw = CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)];
    return raw.replace(/Lord Diamond/g, butlerName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, butlerName]);

  // Auto-dismiss after 8s
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  const formatVND = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  return (
    <AnimatePresence>
      {isOpen && result && (
        <motion.div
          className="ssp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Confetti particles */}
          <div className="ssp-confetti-container" aria-hidden="true">
            {confettiParticles.map((p) => (
              <div
                key={p.id}
                className="ssp-confetti"
                style={{
                  left: p.left,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                  backgroundColor: p.color,
                  width: p.size,
                  height: p.size,
                }}
              />
            ))}
          </div>

          {/* Card */}
          <motion.div
            className="ssp-card"
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 40 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Emoji burst */}
            <div className="ssp-emoji-burst">🎉</div>
            <h2 className="ssp-title">Chia tiền thành công!</h2>

            {/* Breakdown */}
            <div className="ssp-breakdown">
              {result.billAmount > 0 && (
                <div className="ssp-row">
                  <span className="ssp-row-label">🏦 Quỹ Bill</span>
                  <span className="ssp-row-amount ssp-row-amount--bill">+{formatVND(result.billAmount)}</span>
                </div>
              )}
              {result.reserveAmount > 0 && (
                <div className="ssp-row">
                  <span className="ssp-row-label">🔒 Dự phòng</span>
                  <span className="ssp-row-amount ssp-row-amount--reserve">+{formatVND(result.reserveAmount)}</span>
                </div>
              )}
              {result.goalsAmount > 0 && (
                <div className="ssp-row">
                  <span className="ssp-row-label">🎯 Mục tiêu</span>
                  <span className="ssp-row-amount ssp-row-amount--goals">+{formatVND(result.goalsAmount)}</span>
                </div>
              )}
              {result.investmentAmount > 0 && (
                <div className="ssp-row">
                  <span className="ssp-row-label">📈 Đầu tư</span>
                  <span className="ssp-row-amount ssp-row-amount--invest">+{formatVND(result.investmentAmount)}</span>
                </div>
              )}
              <div className="ssp-divider" />
              <div className="ssp-row ssp-row--remaining">
                <span className="ssp-row-label">💰 Còn lại trong ví</span>
                <span className="ssp-row-amount">{formatVND(result.remaining)}</span>
              </div>
            </div>

            {/* Butler message */}
            <p className="ssp-butler-msg">🎩 {message}</p>

            {/* Close button */}
            <button className="ssp-close-btn" onClick={onClose}>
              Tuyệt vời! 🎉
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
