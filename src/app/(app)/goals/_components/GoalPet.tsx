/* ═══ GoalPet — Linh vật mục tiêu lớn lên theo progress ═══
 *
 * Tăng cấp visual theo % progress:
 *   0-19%   : 🌱 mầm
 *   20-39%  : 🪴 chậu cây
 *   40-59%  : 🌿 cây trưởng thành
 *   60-79%  : 🌳 cây lớn
 *   80-99%  : 🌲 đại thụ
 *   100%    : 🌟 nở hoa (kèm aura vàng)
 *
 * Animation: idle float + glow theo cấp.
 */
'use client';

import { motion } from 'framer-motion';
import './GoalPet.css';

interface Props {
  progress: number;     // 0..100
  size?: number;        // px
  showStage?: boolean;  // hiển thị tên giai đoạn dưới
}

const STAGES = [
  { min: 0,   emoji: '🌱', name: 'Hạt mầm',     glow: 'rgba(34, 197, 94, 0.3)' },
  { min: 20,  emoji: '🪴', name: 'Chậu cây',    glow: 'rgba(34, 197, 94, 0.4)' },
  { min: 40,  emoji: '🌿', name: 'Trưởng thành', glow: 'rgba(34, 197, 94, 0.5)' },
  { min: 60,  emoji: '🌳', name: 'Cây lớn',     glow: 'rgba(20, 184, 166, 0.5)' },
  { min: 80,  emoji: '🌲', name: 'Đại thụ',     glow: 'rgba(124, 58, 237, 0.6)' },
  { min: 100, emoji: '🌟', name: 'Nở hoa',      glow: 'rgba(249, 115, 22, 0.8)' },
];

function getStage(progress: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i].min) return STAGES[i];
  }
  return STAGES[0];
}

export default function GoalPet({ progress, size = 28, showStage = false }: Props) {
  const stage = getStage(progress);
  const isFinal = progress >= 100;

  return (
    <span className="goal-pet" style={{ '--gp-glow': stage.glow } as React.CSSProperties}>
      <motion.span
        className={`goal-pet-emoji ${isFinal ? 'goal-pet-emoji--final' : ''}`}
        style={{ fontSize: size }}
        animate={
          isFinal
            ? { rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.1, 1] }
            : { y: [0, -2, 0] }
        }
        transition={
          isFinal
            ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {stage.emoji}
      </motion.span>
      {showStage && <span className="goal-pet-stage">{stage.name}</span>}
    </span>
  );
}
