/* ═══ BreathGate — 30s Mandatory Breathing Exercise ═══ */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/utils/formatCurrency';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore } from '@/stores/useSettingsStore';
import './BreathGate.css';

const TOTAL_SECONDS = 30;
const BREATH_CYCLE = 10; // 4s inhale + 2s hold + 4s exhale

type BreathPhase = 'inhale' | 'hold' | 'exhale';

interface BreathGateProps {
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function BreathGate({ amount, onConfirm, onCancel, isOpen }: BreathGateProps) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [isComplete, setIsComplete] = useState(false);
  const { play } = useAudio();
  const butlerName = useSettingsStore((s) => s.butlerName);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setSecondsLeft(TOTAL_SECONDS);
      setIsComplete(false);
      setPhase('inhale');
      play('breath');
    }
  }, [isOpen, play]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isComplete) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsComplete(true);
          play('breath');
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isComplete, play]);

  // Breathing phase cycle (4s in, 2s hold, 4s out)
  useEffect(() => {
    if (!isOpen || isComplete) return;

    const elapsed = TOTAL_SECONDS - secondsLeft;
    const cyclePosition = elapsed % BREATH_CYCLE;

    if (cyclePosition < 4) {
      setPhase('inhale');
    } else if (cyclePosition < 6) {
      setPhase('hold');
    } else {
      setPhase('exhale');
    }
  }, [secondsLeft, isOpen, isComplete]);

  const handleConfirm = useCallback(() => {
    if (isComplete) {
      onConfirm();
    }
  }, [isComplete, onConfirm]);

  // SVG circle progress
  const circumference = 2 * Math.PI * 72;
  const progress = ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * circumference;

  const phaseLabel: Record<BreathPhase, string> = {
    inhale: 'Hít vào',
    hold: 'Giữ',
    exhale: 'Thở ra',
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="breathgate-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        id="breathgate-modal"
      >
        <div className="breathgate-card">
          <div className="breathgate-icon">🧘</div>
          <h2 className="breathgate-title">Khoan đã!</h2>
          <p className="breathgate-amount">{formatCurrency(amount)}</p>
          <p className="breathgate-instruction">
            Hãy hít thở sâu 30 giây trước khi quyết định.<br />
            Khoản chi này có thật sự cần thiết không?
          </p>

          {/* Breathing circle */}
          <div className="breathgate-circle-container">
            <div className="breathgate-circle-bg" />
            <div className="breathgate-circle-progress">
              <svg viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  stroke="rgba(124, 58, 237, 0.15)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  stroke="url(#breathGradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="breathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#F97316" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className={`breathgate-circle-inner ${isComplete ? '' : phase}`}>
              <span className="breathgate-timer">{secondsLeft}</span>
              <span className="breathgate-phase">
                {isComplete ? '✓ Hoàn tất' : phaseLabel[phase]}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="breathgate-actions">
            <button
              className={`breathgate-confirm-btn ${isComplete ? 'ready' : 'waiting'}`}
              onClick={handleConfirm}
              disabled={!isComplete}
              id="breathgate-confirm"
            >
              {isComplete ? 'Vẫn muốn chi tiêu' : `Chờ ${secondsLeft}s...`}
            </button>
            <button
              className="breathgate-cancel-btn"
              onClick={onCancel}
              id="breathgate-cancel"
            >
              Hủy — Tôi đã nghĩ lại ☺️
            </button>
          </div>

          <p className="breathgate-butler">
            🎩 {butlerName}: &ldquo;30 giây suy nghĩ hôm nay = triệu đồng tiết kiệm ngày mai&rdquo;
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
