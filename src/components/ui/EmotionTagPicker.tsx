/* ═══ EmotionTagPicker — Nhận diện cảm xúc chi tiêu, không phán xét ═══
 * Hiện SAU khi giao dịch expense đã được lưu (không chặn nhập liệu).
 * Bỏ qua được — chỉ là optional context cho CFO report phân tích sau.
 */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useFinanceStore, type EmotionTag } from '@/stores/useFinanceStore';
import './EmotionTagPicker.css';

interface EmotionTagPickerProps {
  isOpen: boolean;
  transactionId: string;
  onDone: () => void;
}

const EMOTION_OPTIONS: Array<{ tag: EmotionTag; emoji: string; label: string }> = [
  { tag: 'preference', emoji: '🙂', label: 'Sở thích' },
  { tag: 'excited', emoji: '🤩', label: 'Hứng' },
  { tag: 'self_reward', emoji: '🎁', label: 'Tự thưởng' },
  { tag: 'stress', emoji: '😤', label: 'Stress' },
  { tag: 'sad', emoji: '😔', label: 'Buồn phiền' },
  { tag: 'anger', emoji: '😠', label: 'Giận' },
  { tag: 'jealousy', emoji: '😒', label: 'Ganh tị' },
];

export default function EmotionTagPicker({ isOpen, transactionId, onDone }: EmotionTagPickerProps) {
  const updateTransactionEmotion = useFinanceStore((s) => s.updateTransactionEmotion);

  if (!isOpen) return null;

  const pick = (tag: EmotionTag) => {
    updateTransactionEmotion(transactionId, tag);
    onDone();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="emotion-picker-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDone}
        id="emotion-picker"
      >
        <div className="emotion-picker-card" onClick={(e) => e.stopPropagation()}>
          <p className="emotion-picker-title">Lúc mua món này bạn đang cảm thấy gì?</p>
          <p className="emotion-picker-subtitle">Không phán xét — chỉ để hiểu bạn hơn thôi.</p>

          <div className="emotion-picker-grid">
            {EMOTION_OPTIONS.map((opt) => (
              <button
                key={opt.tag}
                className="emotion-picker-chip"
                onClick={() => pick(opt.tag)}
                id={`emotion-chip-${opt.tag}`}
              >
                <span className="emotion-picker-emoji">{opt.emoji}</span>
                <span className="emotion-picker-label">{opt.label}</span>
              </button>
            ))}
          </div>

          <button className="emotion-picker-skip" onClick={onDone} id="emotion-picker-skip">
            Bỏ qua
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
